import { trackingRoot } from './config.mjs';

const starts = { codex: 'SessionStart', claude: 'SessionStart', cursor: 'sessionStart', gemini: 'SessionStart' };
const milestoneCue = /\b(?:done|finished|fixed|delivered|shipped|merged|resolved|completed|accepted|root cause)\b/i;
const capture = 'Before the final reply, use the nail-performance-review-track skill when this turn establishes a real work milestone. A finished review, a delivered change, or helping another team resolve an issue can count. Check context --tracking before reading the record. Skip plans, routine edits, hypothetical tests, and turns without a real result. Respect write limits and never read transcripts.';

export async function runHook(target, event, payload = {}, options = {}) {
  if (!Object.hasOwn(starts, target)) throw new Error(`Unknown hook target: ${target}`);
  // Cursor can also run imported Claude hooks. Apply the same multi-root policy to both shapes.
  const roots = payload?.workspace_roots;
  const cursor = target === 'cursor' || Boolean(process.env.CURSOR_VERSION);
  const promptCheck = target === 'claude' && !cursor && roots === undefined && event === 'UserPromptSubmit';
  if (event !== starts[target] && !promptCheck) return {};
  if (promptCheck && (payload?.permission_mode === 'plan' || typeof payload?.prompt !== 'string' ||
      payload.prompt.trimStart().startsWith('/') || !milestoneCue.test(payload.prompt))) return {};
  const cwd = roots === undefined && !cursor ? payload?.cwd :
    Array.isArray(roots) && roots.length === 1 ? roots[0] : undefined;
  if (typeof cwd !== 'string' || !cwd) return {};
  if (!await trackingRoot(cwd, options)) return {};
  const text = `nail-performance-review is active for this workspace. ${capture}`;
  if (target === 'cursor') return { additional_context: text };
  return { hookSpecificOutput: { hookEventName: event, additionalContext: text } };
}
