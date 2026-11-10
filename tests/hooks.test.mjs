import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initRecord } from '../src/records.mjs';
import { runHook } from '../src/hooks.mjs';
import { setTracking } from '../src/config.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

async function setup(t) {
  const base = path.resolve('.test-data');
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, 'hooks-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const options = { root: path.join(dir, 'performance'), home: path.join(dir, 'home'), name: 'work', role: 'Engineer', timezone: 'UTC', start: '2026-01-01', end: '2026-12-31' };
  await initRecord(options);
  const workspace = path.join(dir, 'workspace');
  await mkdir(workspace);
  return { ...options, workspace };
}

for (const [target, event] of [['codex', 'SessionStart'], ['claude', 'SessionStart'], ['cursor', 'sessionStart'], ['gemini', 'SessionStart']]) {
  test(`${target} activates only opted-in workspaces without injecting record data`, async (t) => {
    const options = await setup(t);
    const payload = target === 'cursor' ? { workspace_roots: [options.workspace] } : { cwd: options.workspace };
    await writeFile(path.join(options.workspace, '.nail.json'), '{"schema":1,"record":"work"}');
    await writeFile(path.join(options.root, 'manager-notes.md'), 'sensitive-sentinel');
    assert.deepEqual(await runHook(target, event, payload, options), {});
    await setTracking({ ...options, cwd: options.workspace, enable: true });
    const output = await runHook(target, event, payload, options);
    const context = target === 'cursor' ? output.additional_context : output.hookSpecificOutput.additionalContext;
    assert.match(context, /nail-performance-review is active/);
    assert.match(context, /context --tracking/);
    assert.doesNotMatch(context, /sensitive-sentinel|Engineer|Goal data/);
    assert.equal(context.includes(options.root), false);
    assert.equal(Object.hasOwn(output, 'continue'), false);
    assert.equal(Object.hasOwn(output, 'decision'), false);
    assert.equal(Object.hasOwn(output, 'followup_message'), false);
    assert.deepEqual(await runHook(target, event, {}, options), {});
    const child = path.join(options.workspace, 'child');
    await mkdir(child);
    assert.deepEqual(await runHook(target, event, { cwd: child, workspace_roots: [child] }, options), {});
    assert.deepEqual(await runHook(target, event, { ...payload, workspace_roots: [options.workspace, child] }, options), {});
    await setTracking({ ...options, cwd: options.workspace, enable: false });
    assert.deepEqual(await runHook(target, event, payload, options), {});
  });
}

test('end hooks never retry, block, or ingest a supplied transcript', async (t) => {
  const options = await setup(t);
  for (const [target, event] of [['codex', 'Stop'], ['claude', 'Stop'], ['cursor', 'stop'], ['gemini', 'AfterAgent']]) {
    assert.deepEqual(await runHook(target, event, { transcript_path: path.join(options.root, 'profile.md'), last_assistant_message: 'Claimed a million dollars.', stop_hook_active: true }, options), {});
  }
  assert.equal((await readFile(path.join(options.root, 'profile.md'), 'utf8')).includes('million dollars'), false);
});

for (const [target, event] of [['claude', 'UserPromptSubmit'], ['codex', 'UserPromptSubmit'], ['gemini', 'BeforeAgent']]) {
  test(`${target} reminds on ordinary work prompts without copying prompt text or widening opt-in`, async t => {
    const options = await setup(t);
    const check = (prompt, extra = {}) => runHook(target, event, {
      cwd: options.workspace, prompt, session_id: 'opaque-session-id', transcript_path: 'never-read.jsonl', ...extra,
    }, options);
    const prompt = 'Why is private-project failing only in staging?';
    assert.deepEqual(await check(prompt), {});
    await setTracking({ ...options, cwd: options.workspace, enable: true });
    const result = await check(prompt);
    assert.deepEqual(Object.keys(result), ['hookSpecificOutput']);
    assert.equal(result.hookSpecificOutput.hookEventName, event);
    assert.match(result.hookSpecificOutput.additionalContext, /quick fix or diagnosis.*sessionId.*opaque-session-id/);
    assert.doesNotMatch(JSON.stringify(result), /private-project|staging|never-read/);
    assert.doesNotMatch(JSON.stringify(await check(prompt, { session_id: '/private/path' })), /private\/path/);
    for (const invalid of ['/done', '  ', null]) assert.deepEqual(await check(invalid), {});
    assert.deepEqual(await check(prompt, { permission_mode: 'plan' }), {});
    assert.deepEqual(await check(prompt, { workspace_roots: [options.workspace] }), {});
    await setTracking({ ...options, cwd: options.workspace, enable: false });
    assert.deepEqual(await check(prompt), {});
  });
}

test('tracking status distinguishes an exact opted-in folder from a subfolder', async t => {
  const options = await setup(t);
  const child = path.join(options.workspace, 'child');
  await mkdir(child);
  const cli = path.resolve('bin/nail.mjs');
  const env = { ...process.env, NAIL_HOME: options.home, NAIL_CONFIG: path.join(options.home, 'nail/config.json') };
  const status = cwd => JSON.parse(execFileSync(process.execPath, [cli, 'tracking', '--status', '--cwd', cwd], { encoding: 'utf8', env }));
  assert.equal(status(options.workspace).enabled, false);
  await setTracking({ ...options, cwd: options.workspace, enable: true });
  assert.deepEqual(status(options.workspace), { workspace: options.workspace, enabled: true, record: 'work' });
  assert.equal(status(child).enabled, false);
});

