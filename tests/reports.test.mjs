import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fixture, evidence } from './fixtures.mjs';
import { saveEvidence } from '../src/records.mjs';
import { reviewPacket, period } from '../src/reviews.mjs';
import { htmlReport } from '../src/report.mjs';

test('review packets preserve contributions, collaborators, uncertainty, period boundaries, and snapshot provenance', async t => {
  const { root } = await fixture(t);
  const saved = await saveEvidence(root, evidence({ basis: 'reported', date: '2026-06-30' }));
  await saveEvidence(root, evidence({ date: '2026-07-01' }));
  const packet = await reviewPacket(root, { period: '2026-H1' });
  assert.equal(packet.records.length, 1);
  assert.ok(packet.markdown.includes(saved.id)); assert.ok(packet.markdown.includes('Alex'));
  assert.ok(packet.markdown.includes('reported')); assert.ok(packet.markdown.includes('not measured'));
  assert.match(packet.fingerprint, /^[a-f0-9]{64}$/);
  await assert.rejects(period(root, { start: '2026-12-31', end: '2026-01-01' }));
});
test('offline HTML escapes every narrative and shows goal groups and measurement sources', async t => {
  const { root } = await fixture(t);
  await saveEvidence(root, evidence({ contribution: '<script>alert("x")</script>', state: 'measured', metrics: [{ name: 'Latency', before: 100, after: 60, unit: 'ms', source: 'https://example.com/metrics', measuredAt: '2026-05-10' }] }));
  const { html } = await htmlReport(root, { period: '2026' });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<script src'));
  assert.ok(html.includes('Improve reliability')); assert.ok(html.includes('100 → 60 ms'));
  assert.ok(html.includes('viewport')); assert.ok(html.includes('Measurement source'));
});
test('review packets include full company expectations and manager feedback as reference data', async t => {
  const { root } = await fixture(t);
  const expectations = '# Company expectations\n' + 'Context. '.repeat(400) + '\nTarget role: enable other teams.';
  await fs.writeFile(path.join(root, 'expectations.md'), expectations);
  await fs.writeFile(path.join(root, 'manager-notes.md'), '# Feedback\n2026-05-10: Make handoffs easier to reuse.');
  const packet = await reviewPacket(root, { period: '2026-H1' });
  assert.ok(packet.markdown.includes('Target role: enable other teams.'));
  assert.ok(packet.markdown.includes('Make handoffs easier to reuse.'));
  assert.ok(packet.markdown.includes('reference data'));
});
