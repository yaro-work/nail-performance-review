import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { initRecord, updateDocument, saveEvidence } from '../src/records.mjs';
import { htmlReport } from '../src/report.mjs';

const directory = path.resolve('.scratch/visual');
await fs.mkdir(directory, { recursive: true });
const root = path.join(directory, 'performance');
await initRecord({ root, home: path.join(directory, 'home'), name: 'visual', role: 'Senior engineer', timezone: 'America/New_York', start: '2026-01-01', end: '2026-12-31' });
await updateDocument(root, 'goals', { items: [{ id: 'reliability', title: 'Make releases easier to recover' }, { id: 'sharing', title: 'Share operational knowledge' }] });
const records = [
  { id: '11111111-1111-4111-8111-111111111111', date: '2026-05-10', project: 'service-migration', goals: ['reliability'], source: 'fictional-demo', state: 'measured', basis: 'reported', contribution: 'Designed a staged rollout with Avery and wrote the recovery procedure.', outcome: 'The team completed the migration. A timed recovery exercise took 8 minutes instead of 20.', collaborators: ['Avery', 'Platform team'], links: ['https://example.com/projects/migration'], metrics: [{ name: 'Recovery exercise', before: 20, after: 8, unit: 'minutes', source: 'https://example.com/measurements/recovery', measuredAt: '2026-05-10' }] },
  { id: '22222222-2222-4222-8222-222222222222', date: '2026-06-15', project: 'migration-handoff', goals: ['sharing'], source: 'fictional-demo', state: 'delivered', basis: 'reported', contribution: 'Ran a handoff workshop with Sam for the support team.', outcome: 'Published the troubleshooting guide and collected questions. Adoption has not been measured.', collaborators: ['Sam', 'Support team'], links: ['https://example.com/notes/handoff'], metrics: [] },
];
for (const record of records) await saveEvidence(root, record);
const { html } = await htmlReport(root, { period: '2026-H1' });
const file = path.join(directory, 'report.html');
await fs.writeFile(file, html);
const require = createRequire(import.meta.url);
const modulePath = process.env.NAIL_BROWSER_MODULE || 'playwright';
const { chromium } = require(modulePath);
const browser = await chromium.launch({ headless: true, ...(process.env.NAIL_BROWSER_EXECUTABLE ? { executablePath: process.env.NAIL_BROWSER_EXECUTABLE } : {}) });
try {
  for (const [name, width] of [['desktop', 1280], ['phone', 390]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(pathToFileURL(file).href);
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, records: document.querySelectorAll('article').length, heading: document.querySelector('h1').textContent }));
    if (layout.scrollWidth > layout.width || layout.records !== 2) throw new Error(`Unexpected ${name} layout: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
    console.log(JSON.stringify({ viewport: name, ...layout }));
    await page.close();
  }
} finally { await browser.close(); }
console.log(file);
