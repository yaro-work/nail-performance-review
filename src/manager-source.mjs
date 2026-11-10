import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertInside, atomicWrite, markdown, parseMarkdown, readOptional, withLock } from './storage.mjs';

const day = 86_400_000;
const intervals = [0, 7, 21];

const sourceFile = root => assertInside(root, path.join(root, 'manager-source.md'));

function validateUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || value.trim() !== value) throw new Error('Use a private HTTPS document link.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Use a private HTTPS document link.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a private HTTPS document link without credentials.');
}

function validateRevision(revision) {
  if (revision !== null && (typeof revision !== 'string' || !revision.trim() || revision.length > 512)) {
    throw new Error('Invalid document revision.');
  }
}

export async function readManagerSource(root) {
  const file = await sourceFile(root);
  const contents = await readOptional(file);
  if (contents === undefined) return null;
  const { body, file: ignored, ...source } = parseMarkdown(contents, file);
  validateUrl(source.url);
  validateRevision(source.revision);
  if (source.type !== 'manager-source' || !intervals.includes(source.intervalDays) ||
      (source.intervalDays ? typeof source.workspace !== 'string' || !path.isAbsolute(source.workspace) : source.workspace !== null) ||
      (source.lastChecked !== null && (!Number.isSafeInteger(source.lastChecked) || source.lastChecked < 0)) ||
      (source.attempt !== null && (!source.attempt || typeof source.attempt.id !== 'string' ||
        !Number.isSafeInteger(source.attempt.at) || source.attempt.at < 0))) throw new Error('Invalid manager-source.md.');
  return source;
}

async function save(root, source) {
  await atomicWrite(await sourceFile(root), markdown(source, '# Private manager document\n\nKeep this link and checkpoint inside the performance record.'));
}

export function managerRefreshDue(source, workspace, now = Date.now()) {
  return Boolean(source?.intervalDays && source.workspace === workspace &&
    (source.lastChecked === null || now - source.lastChecked >= source.intervalDays * day) &&
    (!source.attempt || now - source.attempt.at >= day));
}

export async function configureManagerSource(root, input, workspace, now = Date.now()) {
  validateUrl(input?.url);
  const { url, intervalDays = 0, reviewed = false, revision = null } = input;
  if (Object.keys(input).some(key => !['url', 'intervalDays', 'reviewed', 'revision'].includes(key)) ||
      !intervals.includes(intervalDays) || typeof reviewed !== 'boolean' || (!reviewed && revision !== null) ||
      Boolean(intervalDays) !== Boolean(workspace)) throw new Error('Choose manual checks (0), every 7 days, or every 21 days in an enabled workspace.');
  validateRevision(revision);
  return withLock(root, async () => {
    const previous = await readManagerSource(root);
    const sameSource = previous?.url === url;
    const unchanged = sameSource && previous.intervalDays === intervalDays && previous.workspace === (workspace || null);
    const source = {
      schema: 1, type: 'manager-source', url, intervalDays, workspace: workspace || null,
      revision: reviewed ? revision : sameSource ? previous.revision : null,
      lastChecked: reviewed ? now : sameSource ? previous.lastChecked : null,
      attempt: unchanged && !reviewed ? previous.attempt : null,
    };
    await save(root, source);
    return { configured: true, intervalDays, workspace: source.workspace, lastChecked: source.lastChecked };
  });
}

export async function claimManagerRefresh(root, { workspace, now = Date.now() } = {}) {
  return withLock(root, async () => {
    const source = await readManagerSource(root);
    if (!source || (workspace && !managerRefreshDue(source, workspace, now))) return { due: false };
    if (source.attempt && now - source.attempt.at < day) return { due: false, inProgress: true };
    const attempt = { id: randomUUID(), at: now };
    await save(root, { ...source, attempt });
    return { due: true, root, url: source.url, revision: source.revision, lastChecked: source.lastChecked, checkId: attempt.id };
  });
}

export async function pauseManagerRefresh(root) {
  return withLock(root, async () => {
    const source = await readManagerSource(root);
    if (source?.intervalDays) await save(root, { ...source, intervalDays: 0, workspace: null, attempt: null });
    return { paused: Boolean(source) };
  });
}

export async function completeManagerRefresh(root, input, now = Date.now()) {
  const { checkId, revision = null } = input || {};
  if (typeof checkId !== 'string' || Object.keys(input).some(key => !['checkId', 'revision'].includes(key))) throw new Error('A document check ID is required.');
  validateRevision(revision);
  return withLock(root, async () => {
    const source = await readManagerSource(root);
    if (source?.attempt?.id !== checkId) throw new Error('This document check is no longer current.');
    await save(root, { ...source, lastChecked: now, revision, attempt: null });
    return { checked: true, lastChecked: now };
  });
}
