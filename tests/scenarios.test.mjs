import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fixture, evidence, packageRoot } from './fixtures.mjs';

function runner(env) {
  return async (args, input) => {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(packageRoot, 'bin/nail.mjs'), ...args], { env, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', error = '';
      child.stdout.on('data', value => output += value); child.stderr.on('data', value => error += value);
      child.on('error', reject); child.on('close', code => resolve({ code, output, error }));
      child.stdin.end(input === undefined ? '' : JSON.stringify(input));
    });
    assert.equal(result.code, 0, result.error);
    return result.output;
  };
}
const json = text => JSON.parse(text);

test('scenario: ABCD milestones connect migration evidence to a Staff growth goal', async t => {
  const { root, env } = await fixture(t);
  const run = runner(env);
  await run(['profile', '--stdin'], { role: 'Software engineer', level: 'Senior', promotion: true, targetLevel: 'Staff' });
  await run(['goals', '--stdin'], { items: [{ id: 'migration', title: 'Migrate Google Cloud to AWS' }, { id: 'growth', title: 'Develop Staff-level technical influence' }] });
  await run(['project', '--stdin'], { id: 'abcd', title: 'Redesigning infrastructure of app ABCD', goals: ['migration', 'growth'] });
  const startup = json(await run(['hook', '--target', 'codex', '--event', 'SessionStart'], { cwd: root }));
  assert.ok(startup.hookSpecificOutput.additionalContext.includes('Migrate Google Cloud to AWS'));
  assert.ok(startup.hookSpecificOutput.additionalContext.includes('Staff'));
  const draft = json(await run(['record', '--stdin'], evidence({ date: '2026-02-07', project: 'abcd', goals: ['migration'], state: 'in-progress', contribution: 'Implemented the first staged rollout with Avery.', outcome: 'The first service runs successfully in AWS.', collaborators: ['Avery'] })));
  assert.equal(draft.state, 'in-progress');
  const reminder = json(await run(['nudge', '--project', 'abcd', '--session', 'delivery-check-in', '--reason', 'outcomes']));
  assert.equal(reminder.shown, true);
  assert.equal(json(await run(['nudge', '--project', 'abcd', '--session', 'delivery-check-in', '--reason', 'sharing'])).shown, false);
  const metric = { name: 'p95 database latency', before: 100, after: 50, unit: 'ms', source: 'https://example.com/observability/abcd', measuredAt: '2026-02-14' };
  await run(['record', '--stdin'], evidence({ date: '2026-02-14', project: 'abcd', goals: ['migration'], state: 'measured', basis: 'reported', contribution: 'Validated the rollout with Avery under comparable load.', outcome: 'The linked measurements show p95 latency falling from 100 ms to 50 ms.', collaborators: ['Avery'], metrics: [metric] }));
  assert.equal((metric.before - metric.after) / metric.before, 0.5);
  const sharing = json(await run(['nudge', '--project', 'abcd', '--session', 'results-check-in', '--reason', 'sharing']));
  assert.equal(sharing.shown, true);
  assert.equal(json(await run(['nudge', '--project', 'abcd', '--session', 'another-check-in', '--reason', 'alignment'])).shown, false);
  const packet = await run(['review', '--period', '2026-H1']);
  for (const value of ['Staff', 'Develop Staff-level technical influence', 'p95 database latency', 'https://example.com/observability/abcd']) assert.ok(packet.includes(value), value);
  const report = json(await run(['report', '--period', '2026-H1']));
  assert.ok((await fs.readFile(report.output, 'utf8')).includes('100 → 50 ms'));
});

test('scenario: a designer records work and prepares a review and HTML', async t => {
  const { root, env } = await fixture(t);
  const run = runner(env);
  await run(['profile', '--stdin'], { role: 'Product designer', level: 'Senior', promotion: true, targetLevel: 'Lead designer' });
  await run(['goals', '--stdin'], { items: [{ id: 'onboarding', title: 'Clarify customer onboarding' }] });
  await run(['project', '--stdin'], { id: 'research', title: 'Customer onboarding research', goals: ['onboarding'] });
  const record = json(await run(['record', '--stdin'], evidence({ project: 'research', goals: ['onboarding'], source: 'manual', basis: 'reported', contribution: 'Synthesized research with Alex.', outcome: 'The team agreed which onboarding questions to address.' })));
  const packet = await run(['review', '--period', '2026-H1']);
  for (const value of [record.id, 'Product designer', 'Lead designer', 'Clarify customer onboarding', 'Synthesized research with Alex.', 'quantitative impact not measured']) assert.ok(packet.includes(value), value);
  const report = json(await run(['report', '--start', '2026-01-01', '--end', '2026-06-30']));
  const html = await fs.readFile(report.output, 'utf8');
  assert.ok(html.includes('Synthesized research with Alex.'));
  assert.ok(html.includes('Clarify customer onboarding'));
  assert.equal(json(await run(['doctor'])).ok, true);
  assert.ok((await fs.readFile(path.join(root, 'expectations.md'), 'utf8')).includes('Provisional'));
});