test('one all-folder choice reaches new folders across hosts and honors exclusions and overrides', async t => {
  const options = await setup(t);
  const { workspace, home, root } = options;
  const privateFolder = path.join(workspace, 'private');
  const child = path.join(privateFolder, 'child');
  const neighbor = path.join(workspace, 'private-copy');
  const otherRoot = path.join(home, 'other-performance');
  const cli = path.resolve('bin/nail.mjs');
  const env = { ...process.env, NAIL_HOME: home, NAIL_CONFIG: path.join(home, 'nail/config.json') };
  const call = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', env });
  const status = cwd => JSON.parse(call('tracking', '--status', '--cwd', cwd));
  await initRecord({ ...options, root: otherRoot, name: 'other' });
  assert.equal(JSON.parse(call('tracking', '--status', '--all')).enabled, false);
  assert.equal(status(workspace).enabled, false);
  call('tracking', '--enable', '--all', '--name', 'work');
  await mkdir(child, { recursive: true });
  await mkdir(neighbor);
  await writeFile(path.join(neighbor, '.nail.json'), '{"schema":1,"record":"other"}');
  assert.equal(status(neighbor).record, 'work');
  assert.match(call('context', '--tracking', '--cwd', neighbor), /Private record directory:/);
  assert.ok(call('context', '--tracking', '--cwd', neighbor).includes(root));
  for (const [target, event] of [['codex', 'SessionStart'], ['claude', 'SessionStart'], ['gemini', 'SessionStart']]) {
    assert.ok((await runHook(target, event, { cwd: neighbor }, { home })).hookSpecificOutput.additionalContext);
  }
  const cursor = () => runHook('cursor', 'sessionStart', { workspace_roots: [neighbor, child] }, { home });
  assert.ok((await cursor()).additional_context);
  call('tracking', '--disable', '--cwd', privateFolder);
  assert.equal(status(child).enabled, false);
  assert.deepEqual(await cursor(), {});
  assert.equal(status(neighbor).enabled, true);
  call('tracking', '--enable', '--name', 'other', '--cwd', child);
  assert.equal(status(child).record, 'other');
  assert.deepEqual(await cursor(), {});
  call('tracking', '--disable', '--all');
  assert.equal(status(neighbor).enabled, false);
  assert.equal(status(child).enabled, true);
  call('tracking', '--enable', '--all', '--name', 'work');
  assert.equal(status(privateFolder).enabled, false);
  call('tracking', '--enable', '--name', 'work', '--cwd', privateFolder);
  assert.equal(status(privateFolder).enabled, true);
  assert.equal(status(child).record, 'other');
  call('tracking', '--reset', '--cwd', child);
  assert.equal(status(child).enabled, false);
  call('tracking', '--reset', '--cwd', privateFolder);
  assert.equal(status(child).record, 'work');
  assert.ok((await cursor()).additional_context);
});

test('missing or broken configuration leaves user work running', async (t) => {
  const options = await setup(t);
  assert.deepEqual(await runHook('codex', 'SessionStart', {}, { root: path.join(options.root, 'missing') }), {});
  await assert.rejects(runHook('unknown', 'SessionStart'), /Unknown hook target/);
});

test('real hook commands emit optional receipts without exposing record content or changing output', async (t) => {
  const options = await setup(t), receipt = path.join(options.home, 'hook-receipts.jsonl');
  await setTracking({ ...options, cwd: options.workspace, enable: true });
  const cli = path.resolve('bin/nail.mjs');
  const env = { ...process.env, NAIL_HOME: options.home, NAIL_CONFIG: path.join(options.home, 'nail/config.json'), NAIL_HOOK_RECEIPTS: receipt };
  for (const event of ['SessionStart', 'Stop']) {
    const stdout = execFileSync(process.execPath, [cli, 'hook', '--target', 'codex', '--event', event], { input: JSON.stringify({ cwd: options.workspace }), encoding: 'utf8', env });
    const output = JSON.parse(stdout);
    const rows = (await readFile(receipt, 'utf8')).trim().split('\n').map(JSON.parse), row = rows.at(-1);
    assert.equal(row.event, event); assert.equal(row.ok, true);
    assert.equal(row.context, event === 'SessionStart');
    assert.equal(row.empty, event === 'Stop');
    assert.equal(row.outputHash, createHash('sha256').update(JSON.stringify(output)).digest('hex'));
    assert.equal(JSON.stringify(row).includes(options.root), false);
  }
  assert.equal(execFileSync(process.execPath, [cli, 'hook', '--target', 'codex', '--event', 'Stop'], { input: 'broken JSON', encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] }).trim(), '{}');
  assert.equal(JSON.parse((await readFile(receipt, 'utf8')).trim().split('\n').at(-1)).ok, false);
  await writeFile(env.NAIL_CONFIG, '{');
  assert.equal(execFileSync(process.execPath, [cli, 'hook', '--target', 'codex', '--event', 'SessionStart'], { input: JSON.stringify({ cwd: options.workspace }), encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] }).trim(), '{}');
  assert.equal(JSON.parse((await readFile(receipt, 'utf8')).trim().split('\n').at(-1)).ok, false);
});
