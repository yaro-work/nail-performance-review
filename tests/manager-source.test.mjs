import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { claimManagerRefresh, completeManagerRefresh, configureManagerSource, managerRefreshDue, managerSourceStatus, readManagerSources } from '../src/manager-source.mjs';
import { markdown } from '../src/storage.mjs';
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
  await initRecord({ home, root, manual: true });
  const env = { ...process.env, NAIL_HOME: home, NAIL_CONFIG: path.join(home, 'nail/config.json') };
  const cli = (args, input) => JSON.parse(execFileSync(process.execPath, ['bin/nail.mjs', ...args], {
    input: JSON.stringify(input), encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'],
  }));
  return { home, root, workspace, other, cli };
}

test('a recurring manager check is scoped, claimed once, and scheduled from the completed review', async t => {
  const { root, workspace, other } = await setup(t);
  await configureManagerSource(root, { url, kind: 'one-on-one', reviewed: true, revision: 'original' }, { workspace }, date);
  const read = async () => (await readManagerSources(root))[0];
  const source = await read();
  assert.equal(source.intervalDays, 7);
  assert.equal(managerRefreshDue(source, workspace, date + week - 1), false);
  assert.equal(managerRefreshDue(source, other, date + week), false);
  const now = date + week;
  const claims = await Promise.all([claimManagerRefresh(root, { workspace, now }), claimManagerRefresh(root, { workspace, now })]);
  assert.equal(claims.filter(result => result.due).length, 1);
  const claim = claims.find(result => result.due);
  assert.equal(claim.revision, 'original');
  assert.deepEqual(await claimManagerRefresh(root, { now }), { due: false, inProgress: true });
  assert.equal((await read()).lastChecked, date);
  assert.equal(managerRefreshDue(await read(), workspace, now + 60_000), false);
  await assert.rejects(completeManagerRefresh(root, { checkId: 'wrong' }, now), /no longer current/);
  await completeManagerRefresh(root, { checkId: claim.checkId, revision: 'updated' }, now);
  assert.equal((await read()).revision, 'updated');
  assert.equal(managerRefreshDue(await read(), workspace, now + week), true);
  await configureManagerSource(root, { url, intervalDays: 21 }, { workspace }, now);
  assert.equal(managerRefreshDue(await read(), workspace, now + week), false);
  assert.equal(managerRefreshDue(await read(), workspace, now + 3 * week), true);
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
  assert.match(output, /scheduled document check is due/);
  assert.equal(output.includes(url), false);
  assert.equal(output.includes(root), false);
  assert.doesNotMatch(await hook(other), /scheduled document check/);
  assert.doesNotMatch(await hook(workspace, { permission_mode: 'plan' }), /scheduled document check/);
  const promptHook = () => runHook('codex', 'UserPromptSubmit', { cwd: workspace, prompt: 'Check my work' }, { home });
  assert.match(JSON.stringify(await promptHook()), /scheduled document check is due/);
  assert.deepEqual(cli(['manager-source', '--claim', '--tracking', '--cwd', other]), { due: false });
  assert.throws(() => cli(['manager-source', '--claim', '--tracking', '--root', root]), /Invalid manager-source options/);
  const claim = cli(['manager-source', '--claim', '--tracking', '--cwd', workspace]);
  assert.equal(claim.url, url);
  assert.doesNotMatch(await hook(workspace), /scheduled document check/);
  assert.doesNotMatch(JSON.stringify(await promptHook()), /scheduled document check is due/);
  assert.equal(cli(['manager-source', '--disable', '--root', root]).paused, true);
  assert.throws(() => cli(['manager-source', '--checked', '--stdin', '--root', root], { checkId: claim.checkId }), /no longer current/);
  const manual = cli(['manager-source', '--claim', '--root', root]);
  assert.equal(manual.url, url);
  assert.equal(cli(['manager-source', '--checked', '--stdin', '--root', root], { checkId: manual.checkId }).checked, true);
  assert.doesNotMatch(await hook(workspace), /scheduled document check/);
});

