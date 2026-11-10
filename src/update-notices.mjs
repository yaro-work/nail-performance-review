import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { configPath } from './config.mjs';
import { atomicWrite, readOptional, withLock } from './storage.mjs';

export const currentVersion = pkg.version;
const day = 86_400_000;
const versionPattern = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const versionUrl = 'https://raw.githubusercontent.com/yaro-work/nail-performance-review/main/package.json';
const updateGuide = 'https://github.com/yaro-work/nail-performance-review#update-it';
const validVersion = value => typeof value === 'string' && versionPattern.test(value);

function newer(latest, installed) {
  if (!validVersion(latest) || !validVersion(installed)) return false;
  const previous = installed.split('.').map(Number);
  const difference = latest.split('.').map((part, index) => Number(part) - previous[index]).find(value => value !== 0);
  return difference > 0;
}

const cachePath = options => path.join(path.dirname(configPath(options)), 'updates', 'state.json');
const save = (file, state) => atomicWrite(file, `${JSON.stringify(state, null, 2)}\n`);
const initialState = now => ({ enabled: true, nextCheckAt: now + 14 * day, notified: {} });

async function readState(file) {
  const text = await readOptional(file);
  if (text === undefined) return;
  const state = JSON.parse(text);
  if (typeof state?.enabled !== 'boolean' || !Number.isSafeInteger(state.nextCheckAt) ||
      !state.notified || typeof state.notified !== 'object' || Array.isArray(state.notified) ||
      (state.latest !== undefined && !validVersion(state.latest))) throw new Error('Invalid update check settings.');
  return state;
}

async function queryVersion(request) {
  try {
    const response = await request(versionUrl, { redirect: 'error', signal: AbortSignal.timeout(1500) });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.name === pkg.name && validVersion(data.version) ? data.version : null;
  } catch { return null; }
}

async function refresh(state, now, request) {
  const latest = await queryVersion(request);
  if (latest) state.latest = latest;
  state.nextCheckAt = now + (latest ? 14 : 1) * day;
  return latest;
}

export async function setUpdateNotifications(enabled, options = {}) {
  const file = cachePath(options);
  return withLock(path.dirname(file), async () => {
    const now = Date.now();
    const state = await readState(file) ?? initialState(now);
    if (enabled && !state.enabled) state.nextCheckAt = now;
    state.enabled = enabled;
    await save(file, state);
    return { notificationsEnabled: enabled };
  });
}

export async function checkForUpdate(options = {}, { now = Date.now(), request = fetch } = {}) {
  const file = cachePath(options);
  return withLock(path.dirname(file), async () => {
    const state = await readState(file) ?? initialState(now);
    const latest = await refresh(state, now, request);
    await save(file, state);
    return {
      status: latest ? (newer(latest, currentVersion) ? 'update-available' : 'up-to-date') : 'unavailable',
      installedVersion: currentVersion, latestVersion: latest, notificationsEnabled: state.enabled,
      ...(newer(latest, currentVersion) ? { updateGuide } : {}),
    };
  });
}

export async function updateNotice(host, options = {}, { now = Date.now(), request = fetch } = {}) {
  const file = cachePath(options);
  const pending = state => state.enabled && newer(state.latest, currentVersion) && state.notified[host] !== state.latest;
  const existing = await readState(file);
  if (existing && (!existing.enabled || (now < existing.nextCheckAt && !pending(existing)))) return;
  return withLock(path.dirname(file), async () => {
    const saved = await readState(file);
    const state = saved ?? initialState(now);
    if (!state.enabled) return;
    const due = now >= state.nextCheckAt;
    if (due) await refresh(state, now, request);
    const show = pending(state);
    if (show) state.notified[host] = state.latest;
    if (due || show || !saved) await save(file, state);
    if (show) return `nail-performance-review ${state.latest} is available. Update using your install method: ${updateGuide}`;
  });
}
