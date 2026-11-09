import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.mjs';
import { nudge } from '../src/nudges.mjs';
import { updateDocument, doctor } from '../src/records.mjs';
import { getContext } from '../src/context.mjs';
import { runHook } from '../src/hooks.mjs';
import { readFile, writeFile } from 'node:fs/promises';

test('reminders share session and weekly budgets across tools and do not repeat a reason', async t => {
  const { root } = await fixture(t);
  const options = { project: 'migration', session: 'cursor-1', now: '2026-05-10T12:00:00Z' };
  assert.equal((await nudge(root, options)).shown, true);
  assert.equal((await nudge(root, { ...options, reason: 'outcomes' })).shown, false);
  assert.equal((await nudge(root, { ...options, session: 'claude-2' })).shown, false);
  assert.equal((await nudge(root, { ...options, reason: 'outcomes', session: 'claude-2' })).shown, true);
  assert.equal((await nudge(root, { ...options, reason: 'sharing', session: 'codex-3' })).suppressed, 'weekly-budget');
});
test('snoozes expire and approved exceptions stay quiet until goals change', async t => {
  const { root } = await fixture(t);
  const options = { project: 'migration', session: 'one', now: '2026-05-01T12:00:00Z' };
  await nudge(root, { ...options, action: 'snooze', days: 7 });
  assert.equal((await nudge(root, options)).shown, false);
  assert.equal((await nudge(root, { ...options, now: '2026-05-09T12:00:00Z' })).shown, true);
  await nudge(root, { ...options, action: 'approve' });
  assert.equal((await nudge(root, { ...options, session: 'two', now: '2026-06-01T12:00:00Z' })).shown, false);
  await updateDocument(root, 'goals', { items: [{ id: 'reliability', title: 'A revised objective' }] });
  assert.equal((await nudge(root, { ...options, session: 'two', now: '2026-06-01T12:00:00Z' })).shown, true);
});
test('concurrent reminders cannot exceed the shared weekly budget', async t => {
  const { root } = await fixture(t);
  const results = await Promise.all(['one', 'two', 'three', 'four'].map(project => nudge(root, { project, session: project })));
  assert.equal(results.filter(result => result.shown).length, 2);
});

test('a user choice is saved in Markdown, visible across tools, and suppresses only that alignment question', async t => {
  const { root } = await fixture(t);
  const options = { project: 'community-meetup', session: 'cursor-1' };
  const reminder = await nudge(root, options);
  assert.equal(reminder.shown, true);
  assert.match(reminder.message, /add an agreed goal, or work on it anyway/);
  const note = "That's fine; I want to work on it anyway because I value the community.";
  const saved = await nudge(root, { ...options, action: 'continue', note });
  assert.match(await readFile(saved.file, 'utf8'), /I want to work on it anyway/);
  assert.equal((await nudge(root, { ...options, session: 'claude-2' })).suppressed, 'user-choice');
  for (const [target, event] of [['codex', 'SessionStart'], ['claude', 'SessionStart'], ['cursor', 'sessionStart'], ['gemini', 'SessionStart']]) {
    const result = await runHook(target, event, {}, { root });
    assert.ok((result.additional_context || result.hookSpecificOutput.additionalContext).includes(note));
  }
  assert.equal((await nudge(root, { ...options, session: 'codex-3', reason: 'outcomes' })).shown, true);
  assert.equal((await doctor(root)).ok, true);
  await updateDocument(root, 'goals', { items: [{ id: 'community', title: 'Grow our internal community' }] });
  assert.ok(!(await getContext(root)).includes(note));
  assert.equal((await nudge(root, { ...options, session: 'new-goals', now: '2030-01-01' })).shown, true);
  await writeFile(saved.file, 'broken manual edit');
  assert.equal((await doctor(root)).ok, false);
});

test('continue requires a response and cannot suppress another coaching reason or project', async t => {
  const { root } = await fixture(t);
  const options = { project: 'community-meetup', session: 'one', action: 'continue' };
  await assert.rejects(nudge(root, options), /decision note/);
  await assert.rejects(nudge(root, { ...options, reason: 'sharing', note: 'Continue.' }), /alignment/);
  await nudge(root, { ...options, note: 'Continue.' });
  assert.equal((await nudge(root, { project: 'another-project', session: 'two' })).shown, true);
});
