import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fixture, evidence, packageRoot } from './fixtures.mjs';
import { resolveRoot } from '../src/config.mjs';

export function cli(args, env, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(packageRoot, 'bin/nail.mjs'), ...args], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}
test('CLI setup, record, cross-project context, correction, review, and HTML work on actual files', async t => {
  const { root, env, base, home } = await fixture(t);
  const invoke = async (args, input) => {
    const result = await cli(args, env, input && JSON.stringify(input));
    assert.equal(result.code, 0, result.stderr); return result.stdout;
  };
  assert.match(await invoke(['init', '--root', root, '--period', '2026', '--timezone', 'UTC']), /initialized/);
  const saved = JSON.parse(await invoke(['record', '--stdin'], evidence({ eventId: 'workflow' })));
  const dirs = [path.join(base, 'project one'), path.join(base, 'project two')];
  for (const dir of dirs) {
    await fs.mkdir(dir);
    await invoke(['init', '--root', root, '--cwd', dir, '--bind']);
    assert.equal(await resolveRoot({ cwd: dir, home }), root);
    assert.match(await invoke(['context', '--cwd', dir]), /Designed the retry strategy/);
  }
  await invoke(['amend', '--stdin'], evidence({ supersedes: saved.id, contribution: 'Co-designed the strategy.' }));
  const review = await invoke(['review', '--period', '2026-H1']);
  assert.ok(review.includes('Co-designed the strategy.')); assert.ok(!review.includes('Designed the retry strategy.'));
  const report = JSON.parse(await invoke(['report', '--period', '2026']));
  assert.match(await fs.readFile(report.output, 'utf8'), /Co-designed the strategy/);
  assert.equal(JSON.parse(await invoke(['doctor'])).ok, true);
  await invoke(['install', '--target', 'codex']);
  await fs.unlink(path.join(home, '.agents/skills/nail-performance-review-track/SKILL.md'));
  const brokenInstall = await cli(['doctor'], env);
  assert.equal(brokenInstall.code, 1);
  assert.ok(JSON.parse(brokenInstall.stdout).errors.some(error => error.includes('Missing installed file')));
  const bad = await cli(['record', '--stdin'], env, '{');
  assert.equal(bad.code, 1); assert.match(bad.stderr, /Expected a JSON object/);
});
test('default registry follows the documented OS configuration directory without Nail overrides', async t => {
  const { base } = await fixture(t);
  const home = path.join(base, 'isolated-user');
  const appdata = path.join(base, 'isolated-appdata');
  const root = path.join(base, 'default-record');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(NAIL_HOME|NAIL_CONFIG|HOME|USERPROFILE|APPDATA)$/i.test(key)));
  Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: appdata });
  const result = await cli(['init', '--root', root, '--name', 'default'], env);
  assert.equal(result.code, 0, result.stderr);
  const expected = path.join(process.platform === 'win32' ? appdata : path.join(home, '.config'), 'nail/config.json');
  assert.equal(JSON.parse(await fs.readFile(expected, 'utf8')).records.default, root);
  assert.equal((await cli(['context'], env)).code, 0);
});
