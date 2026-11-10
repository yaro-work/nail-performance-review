import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { claimManagerRefresh, completeManagerRefresh, configureManagerSource, managerRefreshDue, readManagerSource } from '../src/manager-source.mjs';
import { initRecord } from '../src/records.mjs';
import { setTracking } from '../src/config.mjs';
import { runHook } from '../src/hooks.mjs';

const url = 'https://example.com/private-manager-document';
const week = 7 * 86_400_000;
const date = Date.parse('2026-11-01T00:00:00Z');

async function setup(t) {
  const base = path.resolve('.test-data');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, 'manager-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const home = path.join(directory, 'home');
  const root = path.join(directory, 'record');
  const workspace = path.join(directory, 'workspace');
  const other = path.join(directory, 'other');
  await Promise.all([mkdir(workspace), mkdir(other)]);
  await initRecord({ home, root });
  const env = { ...process.env, NAIL_HOME: home, NAIL_CONFIG: path.join(home, 'nail/config.json') };
  const cli = (args, input) => JSON.parse(execFileSync(process.execPath, ['bin/nail.mjs', ...args], {
    input: JSON.stringify(input), encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'],
  }));
  return { home, root, workspace, other, cli };
}

test('a recurring manager check is scoped, claimed once, and scheduled from the completed review', async t => {
  const { root, workspace, other } = await setup(t);
  await configureManagerSource(root, { url, intervalDays: 7, reviewed: true, revision: 'original' }, workspace, date);
  const source = await readManagerSource(root);
  assert.equal(managerRefreshDue(source, workspace, date + week - 1), false);
  assert.equal(managerRefreshDue(source, other, date + week), false);
  const now = date + week;
  const claims = await Promise.all([claimManagerRefresh(root, { workspace, now }), claimManagerRefresh(root, { workspace, now })]);
  assert.equal(claims.filter(result => result.due).length, 1);
  const claim = claims.find(result => result.due);
  assert.equal(claim.revision, 'original');
  assert.deepEqual(await claimManagerRefresh(root, { now }), { due: false, inProgress: true });
  assert.equal((await readManagerSource(root)).lastChecked, date);
  assert.equal(managerRefreshDue(await readManagerSource(root), workspace, now + 60_000), false);
  await assert.rejects(completeManagerRefresh(root, { checkId: 'wrong' }, now), /no longer current/);
  await completeManagerRefresh(root, { checkId: claim.checkId, revision: 'updated' }, now);
  assert.equal((await readManagerSource(root)).revision, 'updated');
  assert.equal(managerRefreshDue(await readManagerSource(root), workspace, now + week), true);
  await configureManagerSource(root, { url, intervalDays: 21 }, workspace, now);
  assert.equal(managerRefreshDue(await readManagerSource(root), workspace, now + week), false);
  assert.equal(managerRefreshDue(await readManagerSource(root), workspace, now + 3 * week), true);
  const manual = await Promise.all([claimManagerRefresh(root, { now }), claimManagerRefresh(root, { now })]);
  assert.equal(manual.filter(result => result.due).length, 1);
});

test('the CLI and hooks disclose a manager document only to the opted-in claim and can pause it', async t => {
  const { home, root, workspace, other, cli } = await setup(t);
  const options = { home, name: 'work', enable: true };
  const flags = ['manager-source', '--stdin', '--root', root, '--cwd', workspace];
  assert.throws(() => cli(flags, { url, intervalDays: 7 }), /enable tracking/i);
  assert.throws(() => cli(flags, { url: 'https://me:secret@example.com', intervalDays: 0 }), /without credentials/);
  await setTracking({ ...options, cwd: workspace });
  await setTracking({ ...options, cwd: other });
  assert.equal(cli(flags, { url, intervalDays: 21 }).intervalDays, 21);
  const status = cli(['manager-source', '--root', root]);
  assert.equal(JSON.stringify(status).includes(url), false);
  const hook = async (cwd, extra = {}) => JSON.stringify(await runHook('codex', 'SessionStart', { cwd, ...extra }, { home }));
  const output = await hook(workspace);
  assert.match(output, /manager document check is due/);
  assert.equal(output.includes(url), false);
  assert.equal(output.includes(root), false);
  assert.doesNotMatch(await hook(other), /manager document check/);
  assert.doesNotMatch(await hook(workspace, { permission_mode: 'plan' }), /manager document check/);
  assert.deepEqual(cli(['manager-source', '--claim', '--tracking', '--cwd', other]), { due: false });
  assert.throws(() => cli(['manager-source', '--claim', '--tracking', '--root', root]), /Invalid manager-source options/);
  const claim = cli(['manager-source', '--claim', '--tracking', '--cwd', workspace]);
  assert.equal(claim.url, url);
  assert.doesNotMatch(await hook(workspace), /manager document check/);
  assert.equal(cli(['manager-source', '--disable', '--root', root]).paused, true);
  assert.throws(() => cli(['manager-source', '--checked', '--stdin', '--root', root], { checkId: claim.checkId }), /no longer current/);
  const manual = cli(['manager-source', '--claim', '--root', root]);
  assert.equal(manual.url, url);
  assert.equal(cli(['manager-source', '--checked', '--stdin', '--root', root], { checkId: manual.checkId }).checked, true);
  assert.doesNotMatch(await hook(workspace), /manager document check/);
});

test('merging new targets keeps unrelated goals and evidence linked to the ongoing goal', async t => {
  const { root, cli } = await setup(t);
  const goal = { id: 'reliability', title: 'Improve service reliability', description: 'Baseline recovery time.' };
  const growth = { id: 'growth', title: 'Coach a colleague' };
  cli(['goals', '--stdin', '--root', root], { items: [goal, growth] });
  const evidence = cli(['record', '--stdin', '--root', root], {
    project: 'rollout', date: '2026-05-01', goals: [goal.id], source: 'test', state: 'delivered',
    basis: 'reported', contribution: 'Documented recovery steps.',
  });
  const items = cli(['goals', '--stdin', '--root', root], { merge: true, items: [
    { ...goal, description: 'Baseline recovery time, then cut it to 15 minutes.' },
  ] }).items;
  assert.deepEqual(items.map(item => item.id), [goal.id, growth.id]);
  assert.match(items[0].description, /15 minutes/);
  assert.match(await readFile(evidence.file, 'utf8'), /Documented recovery steps/);
  assert.equal(cli(['doctor', '--root', root]).ok, true);
});
