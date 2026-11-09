#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { resolveRoot, readConfig } from '../src/config.mjs';
import { initRecord, saveEvidence, updateDocument, doctor, exportBundle, importBundle } from '../src/records.mjs';
import { getContext } from '../src/context.mjs';
import { nudge } from '../src/nudges.mjs';
import { reviewPacket, period } from '../src/reviews.mjs';
import { htmlReport } from '../src/report.mjs';
import { atomicWrite, assertInside, readOptional } from '../src/storage.mjs';
import { install, uninstall, inspectInstallations } from '../src/install.mjs';
import { runHook } from '../src/hooks.mjs';

const help = `nail-performance-review\n\nUsage: node bin/nail.mjs COMMAND [options]\n\nCommands:\n  init                          Create or resume a private record\n  doctor                        Check data and installation capabilities\n  profile|goals|project --stdin  Update structured settings\n  record|amend --stdin           Save an achievement or correction\n  context [--project ID]        Load bounded shared context\n  nudge --session ID --project ID [--reason alignment|outcomes|sharing]\n  review [--period YYYY-H1]     Prepare an evidence packet for the assistant\n  report [--period YYYY-H1]     Generate an offline HTML overview\n  export --output ABS           Save a portable Markdown handoff\n  import --input ABS            Import a handoff without duplicating records\n  install|uninstall --target codex|claude|cursor|gemini|generic [--dry-run]\n\nCommon options: --root ABS, --name RECORD, --cwd PROJECT, --start YYYY-MM-DD, --end YYYY-MM-DD\nSetup options: --role ROLE, --timezone IANA, --period YYYY|YYYY-H1|YYYY-H2, --bind\nNudge actions: --action show|snooze|dismiss|approve|continue [--days 7|30]\nUse --action continue --note "response" to remember a choice to work outside goals.\nreview --output ABS saves its packet. report --output ABS selects its HTML destination.\nNo cloud service, telemetry, raw transcript collection, or automatic AI API calls.\n`;

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
      ...['root', 'name', 'cwd', 'role', 'timezone', 'level', 'start', 'end', 'period', 'project', 'session', 'reason', 'action', 'note', 'days', 'target', 'event', 'output', 'input'].map(key => [key, { type: 'string' }]),
      ...['stdin', 'dry-run', 'bind', 'help', 'version'].map(key => [key, { type: 'boolean' }]),
    ]),
  });
  const [command, ...extra] = positionals;
  if (extra.length) throw new Error('Unexpected positional arguments.');
  if (values.version) return console.log('0.1.0');
  if (!command || values.help) return console.log(help);
  const options = { ...values, dryRun: values['dry-run'] || false, packageRoot: path.dirname(path.dirname(fileURLToPath(import.meta.url))) };
  if (values.stdin && !['record', 'amend', 'profile', 'goals', 'project'].includes(command)) throw new Error('--stdin is not used by this command.');
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
  } else if (['install', 'uninstall'].includes(command)) {
    if (!options.target) throw new Error('--target is required.');
    result = await (command === 'install' ? install : uninstall)(options.target, options);
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
    else if (command === 'doctor') {
      result = { ...await doctor(root), installations: await inspectInstallations(options), configuration: await readConfig(options) };
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
