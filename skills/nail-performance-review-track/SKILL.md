---
name: nail-performance-review-track
description: Record meaningful achievements and check goal alignment while helping with an active work project in an existing nail-performance-review record.
---

# Track meaningful work

Use the installed nail-performance-review CLI at `{{NAIL_PACKAGE_ROOT}}/bin/nail.mjs`. If unresolved, find the package root two directories above this skill file. Quote paths and run the CLI with Node.

For automatic capture, start only when the startup hook says tracking is active for this workspace. At a meaningful milestone run `context --tracking` from the workspace root. If it fails, skip capture quietly. Do not fall back to ordinary context, guess the record, or read private files directly. Add `--project ID` when you know the matching project.

Use the exact record directory returned by tracking context as `--root` for subsequent commands in that capture. This keeps repository bindings from selecting a different record. Keep private record content out of work artifacts and normal task responses.

If the user explicitly asks to track work in this chat, confirm which record to use if unclear, then load ordinary `context` for that record and project.

Respect host plan or read-only mode. Do not write performance notes while writes are prohibited. If no record exists, route to nail-performance-review-setup rather than creating a hidden record.

During authorized work, capture a meaningful milestone before the final response when the current context supports one. Useful milestones include a delivered change, documented decision, completed analysis, resolved incident, or contribution that enabled colleagues.

Skip routine edits, speculative plans, irrelevant personal activity, and the act of maintaining the performance record itself. Do not copy raw transcripts.

For routine edits, give the normal task response without announcing the tracking decision unless the user asks.

Keep tracking updates focused on the user's result. Avoid internal skill names, command names, and repeated plan announcements. If the host requires a skill disclosure, make it brief and describe the user outcome in plain language.

Use `record --stdin` with the shape in `{{NAIL_PACKAGE_ROOT}}/references/record-format.md`. Create the relevant project and goals first if needed. Reuse the event ID when retrying the same capture.

Separate the person's contribution, collaborators, and team outcome. Distinguish in-progress work, delivery, and measured impact. Label observations, user reports, and inferences honestly.

Ask for a missing link or metric only when it materially strengthens the record. Preserve useful qualitative achievements when no numerical measure exists.

Use `amend --stdin` for corrections, referring to the original evidence ID. Never silently rewrite someone else's credit or remove the original record.

Match a project to saved goals using the current work and goal descriptions; do not invent a match or a new goal. Capture real progress even when no goal matches, using an empty goals list.

For unclear alignment, use the eligible alignment reminder: offer to connect the work to a goal, add an agreed goal, or continue anyway. Ask whether it benefits their priorities without telling them to stop from missing context alone.

When the person says they want to continue anyway, save their response once with `nudge --project ID --session SESSION --reason alignment --action continue --note "their response"`. The returned Markdown file documents their choice across tools. Do not call it manager approval. Do not repeat the alignment question for that project and goal set. If they want a new goal, confirm its wording and preserve existing goals when updating the goal list.

Before surfacing a coaching reminder, call `nudge` with the host session ID, project, and reason. Show only a returned eligible reminder. Honor shared budgets, snoozes, dismissals, and manager approval.

Before finishing meaningful project work, silently ask yourself: "Is this project nearly ready or complete?" Use concrete cues in this chat, such as a final rollout, accepted deliverable, or user confirmation. A merged PR alone does not establish that the whole project is complete. If the answer is no or unknown, stay quiet. Do not read old chats or start another turn to run this check.

If the project is nearly ready or complete and its outcome is not yet documented, call the outcomes reminder. If eligible, ask what KPIs, before-and-after measurements, or qualitative feedback would show the impact. Record supplied results with their source links; leave missing measurements unknown. Respect a request to wait by snoozing or dismissing this reminder.

Then consider one follow-up under their saved development goal and actual company ladder. Examples include a broader demo, documenting lessons, or applying the learning elsewhere. Call the sharing reminder before suggesting it. Do not give a generic checklist or force another prompt when the shared budget suppresses it.

Report saved evidence IDs and the record path when the user asks. Do not claim success if the CLI failed.
