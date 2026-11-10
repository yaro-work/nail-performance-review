import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertInside, atomicWrite, markdown, parseMarkdown, readOptional, withLock } from './storage.mjs';

const day = 86_400_000;
const defaultIntervals = { 'one-on-one': 7, document: 30 };

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

export async function readManagerSources(root) {
  const file = await sourceFile(root);
  const contents = await readOptional(file);
  if (contents === undefined) return [];
  const { body, file: ignored, schema, type, ...data } = parseMarkdown(contents, file);
  const sources = type === 'manager-source'
    ? [{ ...data, id: 'legacy', kind: 'document' }]
    : type === 'document-sources' ? data.sources : null;
  if (!Array.isArray(sources)) throw new Error('Invalid manager-source.md.');
  const ids = new Set(), urls = new Set();
  for (const source of sources) {
    if (!source || typeof source.id !== 'string' || !source.id || ids.has(source.id) || urls.has(source.url) ||
        !Object.hasOwn(defaultIntervals, source.kind) || !validInterval(source.intervalDays) ||
        (source.label !== undefined && !validLabel(source.label)) ||
        (source.intervalDays ? typeof source.workspace !== 'string' || !path.isAbsolute(source.workspace) : source.workspace !== null) ||
        (source.lastChecked !== null && (!Number.isSafeInteger(source.lastChecked) || source.lastChecked < 0)) ||
        (source.attempt !== null && (!source.attempt || typeof source.attempt.id !== 'string' ||
          !Number.isSafeInteger(source.attempt.at) || source.attempt.at < 0))) throw new Error('Invalid manager-source.md.');
    validateUrl(source.url);
    validateRevision(source.revision);
    ids.add(source.id);
    urls.add(source.url);
  }
  return sources;
}

const validInterval = value => Number.isInteger(value) && value >= 0 && value <= 365;
const validLabel = value => typeof value === 'string' && value.trim() && value.length <= 120 && !/[\r\n]/.test(value);

async function save(root, sources) {
  await atomicWrite(await sourceFile(root), markdown({ schema: 1, type: 'document-sources', sources },
    '# Private document sources\n\nKeep these links and checkpoints inside the performance record.'));
}

export function managerSourceStatus({ id, kind, label, intervalDays, workspace, lastChecked }) {
  return { id, kind, label, intervalDays, workspace, lastChecked };
}

export function managerRefreshDue(source, workspace, now = Date.now()) {
  return Boolean(source?.intervalDays && source.workspace === workspace &&
    (source.lastChecked === null || now - source.lastChecked >= source.intervalDays * day) &&
    (!source.attempt || now - source.attempt.at >= day));
}

export async function configureManagerSource(root, input, { workspace, authorizeWorkspace = value => value } = {}, now = Date.now()) {
  if (!input || Array.isArray(input) || typeof input !== 'object' || Boolean(input.id) === Boolean(input.url) ||
      Object.keys(input).some(key => !['id', 'url', 'kind', 'label', 'intervalDays', 'reviewed', 'revision'].includes(key))) {
    throw new Error('Provide a document URL or an existing source ID.');
  }
  if (input.url) validateUrl(input.url);
  const { reviewed = false, revision = null } = input;
  if ((input.intervalDays !== undefined && !validInterval(input.intervalDays)) ||
      (input.kind !== undefined && !Object.hasOwn(defaultIntervals, input.kind)) ||
      (input.label !== undefined && !validLabel(input.label)) ||
      typeof reviewed !== 'boolean' || (!reviewed && revision !== null)) {
    throw new Error('Use a valid source kind and a check interval of 0 to 365 days.');
  }
  validateRevision(revision);
  return withLock(root, async () => {
    const sources = await readManagerSources(root);
    const index = sources.findIndex(source => input.id ? source.id === input.id : source.url === input.url);
    const previous = sources[index];
    if (input.id && !previous) throw new Error('Unknown document source ID.');
    const kind = input.kind ?? previous?.kind ?? 'document';
    const intervalDays = input.intervalDays ?? previous?.intervalDays ?? defaultIntervals[kind];
    const folder = intervalDays ? await authorizeWorkspace(workspace ?? previous?.workspace) : null;
    if (intervalDays && (typeof folder !== 'string' || !path.isAbsolute(folder))) throw new Error('Choose an enabled workspace for recurring checks.');
    const unchanged = previous && previous.intervalDays === intervalDays && previous.workspace === folder;
    const source = {
      id: previous?.id ?? randomUUID(), url: previous?.url ?? input.url, kind,
      label: input.label ?? previous?.label, intervalDays, workspace: folder,
      revision: reviewed ? revision : previous?.revision ?? null,
      lastChecked: reviewed ? now : previous?.lastChecked ?? null,
      attempt: unchanged && !reviewed ? previous.attempt : null,
    };
    if (previous) sources[index] = source;
    else sources.push(source);
    await save(root, sources);
    return { configured: true, ...managerSourceStatus(source) };
  });
}

export async function claimManagerRefresh(root, { id, workspace, now = Date.now() } = {}) {
  return withLock(root, async () => {
    const sources = await readManagerSources(root);
    if (!workspace && !id && sources.length > 1) throw new Error('Choose a document source with --id. Run manager-source to list IDs.');
    const source = sources.find(item => (!id || item.id === id) && (!workspace || managerRefreshDue(item, workspace, now)));
    if (!source) return { due: false };
    if (source.attempt && now - source.attempt.at < day) return { due: false, inProgress: true };
    const attempt = { id: randomUUID(), at: now };
    source.attempt = attempt;
    await save(root, sources);
    return { due: true, root, ...managerSourceStatus(source), url: source.url, revision: source.revision, checkId: attempt.id };
  });
}

export async function pauseManagerRefresh(root, id) {
  return withLock(root, async () => {
    const sources = await readManagerSources(root);
    const selected = sources.filter(source => !id || source.id === id);
    for (const source of selected) Object.assign(source, { intervalDays: 0, workspace: null, attempt: null });
    if (selected.length) await save(root, sources);
    return { paused: Boolean(selected.length) };
  });
}

export async function completeManagerRefresh(root, input, now = Date.now()) {
  const { checkId, revision = null } = input || {};
  if (typeof checkId !== 'string' || Object.keys(input).some(key => !['checkId', 'revision'].includes(key))) throw new Error('A document check ID is required.');
  validateRevision(revision);
  return withLock(root, async () => {
    const sources = await readManagerSources(root);
    const source = sources.find(item => item.attempt?.id === checkId);
    if (!source) throw new Error('This document check is no longer current.');
    Object.assign(source, { lastChecked: now, revision, attempt: null });
    await save(root, sources);
    return { checked: true, lastChecked: now };
  });
}
