import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillNames = ['nail-performance-review-setup', 'nail-performance-review-track', 'nail-performance-review-review', 'nail-performance-review-report'];
const legacySkillNames = ['nail-setup', 'nail-track', 'nail-review', 'nail-report'];
const targets = {
  codex: { skills: '.agents/skills', config: '.codex/hooks.json', start: 'SessionStart', stop: 'Stop' },
  claude: { skills: '.claude/skills', config: '.claude/settings.json', start: 'SessionStart', stop: 'Stop' },
  cursor: { skills: '.cursor/skills', config: '.cursor/hooks.json', start: 'sessionStart', stop: 'stop' },
  gemini: { skills: '.gemini/skills', config: '.gemini/settings.json', start: 'SessionStart', stop: 'AfterAgent' },
  generic: { skills: '.nail/prompts' },
};

const digest = (text) => createHash('sha256').update(text).digest('hex');
const shellQuote = (text) => `'${text.replaceAll("'", "'\"'\"'")}'`;
const powershellQuote = (text) => `'${text.replaceAll("'", "''")}'`;
const normalize = (file) => file.replaceAll('\\', '/');

async function readOptional(file) {
  try { return await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function readJson(file) {
  const content = await readOptional(file);
  if (content === null) return null;
  const value = JSON.parse(content);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected JSON object: ${file}`);
  return value;
}

function locations(target, options) {
  if (!Object.hasOwn(targets, target)) throw new Error(`Unknown installation target: ${target}`);
  const home = path.resolve(options.home || process.env.NAIL_HOME || homedir());
  return { home, spec: targets[target], manifest: path.join(home, '.nail', 'installations', `${target}.json`) };
}

function hookEntry(target, event, cli) {
  const args = [cli, 'hook', '--target', target, '--event', event];
  const command = [process.execPath, ...args].map((arg) => shellQuote(normalize(arg))).join(' ');
  const windowsCommand = `node "${normalize(cli)}" hook --target ${target} --event ${event}`;
  if (target === 'cursor') return { command: process.platform === 'win32' ? `& ${[process.execPath, ...args].map((arg) => powershellQuote(normalize(arg))).join(' ')}` : command, timeout: 5 };
  if (target === 'claude') return { hooks: [{ type: 'command', command: process.execPath, args, timeout: 5 }] };
  const hook = { type: 'command', command: target === 'gemini' && process.platform === 'win32' ? windowsCommand : command, timeout: target === 'gemini' ? 5000 : 5 };
  if (target === 'gemini') hook.name = `nail-performance-review-${event}`;
  if (target === 'codex') hook.command_windows = windowsCommand;
  return { hooks: [hook] };
}

function validateManifest(manifest, target, home) {
  if (!manifest) return;
  const allowed = new Set([...skillNames, ...legacySkillNames].map((name) => path.join(home, targets[target].skills, name, 'SKILL.md')));
  const configFile = targets[target].config ? path.join(home, targets[target].config) : null;
  if (manifest.version !== 1 || manifest.target !== target || !Array.isArray(manifest.files) || !Array.isArray(manifest.entries) || manifest.configFile !== configFile || manifest.files.some((file) => !allowed.has(file.path))) throw new Error('Invalid Nail installation manifest; no files changed');
}

function removeEntries(config, entries) {
  for (const { event, entry } of entries) {
    if (!Array.isArray(config.hooks?.[event])) continue;
    config.hooks[event] = config.hooks[event].filter((item) => JSON.stringify(item) !== JSON.stringify(entry));
    if (!config.hooks[event].length) delete config.hooks[event];
  }
}

async function atomicWrite(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
  try { await rename(temporary, file); }
  catch (error) { await unlink(temporary).catch(() => {}); throw error; }
}

async function applyChanges(changes, manifestFile, manifest) {
  const completed = [];
  try {
    for (const change of changes) {
      if (change.content === null) await unlink(change.path);
      else await atomicWrite(change.path, change.content);
      completed.push(change);
    }
    await atomicWrite(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    for (const change of completed.reverse()) {
      if (change.before === null) await unlink(change.path).catch(() => {});
      else await atomicWrite(change.path, change.before);
    }
    throw error;
  }
}

export async function install(target, options = {}) {
  const { home, spec, manifest: manifestFile } = locations(target, options);
  const previous = await readJson(manifestFile);
  validateManifest(previous, target, home);
  const packageRoot = path.resolve(options.packageRoot || ownRoot);
  const root = options.root ? path.resolve(options.root) : '';
  if (/[\r\n\0]/.test(packageRoot + root)) throw new Error('Installation paths cannot contain control characters');
  if (process.platform === 'win32' && ['codex', 'gemini'].includes(target) && /[%!$`"]/.test(packageRoot)) throw new Error('This host requires a package path without shell expansion characters');
  const cli = path.join(packageRoot, 'bin', 'nail.mjs');
  const changes = [];
  const files = [];
  for (const file of previous?.files || []) {
    if (!legacySkillNames.includes(path.basename(path.dirname(file.path)))) continue;
    const before = await readOptional(file.path);
    if (before === null) continue;
    if (digest(before) !== file.sha256) throw new Error(`Preserving an edited legacy skill: ${file.path}. Back up and resolve your edits before upgrading.`);
    changes.push({ path: file.path, content: file.before, before });
  }
  for (const name of skillNames) {
    const source = await readFile(path.join(packageRoot, 'skills', name, 'SKILL.md'), 'utf8');
    const content = source.replaceAll('{{NAIL_PACKAGE_ROOT}}', normalize(packageRoot)).replaceAll('{{NAIL_CLI}}', normalize(cli)).replaceAll('{{NAIL_ROOT}}', normalize(root)) + `\n\n## Local installation\n\nNail CLI: ${normalize(cli)}\nPerformance directory: ${root ? normalize(root) : 'Resolve the selected record with the Nail CLI.'}\n`;
    const file = path.join(home, spec.skills, name, 'SKILL.md');
    const before = await readOptional(file);
    const owned = previous?.files?.find((item) => item.path === file);
    if (before !== null && (!owned || digest(before) !== owned.sha256)) throw new Error(`Preserving an unowned or edited skill: ${file}`);
    changes.push({ path: file, content, before });
    files.push({ path: file, sha256: digest(content), before: owned ? owned.before : before });
  }
  const entries = [];
  let configFile = null;
  let configHadHooks = false;
  let configHadVersion = false;
  let configCreated = false;
  if (spec.config) {
    configFile = path.join(home, spec.config);
    const before = await readOptional(configFile);
    const config = await readJson(configFile) || {};
    configCreated = previous ? previous.configCreated : before === null;
    configHadHooks = previous ? previous.configHadHooks : Object.hasOwn(config, 'hooks');
    configHadVersion = previous ? previous.configHadVersion : Object.hasOwn(config, 'version');
    if (config.hooks !== undefined && (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks))) throw new Error(`Expected hooks object: ${configFile}`);
    config.hooks ||= {};
    removeEntries(config, previous?.entries || []);
    for (const event of [spec.start, spec.stop]) {
      if (config.hooks[event] !== undefined && !Array.isArray(config.hooks[event])) throw new Error(`Expected hook array for ${event}: ${configFile}`);
      const entry = hookEntry(target, event, cli);
      config.hooks[event] ||= [];
      config.hooks[event].push(entry);
      entries.push({ event, entry });
    }
    if (target === 'cursor' && config.version === undefined) config.version = 1;
    changes.push({ path: configFile, content: `${JSON.stringify(config, null, 2)}\n`, before });
  }
  const manifest = { version: 1, target, packageRoot, root, files, configFile, entries, configCreated, configHadHooks, configHadVersion };
  if (!options.dryRun) await applyChanges(changes, manifestFile, manifest);
  return {
    target, dryRun: Boolean(options.dryRun), files: changes.map((item) => item.path),
    mode: target === 'generic' ? 'manual-handoff' : 'skills-and-hooks',
    verifiedAutomaticCapture: false,
    next: target === 'codex' ? 'Restart Codex, open /hooks, and review and trust the Nail definitions. Policies can disable user hooks.' : target === 'generic' ? 'Use the Nail setup prompt and Markdown import/export in the chat tool.' : `Restart ${target} and review hook trust if requested. Run a real session before claiming automatic capture.`,
  };
}

export async function uninstall(target, options = {}) {
  const { home, manifest: manifestFile } = locations(target, options);
  const manifest = await readJson(manifestFile);
  if (!manifest) return { target, installed: false, preserved: [], dryRun: Boolean(options.dryRun) };
  validateManifest(manifest, target, home);
  const preserved = [];
  const removable = [];
  for (const file of manifest.files) {
    const content = await readOptional(file.path);
    if (content === null) continue;
    if (digest(content) !== file.sha256) preserved.push(file.path);
    else removable.push(file);
  }
  let config;
  if (manifest.configFile) {
    config = await readJson(manifest.configFile);
    if (config) {
      if (config.hooks !== undefined && (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks))) throw new Error('Invalid hooks object; no files changed');
      removeEntries(config, manifest.entries);
      if (!manifest.configHadHooks && config.hooks && !Object.keys(config.hooks).length) delete config.hooks;
      if (target === 'cursor' && !manifest.configHadVersion && config.version === 1) delete config.version;
    }
  }
  if (!options.dryRun) {
    if (config) {
      if (manifest.configCreated && !Object.keys(config).length) await unlink(manifest.configFile);
      else await atomicWrite(manifest.configFile, `${JSON.stringify(config, null, 2)}\n`);
    }
    for (const file of removable) {
      if (file.before === null) await unlink(file.path);
      else await atomicWrite(file.path, file.before);
    }
    if (preserved.length) {
      manifest.files = manifest.files.filter((item) => preserved.includes(item.path));
      manifest.entries = [];
      await atomicWrite(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    } else await unlink(manifestFile);
  }
  return { target, installed: preserved.length > 0, removed: removable.map((item) => item.path), preserved, dryRun: Boolean(options.dryRun) };
}

export async function inspectInstallations(options = {}) {
  const results = [];
  for (const target of Object.keys(targets)) {
    const { home, manifest } = locations(target, options);
    const missing = [];
    const issues = [];
    let installation;
    try {
      installation = await readJson(manifest);
      validateManifest(installation, target, home);
      if (installation) {
        if (installation.files.some(file => legacySkillNames.includes(path.basename(path.dirname(file.path))))) issues.push(`Older short skill names installed. Rerun install --target ${target} to update them.`);
        for (const file of installation.files) {
          const content = await readOptional(file.path);
          if (content === null) missing.push(file.path);
          else if (digest(content) !== file.sha256) issues.push(`Edited installed skill: ${file.path}`);
        }
        if (installation.configFile) {
          const config = await readJson(installation.configFile);
          for (const { event, entry } of installation.entries) {
            if (!Array.isArray(config?.hooks?.[event]) || !config.hooks[event].some((value) => JSON.stringify(value) === JSON.stringify(entry))) issues.push(`Missing ${event} hook in ${installation.configFile}`);
          }
        }
      }
    } catch (error) {
      issues.push(error.message);
    }
    const executableOnPath = target === 'generic' ? null : await findExecutable(target);
    results.push({ target, installed: Boolean(installation), missing, issues, executableOnPath, verifiedAutomaticCapture: false, trust: target === 'codex' ? 'Review in host /hooks' : 'Host policy applies' });
  }
  return results;
}

async function findExecutable(name) {
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.ps1', '.bat', ''] : [''];
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    for (const extension of extensions) {
      const file = path.join(directory, `${name}${extension}`);
      try { await access(file, constants.X_OK); return file; } catch {}
    }
  }
  return null;
}
