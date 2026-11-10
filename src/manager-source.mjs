import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertInside, atomicWrite, markdown, parseMarkdown, readOptional, withLock } from './storage.mjs';

const day = 86_400_000;
const minute = 60_000;
const lease = 30 * minute;
const backoff = [15 * minute, 60 * minute, day];
const defaultIntervals = { 'one-on-one': 7, document: 30 };
const successful = new Set(['checked', 'unchanged', 'updated']);
const unsuccessful = new Set(['unavailable', 'partial', 'deferred']);
const validTime = value => Number.isSafeInteger(value) && value >= 0;
const validSummary = value => typeof value === 'string' && value.trim() && value.length <= 240 && !/[\r\n]/.test(value);

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
        (source.lastChecked !== null && !validTime(source.lastChecked)) ||
        (source.attempt !== null && !validAttempt(source.attempt)) ||
        (source.lastChange !== undefined && (!source.lastChange || !validTime(source.lastChange.at) ||
          !validSummary(source.lastChange.summary)))) throw new Error('Invalid manager-source.md.');
    validateUrl(source.url);
    validateRevision(source.revision);
    ids.add(source.id);
    urls.add(source.url);
  }
  return sources;
}

const validInterval = value => Number.isInteger(value) && value >= 0 && value <= 365;
const validLabel = value => typeof value === 'string' && value.trim() && value.length <= 120 && !/[\r\n]/.test(value);
function validAttempt(attempt) {
  if (!attempt || typeof attempt.id !== 'string' || !validTime(attempt.at) ||
      (attempt.tries !== undefined && (!Number.isSafeInteger(attempt.tries) || attempt.tries < 1))) return false;
  return attempt.outcome === undefined
    ? attempt.finishedAt === undefined
    : (successful.has(attempt.outcome) || unsuccessful.has(attempt.outcome)) && validTime(attempt.finishedAt);
}

async function save(root, sources) {
  await atomicWrite(await sourceFile(root), markdown({ schema: 1, type: 'document-sources', sources },
    '# Private document sources\n\nKeep these links and checkpoints inside the performance record.'));
}

function activeAttempt(attempt, now) {
  return Boolean(attempt && !attempt.outcome && now < attempt.at + lease);
}

function nextCheckAt({ intervalDays, lastChecked, attempt }) {
  if (!intervalDays) return null;
  const scheduled = lastChecked === null ? 0 : lastChecked + intervalDays * day;
  if (!attempt || successful.has(attempt.outcome)) return scheduled;
  const delay = backoff[Math.min((attempt.tries ?? 1) - 1, backoff.length - 1)];
  const retry = attempt.outcome
    ? attempt.finishedAt + (attempt.outcome === 'deferred' ? day : delay)
    : attempt.at + Math.max(lease, delay);
  return Math.max(scheduled, retry);
}

export function managerSourceStatus(source, now = Date.now()) {
  const { id, kind, label, intervalDays, workspace, lastChecked, lastChange, attempt } = source;
  const checking = activeAttempt(attempt, now);
  const next = nextCheckAt(source);
  return {
    id, kind, label, intervalDays, workspace, lastChecked, lastChange,
    lastAttempt: attempt ? {
      at: attempt.at, outcome: attempt.outcome ?? (checking ? 'checking' : 'interrupted'), finishedAt: attempt.finishedAt,
    } : null,
    nextCheckAt: next || null,
    status: checking ? 'checking' : next === null ? 'paused' : now >= next ? 'due' : 'scheduled',
  };
}

export function managerRefreshDue(source, workspace, now = Date.now()) {
  if (!source) return false;
  const next = nextCheckAt(source);
  return next !== null && source.workspace === workspace && now >= next;
}

export async function lookupManagerSource(root, input) {
  if (!input || Object.keys(input).length !== 1) throw new Error('Provide a document URL.');
  validateUrl(input.url);
  const source = (await readManagerSources(root)).find(item => item.url === input.url);
  return source ? { configured: true, ...managerSourceStatus(source) } : { configured: false };
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
      lastChange: previous?.lastChange,
      attempt: !reviewed && (unchanged || previous?.attempt?.outcome) ? previous.attempt : null,
    };
    if (previous) sources[index] = source;
    else sources.push(source);
    await save(root, sources);
    return { configured: true, ...managerSourceStatus(source, now) };
  });
}

export async function claimManagerRefresh(root, { id, workspace, now = Date.now() } = {}) {
  return withLock(root, async () => {
    const sources = await readManagerSources(root);
    if (!workspace && !id && sources.length > 1) throw new Error('Choose a document source with --id. Run manager-source to list IDs.');
    const eligible = sources.filter(item => (!id || item.id === id) && (!workspace || managerRefreshDue(item, workspace, now)));
    const source = eligible.sort((a, b) => (a.attempt?.at ?? 0) - (b.attempt?.at ?? 0))[0];
    if (!source) return { due: false };
    if (activeAttempt(source.attempt, now)) return { due: false, inProgress: true };
    const previous = source.attempt;
    const tries = previous && !successful.has(previous.outcome) ? Math.min((previous.tries ?? 1) + 1, backoff.length) : 1;
    const attempt = { id: randomUUID(), at: now, tries };
    source.attempt = attempt;
    await save(root, sources);
    const { id: sourceId, kind, label, intervalDays, lastChecked, url, revision } = source;
    return { due: true, root, id: sourceId, kind, label, intervalDays, workspace: source.workspace,
      lastChecked, url, revision, checkId: attempt.id };
  });
}

export async function pauseManagerRefresh(root, id) {
  return withLock(root, async () => {
    const sources = await readManagerSources(root);
    const selected = sources.filter(source => !id || source.id === id);
    for (const source of selected) {
      Object.assign(source, { intervalDays: 0, workspace: null });
      if (!source.attempt?.outcome) source.attempt = null;
    }
    if (selected.length) await save(root, sources);
    return { paused: Boolean(selected.length) };
  });
}

export async function completeManagerRefresh(root, input, now = Date.now()) {
  const { checkId, revision = null, outcome = 'checked', summary } = input || {};
  if (typeof checkId !== 'string' || Object.keys(input).some(key => !['checkId', 'revision', 'outcome', 'summary'].includes(key))) throw new Error('A document check ID is required.');
  const success = successful.has(outcome);
  if ((!success && !unsuccessful.has(outcome)) || (!success && revision !== null) ||
      (outcome === 'updated' ? !validSummary(summary) : summary !== undefined)) throw new Error('Invalid document check outcome.');
  validateRevision(revision);
  return withLock(root, async () => {
    const sources = await readManagerSources(root);
    const source = sources.find(item => item.attempt?.id === checkId && !item.attempt.outcome);
    if (!source) throw new Error('This document check is no longer current.');
    Object.assign(source.attempt, { outcome, finishedAt: now });
    if (success) Object.assign(source, { lastChecked: now, revision });
    if (outcome === 'updated') source.lastChange = { at: now, summary };
    await save(root, sources);
    return { checked: success, outcome, lastChecked: source.lastChecked, nextCheckAt: nextCheckAt(source) };
  });
}
