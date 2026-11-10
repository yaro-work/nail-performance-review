#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { resolveRoot, readConfig, setTracking, trackingRoot, trackingStatus } from '../src/config.mjs';
import { initRecord, listEvidence, saveEvidence, triageEvidence, updateDocument, doctor, exportBundle, importBundle } from '../src/records.mjs';
import { getContext } from '../src/context.mjs';
import { nudge } from '../src/nudges.mjs';
import { reviewPacket, period } from '../src/reviews.mjs';
import { htmlReport } from '../src/report.mjs';
import { atomicWrite, assertInside, readOptional } from '../src/storage.mjs';
import { install, uninstall, inspectInstallations, updateInstallations } from '../src/install.mjs';
import { runHook } from '../src/hooks.mjs';
import { pullAndRefresh } from '../src/update.mjs';
import { claimManagerRefresh, completeManagerRefresh, configureManagerSource, managerSourceStatus, pauseManagerRefresh, readManagerSources } from '../src/manager-source.mjs';

const help = `nail-performance-review\n\nUsage: node bin/nail.mjs COMMAND [options]\n\nCommands:\n  init                          Create or resume a private record\n  doctor                        Check data and installation capabilities\n  profile|goals|project --stdin  Update structured settings\n  record|amend --stdin           Save an achievement or correction\n  tracking --enable|--disable|--reset|--status [--all|--cwd FOLDER]  Control automatic tracking\n    Add --recursive to enable a folder and its descendants. Use tracking --manual to turn off automatic capture.\n  inbox [--period YYYY]         List achievements awaiting review\n  triage --id ID --action include|exclude\n  manager-source                Manage linked document checks\n  context [--project ID] [--tracking]        Load bounded shared context\n  nudge --session ID --project ID [--reason alignment|outcomes|sharing]\n  review [--period YYYY-H1]     Prepare an evidence packet for the assistant\n  report [--period YYYY-H1]     Generate an offline HTML overview\n  export --output ABS           Save a portable Markdown handoff\n  import --input ABS            Import a handoff without duplicating records\n  install|uninstall --target codex|claude|cursor|gemini|generic [--dry-run]\n  update [--pull|--dry-run]      Refresh all terminal-managed adapters\nInstall options: --skills-only, --reuse-claude-skills (Cursor)\n\nCommon options: --root ABS, --name RECORD, --cwd PROJECT, --start YYYY-MM-DD, --end YYYY-MM-DD\nSetup options: --manual, --role ROLE, --timezone IANA, --period YYYY|YYYY-H1|YYYY-H2, --bind\nNudge actions: --action show|snooze|dismiss|approve|continue [--days 7|30]\nUse --action continue --note "response" to remember a choice to work outside goals.\nreview --output ABS saves its packet. report --output ABS selects its HTML destination.\nNo cloud service, telemetry, raw transcript collection, or automatic AI API calls.\n`;