test('multiple links keep separate cadences, pauses, and legacy checkpoints', async t => {
  const { home, root, workspace, other, cli } = await setup(t);
  await setTracking({ home, cwd: workspace, name: 'work', enable: true });
  await writeFile(path.join(root, 'manager-source.md'), markdown({
    schema: 1, type: 'manager-source', url, intervalDays: 21, workspace, lastChecked: date, revision: 'old', attempt: null,
  }, '# Legacy'));
  const command = ['manager-source', '--stdin', '--root', root];
  const weekly = cli([...command, '--cwd', workspace], { url: 'https://example.com/weekly', kind: 'one-on-one' });
  const monthly = cli([...command, '--cwd', workspace], { url: 'https://example.com/monthly', reviewed: true });
  assert.equal(weekly.intervalDays, 7);
  assert.ok(weekly.next.includes(`--disable --id ${weekly.id}`));
  assert.equal(monthly.intervalDays, 30);
  const sources = cli(['manager-source', '--root', root]).sources;
  assert.equal(sources.length, 3);
  assert.equal(sources[0].intervalDays, 21);
  assert.equal(sources[0].lastChecked, date);
  const saved = (await readManagerSources(root)).find(source => source.id === monthly.id);
  const month = 30 * 86_400_000;
  assert.equal(managerRefreshDue(saved, workspace, saved.lastChecked + month - 1), false);
  assert.equal(managerRefreshDue(saved, workspace, saved.lastChecked + month), true);
  assert.throws(() => cli(['manager-source', '--claim', '--root', root]), /choose a document source/i);
  assert.throws(() => cli([...command, '--cwd', other], { id: weekly.id, intervalDays: 14 }), /enable tracking/i);
  assert.equal(cli(command, { id: weekly.id, intervalDays: 14 }).intervalDays, 14);
  assert.equal(cli(['manager-source', '--disable', '--id', weekly.id, '--root', root]).paused, true);
  assert.equal(cli(command, { url: 'https://example.com/weekly', kind: 'one-on-one' }).intervalDays, 0);
  assert.equal((await readManagerSources(root)).find(source => source.id === monthly.id).intervalDays, 30);
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

test('failed and interrupted checks yield to other links and back off until one succeeds', async t => {
  const { root, workspace } = await setup(t);
  const first = await configureManagerSource(root, { url, kind: 'one-on-one', reviewed: true, revision: 'old' }, { workspace }, date);
  const second = await configureManagerSource(root, { url: 'https://example.com/goals' }, { workspace }, date);
  const minute = 60_000;
  const day = 24 * 60 * minute;
  const now = date + week + day;
  const claim = (at, id) => claimManagerRefresh(root, { workspace, now: at, id });
  const status = async (id, at) => managerSourceStatus((await readManagerSources(root)).find(source => source.id === id), at);
  const checked = (checkId, outcome, at, extra) => completeManagerRefresh(root, { checkId, outcome, ...extra }, at);

  assert.equal((await status(first.id, now)).status, 'due');
  assert.equal((await status(first.id, now)).lastAttempt, null);
  const firstTry = await claim(now, first.id);
  assert.equal((await status(first.id, now)).status, 'checking');
  const failure = await checked(firstTry.checkId, 'unavailable', now);
  assert.equal(failure.nextCheckAt, now + 15 * minute);
  assert.equal(failure.lastChecked, date);
  assert.equal((await status(first.id, now)).lastAttempt.outcome, 'unavailable');
  assert.equal((await claim(now + 15 * minute - 1, first.id)).due, false);
  const secondTry = await claim(now + 15 * minute, first.id);
  assert.equal(secondTry.revision, 'old');
  const partial = await checked(secondTry.checkId, 'partial', now + 15 * minute);
  assert.equal(partial.nextCheckAt, now + 75 * minute);
  const thirdTry = await claim(now + 75 * minute, first.id);
  assert.equal((await status(first.id, now + 106 * minute)).lastAttempt.outcome, 'interrupted');
  assert.equal((await claim(now + 106 * minute, first.id)).due, false);
  const retryAt = now + 75 * minute + day;
  assert.equal((await claim(retryAt)).id, second.id);
  const retry = await claim(retryAt, first.id);
  assert.notEqual(retry.checkId, thirdTry.checkId);
  await assert.rejects(checked(thirdTry.checkId, 'unchanged', retryAt), /no longer current/);
  const success = await checked(retry.checkId, 'updated', retryAt, { revision: 'new', summary: 'Updated the release target.' });
  assert.equal(success.nextCheckAt, retryAt + week);
  assert.equal((await claim(retryAt + day, first.id)).due, false);
  const later = await claim(retryAt + week, first.id);
  await checked(later.checkId, 'unchanged', retryAt + week, { revision: 'new' });
  const final = await status(first.id, retryAt + week);
  assert.equal(final.lastAttempt.outcome, 'unchanged');
  assert.equal(final.lastChange.summary, 'Updated the release target.');
});

test('private URL lookup identifies otherwise identical links without opening them', async t => {
  const { root, workspace, home, cli } = await setup(t);
  await setTracking({ home, cwd: workspace, name: 'work', enable: true });
  const setupArgs = ['manager-source', '--stdin', '--root', root, '--cwd', workspace];
  const secondUrl = 'https://example.com/another-document';
  const first = cli(setupArgs, { url });
  const second = cli(setupArgs, { url: secondUrl });
  assert.notEqual(first.id, second.id);
  const lookup = cli(['manager-source', '--lookup', '--stdin', '--root', root], { url: secondUrl });
  assert.equal(lookup.id, second.id);
  assert.equal(lookup.lastAttempt, null);
  assert.doesNotMatch(JSON.stringify(lookup), /example\.com/);
  assert.equal(cli(['manager-source', '--disable', '--id', lookup.id, '--root', root]).paused, true);
  const { sources } = cli(['manager-source', '--root', root]);
  assert.deepEqual(sources.map(source => source.intervalDays), [30, 0]);
});
