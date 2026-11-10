import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, chmod, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { assertInside, withLock } from './storage.mjs';
import { hookEvents } from './hooks.mjs';

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillNames = ['nail-performance-review-setup', 'nail-performance-review-track', 'nail-performance-review-review', 'nail-performance-review-report'];
const legacySkillNames = ['nail-setup', 'nail-track', 'nail-review', 'nail-report'];
const cursorRule = '.cursor/rules/nail-performance-review.mdc';
const targets = {
  codex: { skills: '.agents/skills', config: '.codex/hooks.json' },
  claude: { skills: '.claude/skills', config: '.claude/settings.json' },
  cursor: { skills: '.cursor/skills', config: '.cursor/hooks.json' },
  gemini: { skills: '.gemini/skills', config: '.gemini/settings.json' },
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

function parseJson(content, file) {
  if (content === null) return null;
  const value = JSON.parse(content);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected JSON object: ${file}`);
  return value;
}

async function readJson(file) { return parseJson(await readOptional(file), file); }

function locations(target, options) {
  if (!Object.hasOwn(targets, target)) throw new Error(`Unknown installation target: ${target}`);
  const home = path.resolve(options.home || process.env.NAIL_HOME || homedir());
  return { home, spec: targets[target], manifest: path.join(home, '.nail', 'installations', `${target}.json`) };
}

function hookEntry(target, event, cli) {
  const args = [cli, 'hook', '--target', target, '--event', event];
  const command = ['node', ...args.map((arg) => shellQuote(normalize(arg)))].join(' ');
  const windowsCommand = `node "${normalize(cli)}" hook --target ${target} --event ${event}`;
  if (target === 'cursor') return { command: process.platform === 'win32' ? `node ${args.map((arg) => powershellQuote(normalize(arg))).join(' ')}` : command, timeout: 5 };
  if (target === 'claude') {
    const hook = { type: 'command', command, timeout: 5 };
    if (process.platform === 'win32') Object.assign(hook, {
      shell: 'powershell', command: ['node', ...args.map(arg => powershellQuote(normalize(arg)))].join(' '),
    });
    return { hooks: [hook] };
  }
  const hook = { type: 'command', command: target === 'gemini' && process.platform === 'win32' ? windowsCommand : command, timeout: target === 'gemini' ? 5000 : 5 };
  if (target === 'gemini') hook.name = `nail-performance-review-${event}`;
  if (target === 'codex') hook.command_windows = windowsCommand;
  return { hooks: [hook] };
}

function validateManifest(manifest, target, home) {
  if (!manifest) return;
  const allowed = new Set([...skillNames, ...legacySkillNames].map((name) => path.join(home, targets[target].skills, name, 'SKILL.md')));
  if (target === 'cursor') allowed.add(path.join(home, cursorRule));
  const configFile = targets[target].config ? path.join(home, targets[target].config) : null;
  if (manifest.version !== 1 || manifest.target !== target || typeof manifest.packageRoot !== 'string' || !path.isAbsolute(manifest.packageRoot) || !Array.isArray(manifest.files) || !Array.isArray(manifest.entries) || manifest.configFile !== configFile || manifest.files.some((file) => !allowed.has(file.path))) throw new Error('Invalid Nail installation manifest; no files changed');
}

function removeEntries(config, entries, target, cli) {
  for (const { event, entry } of entries) {
    if (!Array.isArray(config.hooks?.[event])) continue;
    const groups = config.hooks[event];
    const exact = groups.some(item => isDeepStrictEqual(item, entry));
    let stripped;
    if (target === 'claude' && !exact && entry.hooks?.length === 1) {
      const { args, ...hook } = entry.hooks[0];
      if (Array.isArray(args) && isDeepStrictEqual(args.slice(1), ['hook', '--target', 'claude', '--event', event])) {
        const candidate = { ...entry, hooks: [hook] };
        // Without a matching manifest and one candidate, a bare executable has no ownership marker.
        if (groups.filter(item => isDeepStrictEqual(item, candidate)).length === 1) stripped = candidate;
      }
    }
    config.hooks[event] = groups.filter(item => !isDeepStrictEqual(item, entry) && (!stripped || !isDeepStrictEqual(item, stripped)));
    if (!config.hooks[event].length) delete config.hooks[event];
  }
  if (target !== 'claude') return;
  for (const event of [...hookEvents.claude, 'Stop']) {
    if (!Array.isArray(config.hooks?.[event])) continue;
    const owned = hookEntry(target, event, cli);
    const args = [normalize(cli), 'hook', '--target', target, '--event', event];
    config.hooks[event] = config.hooks[event].filter(group => {
      if (isDeepStrictEqual(group, owned)) return false;
      if (Object.keys(group || {}).length !== 1 || group.hooks?.length !== 1) return true;
      const hook = group.hooks[0];
      return !(hook?.type === 'command' && Array.isArray(hook.args) &&
        isDeepStrictEqual(hook.args.map(arg => typeof arg === 'string' ? normalize(arg) : arg), args));
    });
    if (!config.hooks[event].length) delete config.hooks[event];
  }
}

function bareClaudeNodeEvents(config) {
  return Object.entries(config?.hooks || {}).filter(([, groups]) => Array.isArray(groups) && groups.some(group =>
    Array.isArray(group?.hooks) && group.hooks.some(hook => hook?.type === 'command' && !hook.args &&
      typeof hook.command === 'string' && /(?:^|[\\/])node(?:\.exe)?$/i.test(hook.command)))).map(([event]) => event);
}

async function renderTemplate(packageRoot, source) {
  const template = await readFile(path.join(packageRoot, source), 'utf8');
  return template.replaceAll('{{NAIL_PACKAGE_ROOT}}', normalize(packageRoot)).replaceAll('{{NAIL_CLI}}', normalize(path.join(packageRoot, 'bin/nail.mjs'))).replaceAll('{{NAIL_ROOT}}', '');
}

async function hasCurrentClaudeSkills(home, packageRoot) {
  const manifest = await assertInside(home, path.join(home, '.nail/installations/claude.json'));
  const claude = await readJson(manifest);
  validateManifest(claude, 'claude', home);
  for (const name of skillNames) {
    const file = await assertInside(home, path.join(home, targets.claude.skills, name, 'SKILL.md'));
    const content = await readOptional(file);
    const current = await renderTemplate(packageRoot, path.join('skills', name, 'SKILL.md'));
    if (content !== current || !claude?.files.some(item => item.path === file && item.sha256 === digest(current))) return false;
  }
  return true;
}

async function writeChange({ path: file, content, before }) {
  const check = async () => {
    if (await readOptional(file) !== before) throw new Error(`File changed during installation: ${file}. Close the host and retry.`);
  };
  if (content === null) {
    await check();
    if (before !== null) await unlink(file);
    return;
  }
  if (content === before) { await check(); return; }
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const mode = (await stat(file).catch(error => { if (error.code !== 'ENOENT') throw error; }))?.mode;
  try {
    await writeFile(temporary, content, { mode: mode ?? 0o600, flag: 'wx' });
    if (mode !== undefined && process.platform !== 'win32') await chmod(temporary, mode & 0o777);
    await check();
    await rename(temporary, file);
  } finally { await unlink(temporary).catch(() => {}); }
}

async function applyChanges(changes) {
  const completed = [];
  try {
    for (const change of changes) {
      await writeChange(change);
      completed.push(change);
    }
  } catch (error) {
    for (const change of completed.reverse()) {
      await writeChange({ path: change.path, before: change.content, content: change.before }).catch(() => {});
    }
    throw error;
  }
}

async function installationAction(target, options, action) {
  const { home, manifest } = locations(target, options);
  await assertInside(home, manifest);
  if (options.dryRun) return action(target, options);
  return withLock(path.dirname(manifest), () => action(target, options));
}

export function install(target, options = {}) { return installationAction(target, options, installLocked); }
export function uninstall(target, options = {}) { return installationAction(target, options, uninstallLocked); }

export async function updateInstallations(options = {}) {
  const updated = [];
  const errors = [];
  for (const target of Object.keys(targets)) {
    try {
      const result = await installationAction(target, options, async () => {
        const { home, manifest } = locations(target, options);
        const previous = await readJson(manifest);
        if (!previous) return;
        validateManifest(previous, target, home);
        return installLocked(target, {
          ...options, skillsOnly: previous.entries.length === 0, reuseClaudeSkills: previous.reuseClaudeSkills,
        }, options.dryRun && updated.some(item => item.target === 'claude'));
      });
      if (result) updated.push(result);
    } catch (error) {
      errors.push({ target, error: error.message });
    }
  }
  const next = errors.length ? 'Resolve the reported errors before retrying.' :
    updated.length ? 'Restart your AI tools and open a new chat.' : 'No managed adapters found. Run install --target for your AI tool.';
  return { updated, errors, next };
}

async function installLocked(target, options, claudeSkillsPlanned = false) {
  const { home, spec, manifest: manifestFile } = locations(target, options);
  const manifestBefore = await readOptional(manifestFile);
  const previous = parseJson(manifestBefore, manifestFile);
  validateManifest(previous, target, home);
  const packageRoot = path.resolve(options.packageRoot || ownRoot);
  if (/[\r\n\0]/.test(packageRoot)) throw new Error('Installation paths cannot contain control characters');
  if (process.platform === 'win32' && ['codex', 'gemini'].includes(target) && /[%!$`"]/.test(packageRoot)) throw new Error('This host requires a package path without shell expansion characters');
  const cli = path.join(packageRoot, 'bin', 'nail.mjs');
  const changes = [];
  const files = [];
  if (options.reuseClaudeSkills && target !== 'cursor') throw new Error('--reuse-claude-skills applies only to Cursor.');
  if (options.reuseClaudeSkills && !claudeSkillsPlanned && !await hasCurrentClaudeSkills(home, packageRoot)) throw new Error('Install current Nail skills for Claude first from this checkout and enable Cursor Third-Party Imports.');
  const sources = (options.reuseClaudeSkills ? [] : skillNames).map(name => ({
    source: path.join('skills', name, 'SKILL.md'), destination: path.join(spec.skills, name, 'SKILL.md'),
  }));
  if (target === 'cursor' && !options.skillsOnly) sources.push({ source: 'adapters/cursor/nail.mdc', destination: cursorRule });
  for (const file of previous?.files || []) {
    if (sources.some(item => path.join(home, item.destination) === file.path)) continue;
    await assertInside(home, file.path);
    const before = await readOptional(file.path);
    if (before === null) continue;
    if (digest(before) !== file.sha256) throw new Error(`Preserving an edited ${legacySkillNames.includes(path.basename(path.dirname(file.path))) ? 'legacy skill' : 'installation file'}: ${file.path}. Back up and resolve your edits before upgrading.`);
    changes.push({ path: file.path, content: file.before, before });
  }
  for (const { source, destination } of sources) {
    const content = await renderTemplate(packageRoot, source);
    const file = await assertInside(home, path.join(home, destination));
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
  let backup;
  let warnings = [];
  if (spec.config) {
    configFile = await assertInside(home, path.join(home, spec.config));
    const before = await readOptional(configFile);
    const config = parseJson(before, configFile) || {};
    const original = structuredClone(config);
    configCreated = previous ? previous.configCreated : before === null;
    configHadHooks = previous ? previous.configHadHooks : Object.hasOwn(config, 'hooks');
    configHadVersion = previous ? previous.configHadVersion : Object.hasOwn(config, 'version');
    if (config.hooks !== undefined && (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks))) throw new Error(`Expected hooks object: ${configFile}`);
    removeEntries(config, previous?.entries || [], target, cli);
    if (!options.skillsOnly) {
      config.hooks ||= {};
      for (const event of hookEvents[target]) {
        if (config.hooks[event] !== undefined && !Array.isArray(config.hooks[event])) throw new Error(`Expected hook array for ${event}: ${configFile}`);
        const entry = hookEntry(target, event, cli);
        config.hooks[event] ||= [];
        config.hooks[event].push(entry);
        entries.push({ event, entry });
      }
    }
    if (target === 'cursor' && !options.skillsOnly && config.version === undefined) config.version = 1;
    if (options.skillsOnly && !configHadHooks && config.hooks && !Object.keys(config.hooks).length) delete config.hooks;
    if (options.skillsOnly && target === 'cursor' && !configHadVersion && config.version === 1 && !config.hooks) delete config.version;
    if (target === 'claude') warnings = bareClaudeNodeEvents(config).map(event =>
      `Bare Node hook in ${event} was left in place. Review its origin in ${configFile}.`);
    if (!options.skillsOnly || previous?.entries.length || !isDeepStrictEqual(config, original)) {
      const content = configCreated && !Object.keys(config).length ? null : `${JSON.stringify(config, null, 2)}\n`;
      if (before !== null && before !== content && !options.dryRun) {
        backup = await assertInside(home, `${configFile}.nail-backup-${Date.now()}-${randomUUID()}`);
        changes.push({ path: backup, content: before, before: null });
      }
      changes.push({ path: configFile, content, before });
    }
  }
  const manifest = { version: 1, target, packageRoot, files, configFile, entries, configCreated, configHadHooks, configHadVersion, reuseClaudeSkills: Boolean(options.reuseClaudeSkills) };
  if (!options.dryRun) await applyChanges([...changes, { path: manifestFile, content: `${JSON.stringify(manifest, null, 2)}\n`, before: manifestBefore }]);
  return {
    target, dryRun: Boolean(options.dryRun), files: changes.map((item) => item.path),
    mode: target === 'generic' ? 'manual-handoff' : options.skillsOnly ? 'skills-only' : 'skills-and-hooks',
    verifiedAutomaticCapture: false, backup, warnings,
    next: target === 'generic' ? 'Use the Nail setup prompt and Markdown import/export in the chat tool.' : options.skillsOnly ? 'Restart the host and invoke a Nail skill explicitly.' : 'Restart the host, review hook trust, and enable tracking only in the workspaces you choose.',
  };
}

async function uninstallLocked(target, options) {
  const { home, manifest: manifestFile } = locations(target, options);
  const manifestBefore = await readOptional(manifestFile);
  const manifest = parseJson(manifestBefore, manifestFile);
  if (!manifest) return { target, installed: false, preserved: [], dryRun: Boolean(options.dryRun) };
  validateManifest(manifest, target, home);
  const preserved = [];
  const removable = [];
  const changes = [];
  for (const file of manifest.files) {
    await assertInside(home, file.path);
    const content = await readOptional(file.path);
    if (content === null) continue;
    if (digest(content) !== file.sha256) preserved.push(file.path);
    else {
      removable.push(file);
      changes.push({ path: file.path, content: file.before, before: content });
    }
  }
  if (manifest.configFile && manifest.entries.length) {
    await assertInside(home, manifest.configFile);
    const before = await readOptional(manifest.configFile);
    const config = parseJson(before, manifest.configFile);
    if (config) {
      if (config.hooks !== undefined && (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks))) throw new Error('Invalid hooks object; no files changed');
      removeEntries(config, manifest.entries, target, path.join(manifest.packageRoot, 'bin', 'nail.mjs'));
      if (!manifest.configHadHooks && config.hooks && !Object.keys(config.hooks).length) delete config.hooks;
      if (target === 'cursor' && !manifest.configHadVersion && config.version === 1 &&
          (manifest.configHadHooks || !Object.keys(config.hooks || {}).length)) delete config.version;
      changes.push({ path: manifest.configFile, content: manifest.configCreated && !Object.keys(config).length ? null : `${JSON.stringify(config, null, 2)}\n`, before });
    }
  }
  if (!options.dryRun) {
    manifest.files = manifest.files.filter((item) => preserved.includes(item.path));
    manifest.entries = [];
    await applyChanges([...changes, { path: manifestFile, content: preserved.length ? `${JSON.stringify(manifest, null, 2)}\n` : null, before: manifestBefore }]);
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
        const events = hookEvents[target] || [];
        if (installation.entries.length && (events.some(event => !installation.entries.some(entry => entry.event === event)) ||
            installation.entries.some(({ event, entry }) => !events.includes(event) || (target === 'claude' && entry.hooks?.some(hook => hook.args))))) {
          issues.push(`Older hooks installed. Run update to replace them.`);
        }
        if (installation.reuseClaudeSkills && !await hasCurrentClaudeSkills(home, installation.packageRoot)) issues.push('Cursor relies on missing, old, or edited Claude skills. Reinstall Claude or install standalone Cursor skills.');
        if (installation.files.some(file => legacySkillNames.includes(path.basename(path.dirname(file.path))))) issues.push(`Older short skill names installed. Rerun install --target ${target} to update them.`);
        for (const file of installation.files) {
          const content = await readOptional(file.path);
          if (content === null) missing.push(file.path);
          else if (digest(content) !== file.sha256) issues.push(`Edited installed ${file.path.endsWith('.mdc') ? 'rule' : 'skill'}: ${file.path}`);
        }
        if (installation.configFile) {
          const config = await readJson(installation.configFile);
          if (target === 'claude') for (const event of bareClaudeNodeEvents(config)) issues.push(`Bare Node hook in ${event}. Run update, then review any remaining entries in ${installation.configFile}.`);
          for (const { event, entry } of installation.entries) {
            if (!Array.isArray(config?.hooks?.[event]) || !config.hooks[event].some(value => isDeepStrictEqual(value, entry))) issues.push(`Missing ${event} hook in ${installation.configFile}`);
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
