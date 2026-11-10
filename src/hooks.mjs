import { trackingRoot } from './config.mjs';

const starts = { codex: 'SessionStart', claude: 'SessionStart', cursor: 'sessionStart', gemini: 'SessionStart' };

export async function runHook(target, event, payload = {}, options = {}) {
  if (!Object.hasOwn(starts, target)) throw new Error(`Unknown hook target: ${target}`);
  if (event !== starts[target]) return {};
  // Cursor can also run imported Claude hooks. Apply the same multi-root policy to both shapes.
  const roots = payload?.workspace_roots;
  const cursor = target === 'cursor' || Boolean(process.env.CURSOR_VERSION);
  const cwd = roots === undefined && !cursor ? payload?.cwd :
    Array.isArray(roots) && roots.length === 1 ? roots[0] : undefined;
  if (typeof cwd !== 'string' || !cwd) return {};
  if (!await trackingRoot(cwd, options)) return {};
  const text = 'nail-performance-review is active for this workspace. At a meaningful milestone, use the nail-performance-review-track skill and its context --tracking command. If tracking context is unavailable, skip capture quietly. Use only this authorized chat. Never read transcripts, invent impact, block work, or start an extra turn.';
  if (target === 'cursor') return { additional_context: text };
  return { hookSpecificOutput: { hookEventName: event, additionalContext: text } };
}
