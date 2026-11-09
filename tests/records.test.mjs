import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fixture, evidence } from './fixtures.mjs';
import { saveEvidence, listEvidence, doctor, exportBundle, importBundle, updateDocument } from '../src/records.mjs';
import { markdown } from '../src/storage.mjs';

test('records preserve attribution, replay idempotently, and retain distinct contributions on one PR', async t => {
  const { root } = await fixture(t);
  const record = await saveEvidence(root, evidence({ eventId: 'session-1:retry' }));
  assert.equal((await saveEvidence(root, evidence({ eventId: 'session-1:retry' }))).duplicate, true);
  await saveEvidence(root, evidence({ eventId: 'session-1:docs', contribution: 'Wrote the migration guide.' }));
  const records = await listEvidence(root);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0].collaborators, ['Alex']);
  assert.equal(records.find(item => item.id === record.id).outcome, 'The team shipped the migration.');
  await assert.rejects(saveEvidence(root, evidence({ eventId: 'session-1:retry', outcome: 'Changed claim' })), /different content/);
});
test('solo work round-trips with omitted or empty collaborators', async t => {
  const { root } = await fixture(t);
  const input = evidence(); delete input.collaborators;
  const saved = await saveEvidence(root, input);
  assert.deepEqual((await listEvidence(root))[0].collaborators, []);
  assert.equal((await doctor(root)).ok, true);
  await saveEvidence(root, evidence({ collaborators: [], contribution: 'Published the solo analysis.' }));
  assert.equal((await listEvidence(root)).length, 2);
  assert.ok(saved.id);
});
test('normalizes narrative whitespace before saving and replaying an event', async t => {
  const { root } = await fixture(t);
  const input = evidence({ eventId: 'whitespace', contribution: ' Reviewed the plan. ', outcome: ' Shipped together. ', collaborators: [' Avery '] });
  await saveEvidence(root, input);
  assert.equal((await saveEvidence(root, input)).duplicate, true);
  const [saved] = await listEvidence(root);
  assert.equal(saved.contribution, 'Reviewed the plan.');
  assert.deepEqual(saved.collaborators, ['Avery']);
});
test('persisted evidence must keep its stable identity', async t => {
  const { root } = await fixture(t);
  const saved = await saveEvidence(root, evidence());
  const content = await fs.readFile(saved.file, 'utf8');
  await fs.writeFile(saved.file, content.replace(/\s*"id": "[a-f0-9-]+",?/, ''));
  const status = await doctor(root);
  assert.equal(status.ok, false);
  await assert.rejects(listEvidence(root), /id|identity/i);
});
test('UUID case variants cannot overwrite or duplicate an existing achievement', async t => {
  const { root } = await fixture(t);
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await saveEvidence(root, evidence({ id }));
  assert.equal((await saveEvidence(root, evidence({ id: id.toUpperCase() }))).duplicate, true);
  await assert.rejects(saveEvidence(root, evidence({ id: id.toUpperCase(), contribution: 'Different claim' })), /different content/);
  assert.equal((await listEvidence(root)).length, 1);
});
test('corrections replace claims in reports, keep originals, and reject conflicting branches', async t => {
  const { root } = await fixture(t);
  const original = await saveEvidence(root, evidence());
  const correction = await saveEvidence(root, evidence({ supersedes: original.id, contribution: 'Reviewed the retry strategy with Alex.' }), { amendment: true });
  assert.equal((await listEvidence(root))[0].id, correction.id);
  assert.equal((await listEvidence(root, { includeSuperseded: true })).length, 2);
  await assert.rejects(saveEvidence(root, evidence({ supersedes: original.id }), { amendment: true }), /already has a correction/);
  assert.equal((await doctor(root)).ok, true);
});
test('invalid evidence and unknown goals write nothing', async t => {
  const { root } = await fixture(t);
  for (const changes of [{ project: '../escape' }, { date: '2026-02-30' }, { goals: ['missing'] }, { links: ['javascript:alert(1)'] }, { state: 'measured' }, { metrics: [{ name: 'Time', before: 1, after: Infinity, unit: 's', source: 'https://example.com', measuredAt: '2026-05-10' }] }]) await assert.rejects(saveEvidence(root, evidence(changes)));
  assert.equal((await listEvidence(root)).length, 0);
});
test('goal updates cannot orphan historical evidence and doctor detects invalid manual goal edits', async t => {
  const { root } = await fixture(t);
  await saveEvidence(root, evidence());
  await assert.rejects(updateDocument(root, 'goals', { items: [] }), /has evidence/);
  await updateDocument(root, 'goals', { items: [{ id: 'reliability', title: 'Improve reliability', status: 'completed' }] });
  assert.equal((await doctor(root)).ok, true);
  const file = path.join(root, 'goals.md');
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('"completed"', '"invented"'));
  assert.equal((await doctor(root)).ok, false);
});
test('direct narrative edits are authoritative and malformed edits are diagnosed', async t => {
  const { root } = await fixture(t);
  const saved = await saveEvidence(root, evidence());
  const content = await fs.readFile(saved.file, 'utf8');
  await fs.writeFile(saved.file, content.replace('Designed the retry strategy.', 'Co-designed the retry strategy.'));
  assert.equal((await listEvidence(root))[0].contribution, 'Co-designed the retry strategy.');
  await fs.writeFile(saved.file, 'broken metadata');
  assert.equal((await doctor(root)).ok, false);
});
test('handoff imports validate before writing and include correction ancestors outside the requested period', async t => {
  const { root, base, home } = await fixture(t);
  const original = await saveEvidence(root, evidence({ date: '2025-12-31', eventId: 'old' }));
  await saveEvidence(root, evidence({ date: '2026-05-10', supersedes: original.id, eventId: 'new', contribution: 'Corrected contribution' }), { amendment: true });
  const bundle = await exportBundle(root, { start: '2026-01-01', end: '2026-12-31' });
  const { initRecord } = await import('../src/records.mjs');
  const destination = path.join(base, 'second');
  await initRecord({ root: destination, home, name: 'second', timezone: 'UTC' });
  await updateDocument(destination, 'goals', { items: [{ id: 'reliability', title: 'Reliability' }] });
  assert.deepEqual(await importBundle(destination, bundle), { imported: 2, duplicates: 0 });
  assert.deepEqual(await importBundle(destination, bundle), { imported: 0, duplicates: 2 });
  assert.equal((await listEvidence(destination)).length, 1);
  const invalid = markdown({ schema: 1, type: 'bundle', records: [evidence({ id: '11111111-1111-4111-8111-111111111111' }), evidence({ goals: ['unknown'] })] }, '# Handoff');
  await assert.rejects(importBundle(destination, invalid));
  assert.equal((await listEvidence(destination, { includeSuperseded: true })).length, 2);
});
