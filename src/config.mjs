import path from 'node:path';
import os from 'node:os';
import { realpath, stat } from 'node:fs/promises';
import { readOptional, atomicWrite, withLock, slug } from './storage.mjs';

export function userHome(options = {}) { return options.home || process.env.NAIL_HOME || os.homedir(); }
export function configPath(options = {}) {
  return process.env.NAIL_CONFIG || path.join(options.home || process.env.NAIL_HOME || (process.platform === 'win32' ? process.env.APPDATA || os.homedir() : path.join(os.homedir(), '.config')), 'nail', 'config.json');
}
export async function readConfig(options = {}) {
  const file = configPath(options);
  const text = await readOptional(file);
  if (!text) return { schema: 1, records: {} };
  let config;
  try { config = JSON.parse(text); } catch { throw new Error(`Invalid configuration: ${file}`); }
  if (config?.schema !== 1 || !config.records || Array.isArray(config.records) || typeof config.records !== 'object' ||
      (config.tracking !== undefined && (!Array.isArray(config.tracking) || config.tracking.some(item => !item || typeof item.workspace !== 'string' || !path.isAbsolute(item.workspace) || typeof item.record !== 'string')))) throw new Error(`Invalid configuration: ${file}`);
  return config;
}

async function workspacePath(cwd) {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) throw new Error('Tracking requires an absolute workspace directory.');
  const workspace = await realpath(cwd);
  if (!(await stat(workspace)).isDirectory() || path.dirname(workspace) === workspace) throw new Error('Choose a specific workspace directory.');
  return workspace;
}

export async function setTracking(options) {
  const workspace = await workspacePath(options.cwd || process.cwd());
  const file = configPath(options);
  return withLock(path.dirname(file), async () => {
    const config = await readConfig(options);
    const tracking = (config.tracking || []).filter(item => item.workspace !== workspace);
    if (options.enable) {
      const record = slug(options.name || config.default, 'record name');
      if (!Object.hasOwn(config.records, record) || !path.isAbsolute(config.records[record])) throw new Error('Choose a registered record with --name.');
      tracking.push({ workspace, record });
    }
    await atomicWrite(file, `${JSON.stringify({ ...config, tracking }, null, 2)}\n`);
    return { enabled: Boolean(options.enable), workspace };
  });
}

export async function trackingStatus(options = {}) {
  const workspace = await workspacePath(options.cwd || process.cwd());
  const config = await readConfig(options);
  const record = config.tracking?.find(item => item.workspace === workspace)?.record;
  const root = record && Object.hasOwn(config.records, record) && config.records[record];
  return typeof root === 'string' && path.isAbsolute(root)
    ? { workspace, enabled: true, record, root }
    : { workspace, enabled: false };
}

export async function trackingRoot(cwd, options = {}) {
  return (await trackingStatus({ ...options, cwd })).root;
}
export async function registerRoot(root, options = {}) {
  const name = slug(options.name || 'work', 'record name');
  const file = configPath(options);
  await withLock(path.dirname(file), async () => {
    const config = await readConfig(options);
    if (config.records[name] && config.records[name] !== root) throw new Error(`Record ${name} already points elsewhere. Choose a different --name.`);
    if (Object.values(config.records).includes(root) && config.records[name] !== root) throw new Error('This directory already has another record name.');
    config.records[name] = root;
    config.default ||= name;
    await atomicWrite(file, `${JSON.stringify(config, null, 2)}\n`);
  });
}
export async function resolveRoot(options = {}) {
  if (options.root) {
    if (!path.isAbsolute(options.root)) throw new Error('--root must be an absolute path.');
    return path.resolve(options.root);
  }
  const config = await readConfig(options);
  if (options.name) {
    const root = config.records[slug(options.name, 'record name')];
    if (!root || !path.isAbsolute(root)) throw new Error(`Unknown record: ${options.name}. Run init first.`);
    return root;
  }
  let current = path.resolve(options.cwd || process.cwd());
  while (true) {
    const text = await readOptional(path.join(current, '.nail.json'));
    if (text) {
      let binding;
      try { binding = JSON.parse(text); } catch { throw new Error(`Invalid binding in ${current}`); }
      const root = config.records[binding.record];
      if (binding.schema !== 1 || !root || !path.isAbsolute(root)) throw new Error(`Unknown record in ${current}/.nail.json`);
      return root;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const root = config.records[config.default];
  if (!root || !path.isAbsolute(root)) throw new Error('No performance record is configured. Run init first.');
  return root;
}
export function initialRoot(options = {}) {
  if (options.root && !path.isAbsolute(options.root)) throw new Error('--root must be an absolute path.');
  return path.resolve(options.root || path.join(userHome(options), 'performance'));
}
