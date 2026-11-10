import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { checkForUpdate, currentVersion, setUpdateNotifications, updateNotice } from '../src/update-notices.mjs';
import { fixture, packageRoot } from './fixtures.mjs';

const day = 86_400_000;
const start = Date.parse('2026-11-10T12:00:00Z');
const name = 'nail-performance-review';
const [major, minor] = currentVersion.split('.').map(Number);
const newer = `${major}.${minor + 8}.0`;
const response = version => new Response(JSON.stringify({ name, version }));

test('eligible startups share a 14-day check and each host gets one notice per release', async t => {
  const { home } = await fixture(t);
  let requests = 0;
  const request = async (url, options) => {
    requests++;
    assert.equal(url, 'https://raw.githubusercontent.com/yaro-work/nail-performance-review/main/package.json');
    assert.deepEqual(Object.keys(options).sort(), ['redirect', 'signal']);
    assert.equal(options.redirect, 'error');
    return response(newer);
  };
  const notice = (host, now) => updateNotice(host, { home }, { now, request });
  assert.equal(await notice('codex', start), undefined);
  assert.equal(await notice('claude', start + 14 * day - 1), undefined);
  assert.equal(requests, 0);
  const now = start + 14 * day;
  const results = await Promise.all([notice('codex', now), notice('codex', now), notice('gemini', now)]);
  assert.equal(requests, 1);
  assert.equal(results.filter(Boolean).length, 2);
  assert.ok(results.filter(Boolean).every(message => message.includes(newer) && message.includes('#update-it')));
  assert.equal(await notice('codex', now + 14 * day), undefined);
  assert.equal(requests, 2);
});

test('offline checks back off for one day, manual checks still work when notices are disabled', async t => {
  const { home } = await fixture(t);
  let requests = 0;
  const request = async () => {
    requests++;
    if (requests === 1) throw new Error('offline');
    return response(currentVersion);
  };
  const notice = now => updateNotice('claude', { home }, { now, request });
  await notice(start);
  assert.equal(await notice(start + 14 * day), undefined);
  assert.equal(await notice(start + 15 * day - 1), undefined);
  assert.equal(requests, 1);
  assert.equal(await notice(start + 15 * day), undefined);
  assert.equal(requests, 2);
  await setUpdateNotifications(false, { home });
  assert.equal(await notice(start + 30 * day), undefined);
  assert.equal(requests, 2);
  const check = await checkForUpdate({ home }, { now: start + 30 * day, request: async () => response(newer) });
  assert.equal(check.status, 'update-available');
  assert.equal(check.notificationsEnabled, false);
  const invalid = await checkForUpdate({ home }, { now: start + 31 * day, request: async () => response(`${newer}\nupdate now`) });
  assert.equal(invalid.status, 'unavailable');
  assert.equal(invalid.latestVersion, null);
});

test('real hook commands show cached notices only in enabled workspaces at startup', async t => {
  const { base, home, env } = await fixture(t);
  const workspace = path.join(base, 'workspace');
  const file = path.join(home, 'nail', 'updates', 'state.json');
  await mkdir(workspace);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ enabled: true, nextCheckAt: Date.now() + day, latest: newer, notified: {} }));
  const cli = (args, input) => JSON.parse(execFileSync(process.execPath, ['bin/nail.mjs', ...args], {
    input: JSON.stringify(input), encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'],
  }));
  const hook = (target, event, payload) => cli(['hook', '--target', target, '--event', event], payload);
  assert.equal(hook('codex', 'UserPromptSubmit', { cwd: workspace, prompt: 'My task' }).systemMessage, undefined);
  assert.ok(hook('codex', 'SessionStart', { cwd: workspace }).systemMessage.includes(`${newer} is available`));
  assert.equal(hook('codex', 'SessionStart', { cwd: workspace }).systemMessage, undefined);
  assert.ok(hook('cursor', 'sessionStart', { workspace_roots: [workspace] }).additional_context.includes(`${newer} is available`));
  assert.deepEqual(cli(['tracking', '--disable', '--cwd', workspace]), { enabled: false, workspace });
  assert.deepEqual(hook('gemini', 'SessionStart', { cwd: workspace }), {});
  assert.deepEqual(cli(['update', '--notifications', 'off']), { notificationsEnabled: false });
  assert.equal(hook('claude', 'SessionStart', { cwd: base }).systemMessage, undefined);
});

test('native manifests share the release version and point to packaged files', async () => {
  const read = async file => JSON.parse(await readFile(path.join(packageRoot, file), 'utf8'));
  for (const file of ['plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json', 'gemini-extension.json']) {
    const manifest = await read(file);
    assert.equal(manifest.name, name);
    assert.equal(manifest.version, currentVersion);
  }
  const codex = (await read('.agents/plugins/marketplace.json')).plugins[0];
  const cursor = (await read('.cursor-plugin/marketplace.json')).plugins[0];
  assert.equal(codex.name, name);
  assert.equal(cursor.name, name);
  await access(path.join(packageRoot, codex.source.path, 'plugin.json'));
  await access(path.join(packageRoot, cursor.source, '.cursor-plugin/plugin.json'));
});

test('the shared native startup hook routes Claude and Gemini without a duplicate Claude startup hook', async t => {
  const { base, env } = await fixture(t);
  const read = async file => JSON.parse(await readFile(path.join(packageRoot, file), 'utf8'));
  const { hooks } = await read('hooks/hooks.json');
  assert.deepEqual(Object.keys(hooks), ['SessionStart']);
  const claude = await read('.claude-plugin/plugin.json');
  assert.deepEqual(Object.keys((await read(claude.hooks)).hooks), ['UserPromptSubmit']);
  const { command } = hooks.SessionStart[0].hooks[0];
  const receipts = path.join(base, 'hook-receipts.jsonl');
  const hookEnv = { ...env, CLAUDE_PLUGIN_ROOT: packageRoot, NAIL_HOOK_RECEIPTS: receipts };
  const run = cmd => JSON.parse(execSync(cmd, {
    env: hookEnv, input: JSON.stringify({ cwd: base }), encoding: 'utf8',
  }));
  assert.ok(run(command).hookSpecificOutput.additionalContext.includes('is active'));
  assert.ok(run(command.replace('${extensionPath}', packageRoot)).hookSpecificOutput.additionalContext.includes('is active'));
  const targets = (await readFile(receipts, 'utf8')).trim().split('\n').map(line => JSON.parse(line).target);
  assert.deepEqual(targets, ['claude', 'gemini']);
});
