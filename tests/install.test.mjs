import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, access, rm, rename, lstat, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { install, uninstall, inspectInstallations, updateInstallations } from '../src/install.mjs';

async function setup(t) {
  const base = path.resolve('.test-data');
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, 'install-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const packageRoot = path.join(dir, "package with spaces and 'quote'");
  for (const name of ['nail-performance-review-setup', 'nail-performance-review-track', 'nail-performance-review-review', 'nail-performance-review-report']) {
    const folder = path.join(packageRoot, 'skills', name);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'SKILL.md'), `# ${name}\nUse {{NAIL_PACKAGE_ROOT}} and {{NAIL_CLI}}.\n`);
  }
  await mkdir(path.join(packageRoot, 'adapters/cursor'), { recursive: true });
  await writeFile(path.join(packageRoot, 'adapters/cursor/nail.mdc'), 'Test Cursor rule.');
  await mkdir(path.join(packageRoot, 'bin'), { recursive: true });
  await writeFile(path.join(packageRoot, 'bin', 'nail.mjs'), 'console.log(JSON.stringify(process.argv.slice(2)));\n');
  return { home: path.join(dir, 'home with spaces'), root: path.join(dir, 'performance'), packageRoot };
}

async function put(file, object) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(object));
}

const json = async (file) => JSON.parse(await readFile(file, 'utf8'));

async function legacyInstallation(target, options) {
  await install(target, options);
  const manifestFile = path.join(options.home, '.nail', 'installations', `${target}.json`);
  const manifest = await json(manifestFile);
  for (const file of manifest.files) {
    if (path.extname(file.path) === '.mdc') continue;
    const name = path.basename(path.dirname(file.path));
    const legacyName = name.replace('nail-performance-review-', 'nail-');
    const legacyPath = path.join(path.dirname(path.dirname(file.path)), legacyName, 'SKILL.md');
    await mkdir(path.dirname(legacyPath), { recursive: true });
    await rename(file.path, legacyPath);
    const content = (await readFile(legacyPath, 'utf8')).replaceAll(name, legacyName);
    await writeFile(legacyPath, content);
    file.path = legacyPath;
    file.sha256 = createHash('sha256').update(content).digest('hex');
  }
  await put(manifestFile, manifest);
  return { manifestFile, manifest };
}

for (const target of ['codex', 'claude', 'cursor', 'gemini', 'generic']) {
  test(`${target} upgrades short skill names without duplicates and can uninstall the new names`, async t => {
    const options = await setup(t);
    const { manifestFile, manifest } = await legacyInstallation(target, options);
    const before = await readFile(manifestFile, 'utf8');
    await install(target, { ...options, dryRun: true });
    assert.equal(await readFile(manifestFile, 'utf8'), before);
    for (const file of manifest.files) await access(file.path);
    await install(target, options);
    await install(target, options);
    const current = await json(manifestFile);
    const skills = current.files.filter(file => file.path.endsWith('SKILL.md'));
    assert.equal(skills.length, 4);
    assert.ok(skills.every(file => path.basename(path.dirname(file.path)).startsWith('nail-performance-review-')));
    for (const file of manifest.files.filter(item => item.path.endsWith('SKILL.md'))) await assert.rejects(access(file.path), { code: 'ENOENT' });
    assert.deepEqual((await inspectInstallations(options)).find(x => x.target === target).issues, []);
    await uninstall(target, options);
    for (const file of current.files) await assert.rejects(access(file.path), { code: 'ENOENT' });
  });
}

test('edited legacy skills and new-name collisions abort upgrades before changing old files or settings', async t => {
  const options = await setup(t);
  const { manifestFile, manifest } = await legacyInstallation('codex', options);
  const original = await readFile(manifest.files[0].path, 'utf8');
  await writeFile(manifest.files[0].path, 'My custom setup.');
  await assert.rejects(install('codex', options), /edited legacy skill/);
  assert.equal(await readFile(manifest.files[0].path, 'utf8'), 'My custom setup.');
  await writeFile(manifest.files[0].path, original);
  const collision = path.join(options.home, '.agents', 'skills', 'nail-performance-review-track', 'SKILL.md');
  await mkdir(path.dirname(collision), { recursive: true }); await writeFile(collision, 'My other skill.');
  const settings = await readFile(path.join(options.home, '.codex/hooks.json'), 'utf8');
  await assert.rejects(install('codex', options), /unowned or edited/);
  assert.equal(await readFile(collision, 'utf8'), 'My other skill.');
  for (const file of manifest.files) await access(file.path);
  assert.equal(await readFile(path.join(options.home, '.codex/hooks.json'), 'utf8'), settings);
  assert.equal((await json(manifestFile)).files[0].path, manifest.files[0].path);
});

