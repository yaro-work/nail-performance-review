import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, access, rm, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { install, uninstall, inspectInstallations } from '../src/install.mjs';

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
    assert.equal(current.files.length, 4);
    assert.ok(current.files.every(file => path.basename(path.dirname(file.path)).startsWith('nail-performance-review-')));
    for (const file of manifest.files) await assert.rejects(access(file.path), { code: 'ENOENT' });
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
      result = target === 'cursor'
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
  assert.equal(status.verifiedAutomaticCapture, false);
});
