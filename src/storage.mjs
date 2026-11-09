import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function readOptional(file) {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

export async function atomicWrite(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, text, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

export async function withLock(root, action) {
  await assertInside(root, root);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const lock = await assertInside(root, path.join(root, '.nail.lock'));
  const deadline = Date.now() + 5000;
  let handle;
  while (!handle) {
    try { handle = await fs.open(lock, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error(`Record is busy. Check the owner of ${lock} before removing a stale lock.`);
      await delay(25);
    }
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
    return await action();
  } finally { await handle.close(); await fs.unlink(lock); }
}

export function slug(value, label = 'identifier') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)) throw new Error(`Invalid ${label}. Use letters, numbers, hyphens, or underscores.`);
  return value;
}

export function markdown(metadata, body) {
  return `\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n\n${body.trim()}\n`;
}

export function parseMarkdown(text, file = 'record') {
  const match = /^```json\r?\n([\s\S]*?)\r?\n```\r?\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file}: expected fenced JSON metadata at the beginning.`);
  let metadata;
  try { metadata = JSON.parse(match[1]); } catch { throw new Error(`${file}: invalid JSON metadata.`); }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object' || metadata.schema !== 1) throw new Error(`${file}: unsupported record schema.`);
  return { ...metadata, body: match[2].trim(), file };
}

export async function walkMarkdown(directory) {
  const result = [];
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return result; throw error; }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported in the record: ${file}`);
    if (entry.isDirectory()) result.push(...await walkMarkdown(file));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(file);
  }
  return result;
}

export async function assertInside(root, file) {
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path escapes the selected record.');
  let current = root;
  for (const part of ['', ...relative.split(path.sep)]) {
    current = part ? path.join(current, part) : current;
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`Symbolic link is not an allowed write destination: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return file;
}
