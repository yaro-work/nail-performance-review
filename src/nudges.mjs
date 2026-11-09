import path from 'node:path';
import { readOptional, atomicWrite, withLock, assertInside, slug, markdown } from './storage.mjs';
import { readDocument, readPriorityDecisions, text, fingerprint } from './records.mjs';

export async function nudge(root, options = {}) {
  const project = slug(options.project, 'project');
  const reason = options.reason || 'alignment';
  if (!['alignment', 'outcomes', 'sharing'].includes(reason)) throw new Error('Unknown reminder reason.');
  text(options.session, 'session', true);
  const action = options.action || 'show';
  if (!['show', 'snooze', 'dismiss', 'approve', 'continue'].includes(action)) throw new Error('Unknown reminder action.');
  if (action === 'continue') {
    if (reason !== 'alignment') throw new Error('Continue records an alignment decision only.');
    text(options.note, 'decision note', true);
  }
  const days = Number(options.days || 7);
  if (action === 'snooze' && ![7, 30].includes(days)) throw new Error('Snooze must be 7 or 30 days.');
  return withLock(root, async () => {
    const goals = await readDocument(root, 'goals');
    const profile = await readDocument(root, 'profile');
    const file = await assertInside(root, path.join(root, '.nail-reminders.json'));
    const existing = await readOptional(file);
    const state = existing ? JSON.parse(existing) : { schema: 1, receipts: [], decisions: {} };
    if (state.schema !== 1 || !Array.isArray(state.receipts) || !state.decisions) throw new Error('Invalid reminder state.');
    const now = options.now ? new Date(options.now).getTime() : Date.now();
    if (!Number.isFinite(now)) throw new Error('Invalid reminder time.');
    const key = `${project}:${reason}:${fingerprint(goals.items)}`;
    if (action === 'continue') {
      const decisionFile = await assertInside(root, path.join(root, 'decisions', `${project}-${fingerprint(goals.items)}.md`));
      await atomicWrite(decisionFile, markdown({ schema: 1, type: 'priority-decision', project, action, goalsFingerprint: fingerprint(goals.items), recordedAt: new Date(now).toISOString() }, options.note));
      return { shown: false, action, project, reason, file: decisionFile };
    }
    if (action === 'show' && reason === 'alignment' && (await readPriorityDecisions(root)).some(item => item.project === project && item.goalsFingerprint === fingerprint(goals.items))) return { shown: false, suppressed: 'user-choice' };
    const decision = state.decisions[key];
    if (action !== 'show') {
      state.decisions[key] = { action, until: action === 'snooze' ? now + days * 86400000 : null };
      await atomicWrite(file, `${JSON.stringify(state, null, 2)}\n`);
      return { shown: false, action, project, reason };
    }
    if (decision && (decision.action !== 'snooze' || decision.until > now)) return { shown: false, suppressed: decision.action };
    if (state.receipts.some(receipt => receipt.session === options.session)) return { shown: false, suppressed: 'session-budget' };
    if (state.receipts.filter(receipt => receipt.at > now - 7 * 86400000).length >= 2) return { shown: false, suppressed: 'weekly-budget' };
    if (state.receipts.some(receipt => receipt.key === key && (!decision || decision.action !== 'snooze'))) return { shown: false, suppressed: 'already-shown' };
    let message;
    if (reason === 'alignment') message = goals.items.length ? `I couldn't match ${project} to your saved goals. Would you like to connect it to a goal, add an agreed goal, or work on it anyway? If it doesn't benefit your priorities, consider whether it's worth your time. I'll remember your choice for this project and goal set.` : `Your goals are not recorded yet. Add them when ready; this does not mean ${project} is out of scope.`;
    else if (reason === 'outcomes') message = `For ${project}, is there a useful before-and-after result or feedback link to record? Leave measurements unknown if they have not been collected.`;
    else message = `Would sharing the lessons from ${project} help others and support your ${profile.level || 'role'} expectations? Record a talk, handoff, or useful document if relevant.`;
    state.receipts.push({ key, session: options.session, at: now });
    await atomicWrite(file, `${JSON.stringify(state, null, 2)}\n`);
    return { shown: true, message, project, reason };
  });
}
