import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRecord, updateDocument } from '../src/records.mjs';
export const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function fixture(t) {
  const scratch = path.join(packageRoot, '.scratch');
  await fs.mkdir(scratch, { recursive: true });
  const base = await fs.mkdtemp(path.join(scratch, 'test-'));
  t.after(async () => {
    if (!base.startsWith(scratch + path.sep)) throw new Error('Unexpected cleanup path.');
    await fs.rm(base, { recursive: true, force: true });
  });
  const root = path.join(base, 'performance unicode Ω');
  const home = path.join(base, 'home with spaces');
  await initRecord({ root, home, name: 'work', timezone: 'UTC', start: '2026-01-01', end: '2026-12-31' });
  await updateDocument(root, 'goals', { items: [{ id: 'reliability', title: 'Improve reliability' }] });
  return { root, home, base, env: { ...process.env, NAIL_HOME: home, NAIL_CONFIG: path.join(home, 'nail', 'config.json') } };
}
export function evidence(overrides = {}) {
  return { date: '2026-05-10', project: 'migration', goals: ['reliability'], source: 'codex', state: 'delivered', basis: 'observed', contribution: 'Designed the retry strategy.', outcome: 'The team shipped the migration.', collaborators: ['Alex'], links: ['https://example.com/pr/123'], metrics: [], ...overrides };
}
