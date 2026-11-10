import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

test('quick-session candidates stay private until included, and corrections preserve their origin', async t => {
  const base = path.resolve('.test-data');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, 'inbox-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'record');
  const env = { ...process.env, NAIL_HOME: directory, NAIL_CONFIG: path.join(directory, 'nail/config.json') };
  const run = (args, input) => execFileSync(process.execPath, ['bin/nail.mjs', ...args, '--root', root], {
    input: JSON.stringify(input), encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const cli = (args, input) => JSON.parse(run(args, input));
  cli(['init', '--period', '2026']);
  const work = { date: '2026-10-01', project: 'staging', source: 'codex', state: 'in-progress', basis: 'observed', contribution: 'Reproduced a stale cache error.' };
  const provenance = { reviewStatus: 'candidate', sessionId: 'quick-session-012', context: 'A smoke test failed. Reproducing with a cold cache isolated the cause.' };
  const first = cli(['record', '--stdin'], { ...work, ...provenance, eventId: 'cold-cache' });
  assert.equal(cli(['record', '--stdin'], { ...work, ...provenance, eventId: 'cold-cache' }).duplicate, true);
  const corrected = cli(['amend', '--stdin'], { ...work, supersedes: first.id, state: 'delivered', contribution: 'Diagnosed a stale cache error.' });
  assert.equal(corrected.reviewStatus, 'candidate');
  assert.equal(corrected.sessionId, provenance.sessionId);
  assert.equal(corrected.context, provenance.context);
  assert.deepEqual(cli(['inbox']).map(item => item.id), [corrected.id]);
  const report = path.join(directory, 'report.html'), exported = path.join(directory, 'export.md');
  assert.match(run(['review']), /1 candidate entry/);
  assert.doesNotMatch(run(['review']), /stale cache error/);
  cli(['report', '--output', report]);
  cli(['export', '--output', exported]);
  assert.doesNotMatch(await readFile(report, 'utf8'), /stale cache error/);
  assert.doesNotMatch(await readFile(exported, 'utf8'), /stale cache error/);
  const included = cli(['triage', '--id', corrected.id, '--action', 'include']);
  assert.equal(included.sessionId, provenance.sessionId);
  assert.deepEqual(cli(['inbox']), []);
  assert.match(run(['review']), /Diagnosed a stale cache error/);
  assert.doesNotMatch(run(['review']), /quick-session-012/);
  assert.throws(() => cli(['amend', '--stdin'], { ...work, ...provenance, supersedes: included.id }),
    /already been reviewed/);
  assert.match(run(['review']), /Diagnosed a stale cache error/);
  const excluded = cli(['triage', '--id', included.id, '--action', 'exclude']);
  assert.doesNotMatch(run(['review']), /stale cache error/);
  assert.deepEqual(cli(['inbox', '--action', 'excluded']).map(item => item.id), [excluded.id]);
  assert.throws(() => cli(['record', '--stdin'], { ...work, sessionId: '/a/transcript.jsonl' }), /Invalid session ID/);
  assert.throws(() => cli(['record', '--stdin'], { ...work, context: 'x'.repeat(601) }), /600 characters/);
  assert.equal(cli(['doctor']).ok, true);
});