test('scenario: four adapters share a bound record and another employer stays separate', async t => {
  const { root, env, base } = await fixture(t);
  const run = runner(env);
  const projects = [path.join(base, 'project-a'), path.join(base, 'project-b')];
  for (const cwd of projects) { await fs.mkdir(cwd); await run(['init', '--root', root, '--name', 'work', '--cwd', cwd, '--bind']); }
  await run(['record', '--stdin'], evidence({ contribution: 'A contribution only in the work record.' }));
  for (const [target, event] of [['codex', 'SessionStart'], ['claude', 'SessionStart'], ['cursor', 'sessionStart'], ['gemini', 'SessionStart']]) {
    const payload = json(await run(['hook', '--target', target, '--event', event], { cwd: projects[target === 'cursor' ? 1 : 0] }));
    const context = target === 'cursor' ? payload.additional_context : payload.hookSpecificOutput.additionalContext;
    assert.ok(context.includes(root)); assert.ok(context.includes('A contribution only in the work record.'));
  }
  const other = path.join(base, 'other-employer');
  const isolated = path.join(base, 'other-project'); await fs.mkdir(isolated);
  await run(['init', '--root', other, '--name', 'other', '--role', 'Analyst', '--cwd', isolated, '--bind']);
  const context = await run(['context', '--cwd', isolated]);
  assert.ok(context.includes(other)); assert.ok(!context.includes('A contribution only in the work record.'));
  assert.ok((await run(['context', '--cwd', isolated, '--name', 'work'])).includes('A contribution only in the work record.'));
});

test('scenario: a correction follows the user across projects', async t => {
  const { root, env, base } = await fixture(t);
  const run = runner(env);
  const original = json(await run(['record', '--stdin'], evidence({ eventId: 'original' })));
  const correction = json(await run(['amend', '--stdin'], evidence({ supersedes: original.id, source: 'cursor', contribution: 'Reviewed the retry strategy with Alex.' })));
  const second = path.join(base, 'second-project'); await fs.mkdir(second);
  await run(['init', '--root', root, '--cwd', second, '--bind']);
  const context = await run(['context', '--cwd', second]);
  assert.ok(context.includes(correction.id)); assert.ok(!context.includes('Designed the retry strategy.'));
  const packet = await run(['review', '--period', '2026']);
  assert.ok(packet.includes('Reviewed the retry strategy with Alex.')); assert.ok(!packet.includes('Designed the retry strategy.'));
  assert.equal((await fs.readdir(path.join(root, 'years/2026/evidence'))).filter(file => file.endsWith('.md')).length, 2);
});

test('scenario: reminders stay quiet across tools and honor user decisions', async t => {
  const { env } = await fixture(t);
  const run = runner(env);
  const remind = (session, project, rest = []) => run(['nudge', '--session', session, '--project', project, ...rest]).then(json);
  assert.equal((await remind('cursor-1', 'migration')).shown, true);
  assert.equal((await remind('claude-2', 'migration')).shown, false);
  await remind('claude-2', 'handoff', ['--action', 'dismiss']);
  assert.equal((await remind('codex-3', 'handoff')).shown, false);
  await remind('codex-3', 'operations', ['--action', 'approve']);
  assert.equal((await remind('cursor-4', 'operations')).shown, false);
  await remind('cursor-4', 'research', ['--action', 'snooze', '--days', '30']);
  assert.equal((await remind('gemini-5', 'research')).shown, false);
  assert.equal((await remind('codex-6', 'training')).shown, true);
  assert.equal((await remind('claude-7', 'another')).suppressed, 'weekly-budget');
});

test('scenario: a hosted-chat handoff imports once without copying company settings', async t => {
  const { root, env, base } = await fixture(t);
  const run = runner(env);
  const saved = json(await run(['record', '--stdin'], evidence({ eventId: 'shared' })));
  const file = path.join(base, 'handoff.md');
  await run(['export', '--period', '2026-H1', '--output', file]);
  const destination = path.join(base, 'destination');
  await run(['init', '--root', destination, '--name', 'destination', '--role', 'Researcher']);
  await run(['goals', '--root', destination, '--stdin'], { items: [{ id: 'reliability', title: 'An agreed destination goal' }] });
  assert.equal(json(await run(['import', '--root', destination, '--input', file])).imported, 1);
  assert.equal(json(await run(['import', '--root', destination, '--input', file])).duplicates, 1);
  const packet = await run(['review', '--root', destination, '--period', '2026']);
  assert.ok(packet.includes(saved.id)); assert.ok(packet.includes('Researcher')); assert.ok(packet.includes('An agreed destination goal'));
  assert.ok(!packet.includes('Improve reliability'));
  assert.ok((await fs.readFile(path.join(root, 'goals.md'), 'utf8')).includes('Improve reliability'));
});
