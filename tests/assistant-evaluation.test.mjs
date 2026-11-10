import test from 'node:test';
import assert from 'node:assert/strict';
import { grade } from '../scripts/assistant-evaluation.mjs';

const record = { id: 'entry-1', contribution: 'Reviewed the plan.', collaborators: ['Avery'], metrics: [], links: ['https://example.com/pr/123'] };
const expected = { active: 1, history: 1, contribution: 'review', collaborator: 'Avery', metrics: 0 };
const observation = () => ({ sandbox: 'workspace-write', completed: true, injectedContext: true, hooks: [{ event: 'SessionStart', ok: true, context: true }], active: [record], history: [record], messages: 'Saved entry-1.', commandResults: [], packet: '', before: 'same', after: 'same', file: '' });

test('a polished capture claim cannot pass without a saved record', () => {
  const observed = observation(); observed.active = []; observed.history = [];
  const result = grade(expected, observed);
  assert.equal(result.status, 'fail');
  assert.ok(result.checks.some(c => c.name === 'active record count' && !c.pass));
});
test('hook self-report cannot replace a native hook receipt', () => {
  const observed = observation(); observed.hooks = []; observed.messages += ' The startup hook worked.';
  assert.equal(grade(expected, observed).status, 'fail');
});
test('bad credit, invented metrics, and missing references fail independently', () => {
  for (const change of [{ contribution: 'Built the service alone.' }, { collaborators: [] }, { metrics: [{ value: 90 }] }, { links: [] }]) {
    const observed = observation(); observed.active = [{ ...record, ...change }];
    assert.equal(grade(expected, observed).status, 'fail');
  }
});
test('read-only writes and noisy routine edits fail', () => {
  const observed = { ...observation(), active: [], history: [], before: 'old', after: 'new', messages: 'Saved an achievement.' };
  assert.equal(grade({ active: 0, history: 0, unchanged: true }, observed).status, 'fail');
  assert.equal(grade({ active: 0, history: 0, quiet: true }, observed).status, 'fail');
});
test('correct evidence and native delivery pass while incomplete turns fail', () => {
  assert.equal(grade(expected, observation()).status, 'pass');
  assert.equal(grade(expected, { ...observation(), completed: false }).status, 'fail');
});
test('wrong runtime permissions are inconclusive rather than a product failure', () => {
  assert.equal(grade(expected, { ...observation(), sandbox: 'read-only' }).status, 'inconclusive');
});
test('an unrelated successful command cannot stand in for reading a review packet', () => {
  const observed = { ...observation(), commandResults: [{ command: 'echo review', exitCode: 0, output: '# Self-review evidence packet entry-1' }] };
  assert.equal(grade({ ...expected, packet: true }, observed).status, 'fail');
  observed.commandResults[0].command = 'node bin/nail.mjs review';
  assert.equal(grade({ ...expected, packet: true }, observed).status, 'pass');
  observed.commandResults[0].exitCode = 1;
  assert.equal(grade({ ...expected, packet: true }, observed).status, 'fail');
});
test('an obsolete Nail Stop hook fails the evaluation', () => {
  const observed = observation(); observed.hooks.push({ event: 'Stop', ok: true, empty: true });
  assert.equal(grade(expected, observed).status, 'fail');
});
