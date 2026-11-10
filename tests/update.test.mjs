import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

test('one update pulls new code and refreshes all four terminal adapters in their existing modes', async t => {
  const base = path.resolve('.test-data');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, 'update-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const upstream = path.join(directory, 'upstream');
  const clone = path.join(directory, 'checkout');
  const home = path.join(directory, 'home');
  const record = path.join(directory, 'record');
  const hooks = path.join(directory, 'empty-hooks');
  await Promise.all([mkdir(upstream), mkdir(hooks)]);
  const git = (cwd, ...args) => execFileSync('git', ['-c', `core.hooksPath=${hooks}`, '-C', cwd, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const commit = message => git(upstream, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgSign=false', 'commit', '-m', message);
  for (const name of ['src', 'bin', 'skills', 'adapters']) await cp(path.resolve(name), path.join(upstream, name), { recursive: true });
  git(upstream, 'init', '--initial-branch=main');
  git(upstream, 'add', 'src', 'bin', 'skills', 'adapters');
  commit('Initial fixture');
  git(directory, 'clone', upstream, clone);
  git(clone, 'config', 'core.hooksPath', hooks);
  const env = { ...process.env, NAIL_HOME: home, NAIL_CONFIG: path.join(home, 'nail/config.json') };
  const run = (...args) => spawnSync(process.execPath, ['bin/nail.mjs', ...args], { cwd: clone, env, encoding: 'utf8' });
  const cli = (...args) => {
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  cli('init', '--root', record, '--name', 'work');
  cli('tracking', '--enable', '--all', '--name', 'work');
  cli('install', '--target', 'codex', '--skills-only');
  cli('install', '--target', 'claude');
  cli('install', '--target', 'cursor', '--reuse-claude-skills');
  cli('install', '--target', 'gemini');
  const configBefore = await readFile(env.NAIL_CONFIG, 'utf8');
  const profileBefore = await readFile(path.join(record, 'profile.md'), 'utf8');
  const oldHead = git(clone, 'rev-parse', 'HEAD');

  const installer = path.join(upstream, 'src/install.mjs');
  const oldSource = await readFile(installer, 'utf8');
  await writeFile(installer, oldSource.replace('return { updated, errors, next };', 'return { updated, errors, next, fixtureRevision: 2 };'));
  const setup = 'skills/nail-performance-review-setup/SKILL.md';
  const template = path.join(upstream, setup);
  await writeFile(template, (await readFile(template, 'utf8')) + '\nRefreshed from upstream.\n');
  git(upstream, 'add', 'src/install.mjs', setup);
  commit('Updated code and skill');

  const untracked = path.join(clone, 'local-edit.txt');
  await writeFile(untracked, 'Keep my changes.');
  const rejected = run('update', '--pull');
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /local changes/);
  assert.equal(git(clone, 'rev-parse', 'HEAD'), oldHead);
  assert.equal(await readFile(untracked, 'utf8'), 'Keep my changes.');
  await rm(untracked);
  const result = cli('update', '--pull');
  assert.equal(result.fixtureRevision, 2);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.updated.map(({ target, mode }) => [target, mode]), [
    ['codex', 'skills-only'], ['claude', 'skills-and-hooks'], ['cursor', 'skills-and-hooks'], ['gemini', 'skills-and-hooks'],
  ]);
  for (const target of ['.agents', '.claude', '.gemini']) assert.match(await readFile(path.join(home, target, setup), 'utf8'), /Refreshed from upstream/);
  const cursor = JSON.parse(await readFile(path.join(home, '.nail/installations/cursor.json'), 'utf8'));
  assert.equal(cursor.reuseClaudeSkills, true);
  assert.equal(await readFile(env.NAIL_CONFIG, 'utf8'), configBefore);
  assert.equal(await readFile(path.join(record, 'profile.md'), 'utf8'), profileBefore);
});
