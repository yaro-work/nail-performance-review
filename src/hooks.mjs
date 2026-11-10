import { trackingStatus } from './config.mjs';
import { managerRefreshDue, readManagerSource } from './manager-source.mjs';
import { validSessionId } from './records.mjs';

export const hookEvents = {
  codex: ['SessionStart', 'UserPromptSubmit'],
  claude: ['SessionStart', 'UserPromptSubmit'],
  cursor: ['sessionStart'],
  gemini: ['SessionStart', 'BeforeAgent'],
};
const capture = 'Do the user’s work first. Before the final reply, quietly use the nail-performance-review-track skill if you started real work, made a useful change, or found something actionable. Save a candidate even after a quick fix or diagnosis, with unknown impact left blank. Check context --tracking first. Skip spelling or formatting-only edits, requests with no work yet, hypothetical examples, and unrelated chat. Respect write limits and never read transcripts.';

export async function runHook(target, event, payload = {}, options = {}) {
  if (!Object.hasOwn(hookEvents, target)) throw new Error(`Unknown hook target: ${target}`);
  // Cursor can also run imported Claude hooks. Apply the same multi-root policy to both shapes.
  const roots = payload?.workspace_roots;
  const cursor = target === 'cursor' || Boolean(process.env.CURSOR_VERSION);
  const [start, prompt] = hookEvents[target];
  const promptCheck = !cursor && roots === undefined && event === prompt;
  if ((event !== start && !promptCheck) || payload?.permission_mode === 'plan') return {};
  if (promptCheck && (typeof payload?.prompt !== 'string' || !payload.prompt.trim() ||
      payload.prompt.trimStart().startsWith('/'))) return {};
  const folders = roots === undefined && !cursor ? [payload?.cwd] : roots;
  if (!Array.isArray(folders) || !folders.length || folders.some(cwd => typeof cwd !== 'string' || !cwd)) return {};
  const multiple = folders.length > 1;
  if (multiple && !cursor) return {};
  const statuses = await Promise.all(folders.map(cwd => trackingStatus({ ...options, cwd })));
  const { root, workspace } = statuses[0];
  if (!root) return {};
  if (multiple && (!statuses.every(status => status.root === root) ||
      !(await trackingStatus({ ...options, all: true })).enabled)) return {};
  let text = `nail-performance-review is active for this workspace. ${capture}`;
  const sessionId = payload?.session_id ?? payload?.conversation_id;
  if (validSessionId(sessionId)) text += ` For the candidate's sessionId, use ${sessionId} (source: ${cursor ? 'cursor' : target}).`;
  if (!promptCheck && !multiple &&
      managerRefreshDue(await readManagerSource(root).catch(() => null), workspace)) {
    text += ' An opted-in manager document check is due. When appropriate and writes are allowed, follow the scheduled manager document steps in the nail-performance-review-setup skill.';
  }
  if (target === 'cursor') return { additional_context: text };
  return { hookSpecificOutput: { hookEventName: event, additionalContext: text } };
}