async function inputJSON() {
  let text = '';
  for await (const chunk of process.stdin) {
    text += chunk;
    if (Buffer.byteLength(text) > 2_000_000) throw new Error('Input exceeds the 2 MB limit.');
  }
  try { return JSON.parse(text); } catch { throw new Error('Expected a JSON object on stdin.'); }
}
async function outputFile(file, content) {
  if (!path.isAbsolute(file)) throw new Error('--output must be an absolute path.');
  if (await readOptional(file) !== undefined) throw new Error('Output already exists. Choose a new output filename.');
  await atomicWrite(file, content);
  return { output: file };
}
async function main() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) throw new Error('nail-performance-review requires Node.js 22 or later.');
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries([
      ...['root', 'name', 'cwd', 'role', 'timezone', 'level', 'start', 'end', 'period', 'project', 'session', 'reason', 'action', 'note', 'days', 'target', 'event', 'output', 'input', 'id'].map(key => [key, { type: 'string' }]),
      ...['stdin', 'dry-run', 'bind', 'help', 'version', 'tracking', 'enable', 'disable', 'reset', 'status', 'all', 'recursive', 'manual', 'pull', 'claim', 'checked', 'skills-only', 'reuse-claude-skills'].map(key => [key, { type: 'boolean' }]),
    ]),
  });
  const [command, ...extra] = positionals;
  if (extra.length) throw new Error('Unexpected positional arguments.');
  if (values.version) return console.log('0.1.0');
  if (!command || values.help) return console.log(help);
  const options = { ...values, dryRun: values['dry-run'] || false, packageRoot: path.dirname(path.dirname(fileURLToPath(import.meta.url))) };
  if (options.manual && command !== 'init' && command !== 'tracking') throw new Error('--manual is only used by init or tracking.');
  if (options.recursive && (command !== 'tracking' || !options.enable || options.all)) throw new Error('--recursive is only used to enable a selected folder.');
  if (options.all && command !== 'tracking') throw new Error('--all is only used by tracking.');
  if (options.reset && command !== 'tracking') throw new Error('--reset is only used by tracking.');
  if (options.pull && command !== 'update') throw new Error('--pull is only used by update.');
  if (values.stdin && !['record', 'amend', 'profile', 'goals', 'project', 'manager-source'].includes(command)) throw new Error('--stdin is not used by this command.');
  let result;
  if (command === 'init') {
    if (options.period) {
      const match = /^(\d{4})(?:-(H[12]))?$/.exec(options.period);
      if (!match || options.start || options.end) throw new Error('Use --period YYYY|YYYY-H1|YYYY-H2 or explicit dates.');
      options.start = `${match[1]}-${match[2] === 'H2' ? '07' : '01'}-01`;
      options.end = `${match[1]}-${match[2] === 'H1' ? '06-30' : '12-31'}`;
    }
    result = await initRecord(options);
    if (options.bind) {
      const binding = path.join(path.resolve(options.cwd || process.cwd()), '.nail.json');
      const value = `${JSON.stringify({ schema: 1, record: options.name || 'work' }, null, 2)}\n`;
      const existing = await readOptional(binding);
      if (existing !== undefined && existing !== value) throw new Error('An existing project binding points elsewhere. Edit it explicitly.');
      await atomicWrite(binding, value);
      result.binding = binding;
    }
  } else if (command === 'tracking') {
    if ([options.enable, options.disable, options.reset, options.status, options.manual].filter(Boolean).length !== 1 || options.root ||
        (!options.enable && options.name) || (options.all && (options.cwd || options.reset)) || (options.manual && (options.cwd || options.all))) {
      throw new Error('Use tracking --enable, --disable, --reset, or --status with a folder or --all where applicable. Use tracking --manual on its own.');
    }
    if (options.status) {
      const { root, ...status } = await trackingStatus(options);
      result = status;
    } else result = await setTracking(options);
  } else if (command === 'manager-source') {
    if ((options.disable && (options.stdin || options.checked || options.claim)) ||
        (options.claim && (options.stdin || options.checked)) || (options.checked && !options.stdin) ||
        (options.tracking && (!options.claim || options.root || options.name))) throw new Error('Invalid manager-source options.');
    if (options.tracking) {
      const { root, workspace } = await trackingStatus(options);
      result = root ? await claimManagerRefresh(root, { id: options.id, workspace }) : { due: false };
    } else {
      const root = await resolveRoot(options);
      if (options.claim) result = await claimManagerRefresh(root, { id: options.id });
      else if (options.disable) result = await pauseManagerRefresh(root, options.id);
      else if (options.checked) result = await completeManagerRefresh(root, await inputJSON());
      else if (options.stdin) {
        result = await configureManagerSource(root, await inputJSON(), {
          workspace: options.cwd,
          authorizeWorkspace: async cwd => {
            if (!cwd) throw new Error('Confirm a specific enabled workspace with --cwd.');
            const status = await trackingStatus({ ...options, cwd });
            if (status.root !== root) throw new Error('Enable tracking for this record in the selected workspace first.');
            return status.workspace;
          },
        });
        if (result.intervalDays) result.next = `Use manager-source --disable --id ${result.id} to pause. Pass id and intervalDays on stdin to change the schedule.`;
      } else {
        const sources = (await readManagerSources(root)).map(managerSourceStatus);
        result = { configured: Boolean(sources.length), ...(sources.length === 1 ? sources[0] : {}), sources };
      }
    }
  } else if (command === 'context' && options.tracking) {
    if (options.root || options.name) throw new Error('Tracking context uses the workspace’s authorized record.');
    const root = await trackingRoot(options.cwd || process.cwd(), options);
    if (!root) throw new Error('Tracking is not enabled for this workspace.');
    return console.log(await getContext(root, options));
  } else if (['install', 'uninstall'].includes(command)) {
    if (!options.target) throw new Error('--target is required.');
    result = await (command === 'install' ? install : uninstall)(options.target, {
      ...options, skillsOnly: values['skills-only'], reuseClaudeSkills: values['reuse-claude-skills'],
    });
  } else if (command === 'update') {
    if (options.target || values['skills-only'] || values['reuse-claude-skills']) throw new Error('update refreshes all managed adapters in their existing modes. Use install --target to change a mode.');
    if (options.pull) {
      if (options.dryRun) throw new Error('Use update --dry-run to preview the current checkout, or update --pull to apply an update.');
      process.exitCode = await pullAndRefresh(options.packageRoot);
      return;
    }
    result = await updateInstallations(options);
    if (result.errors.length) process.exitCode = 1;
  } else if (command === 'hook') {
    let payload, hookError;
    try { payload = await inputJSON(); result = await runHook(options.target, options.event, payload, options); }
    catch (error) { hookError = error.message; process.stderr.write(`nail-performance-review hook skipped: ${error.message}\n`); result = {}; }
    if (process.env.NAIL_HOOK_RECEIPTS) {
      try {
        if (!path.isAbsolute(process.env.NAIL_HOOK_RECEIPTS)) throw new Error('Receipt path must be absolute.');
        const receipt = { target: options.target, event: options.event, ok: !hookError, context: Boolean(result.hookSpecificOutput?.additionalContext || result.additional_context), empty: Object.keys(result).length === 0, outputHash: createHash('sha256').update(JSON.stringify(result)).digest('hex') };
        await fs.appendFile(process.env.NAIL_HOOK_RECEIPTS, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
      } catch (error) { process.stderr.write(`nail-performance-review hook receipt skipped: ${error.message}\n`); }
    }
  } else {
    const root = await resolveRoot(options);
    if (['record', 'amend', 'profile', 'goals', 'project'].includes(command)) {
      if (!values.stdin) throw new Error(`${command} requires --stdin.`);
      const input = await inputJSON();
      result = ['record', 'amend'].includes(command) ? await saveEvidence(root, input, { amendment: command === 'amend' }) : await updateDocument(root, command, input);
    } else if (command === 'context') return console.log(await getContext(root, options));
    else if (command === 'nudge') result = await nudge(root, options);
    else if (command === 'inbox') {
      if (options.action && !['candidate', 'excluded'].includes(options.action)) throw new Error('Use inbox or inbox --action excluded.');
      const evidence = await listEvidence(root, await period(root, options));
      result = evidence.filter(record => record.reviewStatus === (options.action || 'candidate'));
    } else if (command === 'triage') result = await triageEvidence(root, options.id, options.action);
    else if (command === 'doctor') {
      result = { ...await doctor(root), installations: await inspectInstallations(options), configuration: await readConfig(options) };
      try { await readManagerSources(root); } catch (error) { result.errors.push(`Document sources: ${error.message}`); }
      for (const installation of result.installations) {
        result.errors.push(...installation.issues, ...installation.missing.map(file => `Missing installed file: ${file}`));
      }
      result.ok = result.errors.length === 0;
      if (!result.ok) process.exitCode = 1;
    } else if (command === 'review') {
      const packet = await reviewPacket(root, options);
      if (!options.output) return console.log(packet.markdown);
      result = await outputFile(options.output, packet.markdown);
    } else if (command === 'report') {
      const packet = await htmlReport(root, options);
      const file = options.output || path.join(root, 'exports', `${packet.start}-${packet.end}-${randomUUID()}.html`);
      if (!options.output) await assertInside(root, file);
      result = await outputFile(file, packet.html);
    } else if (command === 'export') {
      if (!options.output) throw new Error('export requires --output ABS.');
      result = await outputFile(options.output, await exportBundle(root, await period(root, options)));
    } else if (command === 'import') {
      if (!options.input || !path.isAbsolute(options.input)) throw new Error('import requires --input ABS.');
      const stat = await fs.stat(options.input);
      if (stat.size > 10_000_000) throw new Error('Handoff exceeds the 10 MB limit.');
      result = await importBundle(root, await fs.readFile(options.input, 'utf8'));
    } else throw new Error(`Unknown command: ${command}. Use --help.`);
  }
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(`nail-performance-review: ${error.message}`); process.exitCode = 1; });
