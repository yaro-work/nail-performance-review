import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fixture, evidence, packageRoot } from './fixtures.mjs';
import { saveEvidence, listEvidence } from '../src/records.mjs';
import { atomicWrite, assertInside } from '../src/storage.mjs';
import { spawn } from 'node:child_process';

test('concurrent processes preserve distinct events and suppress a replay', async t => {
  const { root, env } = await fixture(t);
  const run = eventId => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(packageRoot, 'bin/nail.mjs'), 'record', '--stdin', '--root', root], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => error += chunk);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(error)));
    child.stdin.end(JSON.stringify(evidence({ eventId })));
  });
  const results = await Promise.all(['one', 'two', 'three', 'one'].map(run));
  assert.equal(results.filter(result => result.duplicate).length, 1);
  assert.equal((await listEvidence(root)).length, 3);
});
test('unpublished temporary files do not appear as evidence and destinations cannot escape the root', async t => {
  const { root } = await fixture(t);
  await saveEvidence(root, evidence());
  await fs.writeFile(path.join(root, 'years/2026/evidence/interrupted.tmp'), 'unfinished write');
  assert.equal((await listEvidence(root)).length, 1);
  await assert.rejects(assertInside(root, path.join(root, '../outside.md')), /escapes/);
  const file = path.join(root, 'settings.md');
  await atomicWrite(file, 'first'); await atomicWrite(file, 'second');
  assert.equal(await fs.readFile(file, 'utf8'), 'second');
});
