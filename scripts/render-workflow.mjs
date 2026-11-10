import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const colors = { background: '#091b25', card: '#102934', line: '#284955', text: '#edf8f6', muted: '#a9c3ca', teal: '#51dfbc', amber: '#ffc47b', blue: '#91c9ee' };
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const text = (x, y, value, size = 18, fill = colors.text, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const lines = (x, y, values, fill = colors.muted) => values.map((value, index) => text(x, y + index * 25, value, 18, fill)).join('');
const pill = (x, y, width, value, color = colors.teal) => `<rect x="${x}" y="${y}" width="${width}" height="30" rx="7" fill="${color}" fill-opacity=".09" stroke="${color}" stroke-opacity=".35"/>${text(x + 12, y + 21, value, 15, color)}`;

function card(index, x, y) {
  const labels = ['DAY 0 / SETUP', 'DAY 37 / PROJECT ABCD', 'AFTER A REAL MILESTONE', '', 'NEXT CHECK-IN / OUTCOMES', ''];
  const titles = ['Set your direction', 'Start the project', 'Once you start implementing', 'Collect the outcome', 'Keep the measured impact', 'Help with your growth'];
  const accents = [colors.teal, colors.blue, colors.teal, colors.amber, colors.teal, colors.blue];
  const accent = accents[index];
  let body = `<g class="card" data-step="${index + 1}" transform="translate(${x},${y})"><rect width="364" height="300" rx="16" fill="${colors.card}" stroke="${colors.line}"/><rect x="0" y="25" width="3" height="35" rx="1" fill="${accent}"/>${labels[index] ? text(24, 35, labels[index], 12, accent, 'letter-spacing="1.3" font-family="ui-monospace,Consolas,monospace"') : ''}${text(24, 73, titles[index], index === 2 ? 22 : 24, colors.text, 'font-weight="650"')}`;
  if (index === 0) body += pill(24, 92, 316, 'nail-performance-review-setup', accent) + lines(24, 152, ['Paste company + growth goals.', 'Company: Google Cloud → AWS.', 'Growth: Senior → Staff.']) + pill(24, 245, 296, 'Add your company’s career ladder', accent);
  if (index === 1) body += `<rect x="24" y="96" width="316" height="62" rx="8" fill="${colors.background}"/>` + lines(36, 121, ['Redesigning infrastructure', 'for application ABCD'], colors.text) + lines(24, 190, ['Your AI chat can load your goals.', 'It checks the project’s fit.']) + text(24, 250, 'A plan alone is not saved as an achievement.', 15, colors.muted) + text(24, 276, 'You need to reach a real milestone.', 16, colors.muted);
  if (index === 2) body += lines(24, 115, ['You implement the staged rollout', 'with Avery.']) + lines(24, 190, ['The plugin’s tracking skill notices', 'the milestone and adds it to your', 'in-progress achievements.'], colors.teal) + text(24, 277, 'Your contribution + shared credit', 16, colors.muted);
  if (index === 3) body += text(24, 110, 'Your AI chat quietly checks:', 16, colors.amber) + text(24, 142, '“Is the project almost ready?”', 20, colors.text) + pill(24, 167, 139, 'Not ready? Quiet.', colors.muted) + pill(174, 167, 166, 'Ready? Ask below.', colors.amber) + lines(24, 228, ['“Which KPIs or outcomes', 'can we, or should we, measure?”'], colors.text) + text(24, 285, 'Fires only when a reminder is eligible.', 16, colors.muted);
  if (index === 4) body += text(24, 128, '100 → 50 ms', 43, colors.teal, 'font-weight="700"') + pill(24, 150, 296, 'Fictional: 50% lower p95 latency', colors.teal) + lines(24, 211, ['Once you and your AI establish', 'what improved measurably, it', 'saves it with supporting links.']);
  if (index === 5) body += lines(24, 111, ['The plugin checks your project', 'against your Senior → Staff goal.']) + lines(24, 181, ['It might suggest a broader demo', 'or applying the learning to', 'other projects.'], colors.text) + text(24, 267, 'Suggestions follow the career ladder', 16, colors.blue) + text(24, 289, 'you added in step 1. ↗', 16, colors.blue);
  return body + '</g>';
}

function render(mobile) {
  const width = mobile ? 412 : 1240;
  const height = mobile ? 2340 : 1000;
  const positions = mobile ? Array.from({ length: 6 }, (_, i) => [24, 190 + i * 334]) : [[44, 180], [438, 180], [832, 180], [44, 560], [438, 560], [832, 560]];
  const arrow = d => `<path d="${d}" fill="none" stroke="${colors.teal}" stroke-opacity=".65" stroke-width="2" marker-end="url(#arrow)"/>`;
  const arrows = (mobile
    ? positions.slice(0, -1).map(([x, y]) => arrow(`M${x + 182} ${y + 300} V${y + 334 - 8}`)).join('')
    : arrow('M408 330 H428') + arrow('M802 330 H822') + arrow('M1014 480 V518 H226 V550') + arrow('M408 710 H428') + arrow('M802 710 H822')) + `<g stroke-dasharray="5 5">${arrow(mobile ? 'M388 2150 H400 V245 H392' : 'M1196 820 H1218 V161 H226 V172')}</g>`;
  const header = mobile
    ? text(24, 40, 'NAIL-PERFORMANCE-REVIEW / WORKFLOW', 11, colors.teal, 'letter-spacing="1.2"') + text(24, 84, 'Your goals. Your work.', 28, colors.text, 'font-weight="700"') + text(24, 119, 'Your evidence.', 28, colors.text, 'font-weight="700"') + text(24, 154, 'One project, from Senior toward Staff.', 17, colors.muted)
    : text(44, 48, 'NAIL-PERFORMANCE-REVIEW / WORKFLOW', 13, colors.teal, 'letter-spacing="2"') + text(44, 105, 'Your goals. Your work. Your evidence.', 43, colors.text, 'font-weight="700"') + text(44, 141, 'One infrastructure project, from Senior toward Staff.', 20, colors.muted);
  const footer = mobile
    ? lines(24, 2225, ['Your AI chat checks the current work.', 'It asks when a reminder is eligible.', 'Fictional project and measurements.'])
    : text(44, 918, 'Tracking starts only in workspaces you enable.', 20, colors.text) + text(44, 951, 'Prompts: one per session, two per rolling seven days. Fictional project and example measurements.', 17, colors.muted);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">nail-performance-review: from goals to measured project evidence</title><desc id="description">Illustrative six-step workflow. Set a Google Cloud to AWS migration goal and a Senior-to-Staff growth goal, start an infrastructure project, record an implementation milestone, consider whether the project is nearly ready, record p95 latency changing from 100 to 50 milliseconds, and consider growth suggestions informed by the career ladder from step one. Your AI chat judges progress from the conversation; the plugin does not independently monitor project completion or dashboards.</desc><defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${colors.line}" fill-opacity=".5"/></pattern><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="${colors.teal}" stroke-width="1.2"/></marker></defs><rect width="100%" height="100%" rx="18" fill="${colors.background}"/><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="18" fill="url(#dots)" stroke="${colors.line}"/><g font-family="Segoe UI,Arial,sans-serif">${header}${arrows}${positions.map(([x, y], index) => card(index, x, y)).join('')}${footer}</g></svg>\n`;
}

const output = path.join(root, 'docs/assets');
await fs.mkdir(output, { recursive: true });
for (const mobile of [false, true]) {
  const file = path.join(output, `project-workflow${mobile ? '-mobile' : ''}.svg`);
  await fs.writeFile(file, render(mobile));
  console.log(path.relative(root, file));
}