test('an old-name installation can still be uninstalled directly', async t => {
  const options = await setup(t);
  const { manifest } = await legacyInstallation('claude', options);
  await uninstall('claude', options);
  for (const file of manifest.files) await assert.rejects(access(file.path), { code: 'ENOENT' });
});

test('dry run creates no home, skills, or configuration', async (t) => {
  const options = await setup(t);
  const result = await install('codex', { ...options, dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(result.verifiedAutomaticCapture, false);
  await assert.rejects(access(options.home), { code: 'ENOENT' });
});

for (const [target, configPath, event] of [
  ['codex', '.codex/hooks.json', 'SessionStart'],
  ['claude', '.claude/settings.json', 'SessionStart'],
  ['cursor', '.cursor/hooks.json', 'sessionStart'],
  ['gemini', '.gemini/settings.json', 'SessionStart'],
]) {
  test(`${target} preserves settings through install, update, and uninstall`, async (t) => {
    const options = await setup(t);
    const configFile = path.join(options.home, configPath);
    const existing = { unrelated: { enabled: true }, hooks: { [event]: [{ command: 'existing-user-hook' }] } };
    await put(configFile, existing);
    const first = await install(target, options);
    assert.equal(first.mode, 'skills-and-hooks');
    let config = await json(configFile);
    assert.equal(config.hooks[event].length, 2);
    assert.deepEqual(config.unrelated, existing.unrelated);
    await install(target, options);
    config = await json(configFile);
    assert.equal(config.hooks[event].length, 2);
    assert.equal(Object.hasOwn(config, 'features'), false);
    await uninstall(target, options);
    assert.deepEqual(await json(configFile), existing);
    assert.equal((await inspectInstallations(options)).find((item) => item.target === target).installed, false);
  });
}

test('uninstall preserves user-edited skills and newly added hooks', async (t) => {
  const options = await setup(t);
  await install('codex', options);
  const skill = path.join(options.home, '.agents/skills/nail-performance-review-track/SKILL.md');
  await writeFile(skill, 'My edited instructions.');
  const configFile = path.join(options.home, '.codex/hooks.json');
  const config = await json(configFile);
  config.hooks.SessionStart.push({ command: 'added-after-install' });
  await put(configFile, config);
  const result = await uninstall('codex', options);
  assert.deepEqual(result.preserved, [skill]);
  assert.equal(await readFile(skill, 'utf8'), 'My edited instructions.');
  assert.deepEqual((await json(configFile)).hooks.SessionStart, [{ command: 'added-after-install' }]);
});

test('unowned skills and malformed configuration fail before any writes', async (t) => {
  const options = await setup(t);
  const configFile = path.join(options.home, '.claude/settings.json');
  await mkdir(path.dirname(configFile), { recursive: true });
  await writeFile(configFile, '{broken');
  await assert.rejects(install('claude', options), SyntaxError);
  await assert.rejects(access(path.join(options.home, '.claude/skills/nail-performance-review-setup/SKILL.md')), { code: 'ENOENT' });
  const skill = path.join(options.home, '.cursor/skills/nail-performance-review-track/SKILL.md');
  await mkdir(path.dirname(skill), { recursive: true });
  await writeFile(skill, 'User owns this.');
  await assert.rejects(install('cursor', options), /unowned or edited/);
  await assert.rejects(access(path.join(options.home, '.cursor/skills/nail-performance-review-setup/SKILL.md')), { code: 'ENOENT' });
});

test('tampered manifest cannot remove files outside Nail installation destinations', async (t) => {
  const options = await setup(t);
  await install('codex', options);
  const manifestFile = path.join(options.home, '.nail/installations/codex.json');
  const manifest = await json(manifestFile);
  const victim = path.join(options.home, 'keep.md');
  await writeFile(victim, 'Keep me.');
  manifest.files[0].path = victim;
  await put(manifestFile, manifest);
  await assert.rejects(uninstall('codex', options), /Invalid Nail installation manifest/);
  assert.equal(await readFile(victim, 'utf8'), 'Keep me.');
});

test('generated host commands execute a script whose path contains spaces and apostrophes', async (t) => {
  const options = await setup(t);
  for (const target of ['codex', 'claude', 'cursor', 'gemini']) {
    await install(target, options);
    const configPaths = { codex: '.codex/hooks.json', claude: '.claude/settings.json', cursor: '.cursor/hooks.json', gemini: '.gemini/settings.json' };
    const config = await json(path.join(options.home, configPaths[target]));
    const group = config.hooks[target === 'cursor' ? 'sessionStart' : 'SessionStart'][0];
    const hook = target === 'cursor' ? group : group.hooks[0];
    let result;
    if (hook.args) result = spawnSync(hook.command, hook.args, { encoding: 'utf8', input: '{}' });
    else if (process.platform === 'win32') {
      result = target === 'cursor' || hook.shell === 'powershell'
        ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', hook.command], { encoding: 'utf8', input: '{}' })
        : spawnSync(hook.command_windows || hook.command, { shell: true, encoding: 'utf8', input: '{}' });
    } else result = spawnSync('/bin/sh', ['-c', hook.command], { encoding: 'utf8', input: '{}' });
    assert.equal(result.status, 0, `${target}: ${result.stderr || result.error}`);
    assert.deepEqual(JSON.parse(result.stdout.trim()), ['hook', '--target', target, '--event', target === 'cursor' ? 'sessionStart' : 'SessionStart']);
  }
});

test('generic installation substitutes paths and stays a manual handoff', async (t) => {
  const options = await setup(t);
  const result = await install('generic', options);
  assert.equal(result.mode, 'manual-handoff');
  const skill = await readFile(path.join(options.home, '.nail/prompts/nail-performance-review-setup/SKILL.md'), 'utf8');
  assert.equal(skill.includes('{{NAIL_'), false);
  assert.equal(skill.includes(options.packageRoot.replaceAll('\\', '/')), true);
});

test('installation inspection reports removed hooks and edited skills', async (t) => {
  const options = await setup(t);
  await install('codex', options);
  await writeFile(path.join(options.home, '.agents/skills/nail-performance-review-track/SKILL.md'), 'Changed by user.');
  await put(path.join(options.home, '.codex/hooks.json'), { hooks: {} });
  const status = (await inspectInstallations(options)).find((item) => item.target === 'codex');
  assert.equal(status.issues.length, 3);
  assert.match(status.issues.join('\n'), /Edited installed skill/);
  assert.match(status.issues.join('\n'), /Missing SessionStart hook/);
  assert.match(status.issues.join('\n'), /Missing UserPromptSubmit hook/);
  assert.equal(status.verifiedAutomaticCapture, false);
});

test('upgrade removes only Nail’s legacy Stop entry; skills-only mode removes Nail startup too', async t => {
  const options = await setup(t);
  await install('claude', options);
  const file = path.join(options.home, '.claude/settings.json');
  const manifestFile = path.join(options.home, '.nail/installations/claude.json');
  const config = await json(file), manifest = await json(manifestFile);
  const owned = { hooks: [{ type: 'command', command: process.execPath, args: ['old Nail', 'Stop'] }] };
  const unrelated = { hooks: [{ type: 'command', command: 'unrelated' }] };
  config.hooks.Stop = [owned, unrelated];
  manifest.entries.push({ event: 'Stop', entry: owned });
  await put(file, config); await put(manifestFile, manifest);
  await install('claude', options);
  assert.deepEqual((await json(file)).hooks.Stop, [unrelated]);
  assert.match((await json(file)).hooks.SessionStart[0].hooks[0].command, /^node .+nail\.mjs/);
  await install('claude', { ...options, skillsOnly: true });
  assert.deepEqual((await json(file)).hooks, { Stop: [unrelated] });
});

test('update repairs a stripped Claude hook, backs up settings, and keeps Cursor reuse', async t => {
  const options = await setup(t);
  await install('claude', options);
  await install('cursor', { ...options, reuseClaudeSkills: true });
  await install('codex', { ...options, skillsOnly: true });
  const file = path.join(options.home, '.claude/settings.json');
  const manifestFile = path.join(options.home, '.nail/installations/claude.json');
  const config = await json(file), manifest = await json(manifestFile);
  const cli = path.join(options.packageRoot, 'bin/nail.mjs');
  const legacy = { hooks: [{ type: 'command', command: 'node', timeout: 5 }] };
  const unrelated = { hooks: [{ type: 'command', command: 'node /tools/unrelated.mjs' }] };
  config.hooks = { SessionStart: [legacy, unrelated], Stop: [legacy, legacy] };
  manifest.entries = ['SessionStart', 'Stop'].map(event => ({
    event, entry: { hooks: [{ ...legacy.hooks[0], args: [cli, 'hook', '--target', 'claude', '--event', event] }] },
  }));
  await put(file, config);
  await put(manifestFile, manifest);
  const updatedTemplate = path.join(options.packageRoot, 'skills/nail-performance-review-setup/SKILL.md');
  await writeFile(updatedTemplate, 'Updated setup instructions.');
  const original = await readFile(file, 'utf8');
  const preview = await updateInstallations({ ...options, dryRun: true });
  assert.deepEqual(preview.errors, []);
  assert.ok(preview.updated.some(item => item.target === 'cursor'));
  assert.equal(await readFile(file, 'utf8'), original);
  const result = await updateInstallations(options);
  assert.deepEqual(result.errors, []);
  assert.equal(result.updated.find(item => item.target === 'codex').mode, 'skills-only');
  const claude = result.updated.find(item => item.target === 'claude');
  assert.equal(await readFile(claude.backup, 'utf8'), original);
  assert.match(claude.warnings.join(' '), /Bare Node hook in Stop/);
  const repaired = await json(file);
  assert.deepEqual(repaired.hooks.Stop, [legacy, legacy]);
  assert.equal(repaired.hooks.SessionStart.length, 2);
  assert.deepEqual(repaired.hooks.SessionStart[0], unrelated);
  for (const event of ['SessionStart', 'UserPromptSubmit']) {
    const hook = repaired.hooks[event].at(-1).hooks[0];
    assert.match(hook.command, /nail\.mjs/);
    assert.equal(Object.hasOwn(hook, 'args'), false);
  }
  const next = await updateInstallations(options);
  assert.equal(next.updated.find(item => item.target === 'claude').backup, undefined);
  assert.deepEqual(await json(file), repaired);
  assert.match((await inspectInstallations(options)).find(item => item.target === 'claude').issues.join(' '), /Bare Node hook in Stop/);
  const cursor = await json(path.join(options.home, '.nail/installations/cursor.json'));
  assert.equal(cursor.reuseClaudeSkills, true);
  assert.equal(cursor.files.length, 1);
});

test('Cursor can reuse installed Claude skills, owns its rule, and detects a missing dependency', async t => {
  const options = await setup(t);
  const reused = { ...options, reuseClaudeSkills: true };
  await assert.rejects(install('cursor', reused), /Install current Nail skills for Claude first/);
  await Promise.all([install('claude', options), install('cursor', options)]);
  const claudeManifest = path.join(options.home, '.nail/installations/claude.json');
  const legacy = await json(claudeManifest);
  const oldSkill = 'Load ordinary context from the current project.';
  await writeFile(legacy.files[1].path, oldSkill);
  legacy.files[1].sha256 = createHash('sha256').update(oldSkill).digest('hex');
  await put(claudeManifest, legacy);
  await assert.rejects(install('cursor', reused), /Install current Nail skills for Claude first/);
  await install('claude', options);
  await install('cursor', reused);
  const cursor = await json(path.join(options.home, '.nail/installations/cursor.json'));
  assert.equal(cursor.files.length, 1);
  assert.match(cursor.files[0].path, /nail-performance-review\.mdc$/);
  await access(cursor.files[0].path);
  await assert.rejects(access(path.join(options.home, '.cursor/skills/nail-performance-review-track/SKILL.md')), { code: 'ENOENT' });
  await uninstall('claude', options);
  assert.match((await inspectInstallations(options)).find(item => item.target === 'cursor').issues.join('\n'), /missing, old, or edited Claude skills/);
  await uninstall('cursor', options);
  await assert.rejects(access(cursor.files[0].path), { code: 'ENOENT' });
});

test('installer preserves a linked host settings directory', async t => {
  const options = await setup(t);
  const linked = path.join(options.home, '.claude');
  const actual = path.join(options.home, 'managed-settings');
  await put(path.join(actual, 'settings.json'), { ownedByUser: true });
  await symlink(actual, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(install('claude', options), /Symbolic link/);
  assert.equal((await lstat(linked)).isSymbolicLink(), true);
  assert.deepEqual(await json(path.join(actual, 'settings.json')), { ownedByUser: true });
});
