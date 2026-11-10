import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Both hosts discover hooks/hooks.json. Only Gemini expands the extension path argument.
const target = path.isAbsolute(process.argv[1] || '') ? 'gemini' : 'claude';
const cli = fileURLToPath(new URL('../bin/nail.mjs', import.meta.url));
process.argv = [process.execPath, cli, 'hook', '--target', target, '--event', 'SessionStart'];
await import('../bin/nail.mjs');
