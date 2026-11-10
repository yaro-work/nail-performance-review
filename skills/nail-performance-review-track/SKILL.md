---
name: nail-performance-review-track
description: Save quick fixes, concrete work in progress, and completed achievements to a private nail-performance-review record, or check goal alignment.
---

# Track meaningful work

Use the installed nail-performance-review CLI at `{{NAIL_PACKAGE_ROOT}}/bin/nail.mjs`. If unresolved, find the package root two directories above this skill file. Quote paths and run the CLI with Node.

For automatic capture, start only when a hook says tracking is active for this workspace. Before saving, run `context --tracking` from the workspace root. If it fails, skip capture quietly. Do not fall back to ordinary context, guess the record, or read private files directly. Add `--project ID` when you know the matching project.

Use the exact record directory returned by tracking context as `--root` for subsequent commands in that capture. This keeps repository bindings from selecting a different record. Keep private record content out of work artifacts and normal task responses.

If the user explicitly asks to track work in this chat, confirm which record to use if unclear, then load ordinary `context` for that record and project.

Respect host plan or read-only mode. Do not write performance notes while writes are prohibited. If no record exists, route to nail-performance-review-setup rather than creating a hidden record.

During authorized work, save a candidate before the final response when the user started a concrete task, made a useful change, or reached an actionable diagnosis. A short session counts. Use `state: in-progress` when real work began and `delivered` when a change or finding was delivered. A factual report counts even if the user only asks you to update a note. Use `basis: reported` for facts the user reports. Save fictional work only on request in a separate test record.

Skip requests with no work started, speculative plans, spelling or formatting-only edits, unrelated personal activity, and record maintenance. Do not copy raw transcripts. Keep automatic notes quiet, except when an eligible coaching question would materially help.

For routine edits, give the normal task response without announcing the tracking decision unless the user asks.

Keep tracking updates focused on the user's result. Avoid internal skill names, command names, and repeated plan announcements. If the host requires a skill disclosure, make it brief and describe the user outcome in plain language.

Use `record --stdin` with the shape in `{{NAIL_PACKAGE_ROOT}}/references/record-format.md`. Set `reviewStatus: candidate` for automatic notes. Add one or two sentences of `context` about the problem and what happened. Copy the exact `sessionId` and source from the hook when supplied. Leave the ID out if unknown. Keep paths, credentials, and transcripts out of these fields.

Check existing evidence for the project before creating a note. Amend a pending candidate when the same work progresses. If the entry was already reviewed, keep it and save only the new progress as a separate candidate. Keep distinct contributions separate, even within one session. Reuse the event ID for a retry of the same write. An explicit “save this to my performance record” can create an included note or include the existing candidate.

Separate the person's contribution, collaborators, and team outcome. Distinguish in-progress work, delivery, and measured impact. Label observations, user reports, and inferences honestly.

Ask for a missing link or metric only when it materially strengthens the record. Preserve useful qualitative achievements when no numerical measure exists.

Use `amend --stdin` for corrections, referring to the original evidence ID. Never silently rewrite someone else's credit or remove the original record.

Match a project to saved goals using the current work and goal descriptions. When the closest match is weak, leave the goal lists empty and save the candidate. Add a goal only after the user confirms its wording.

For an ongoing project or a new initiative with no clear match, check the alignment reminder. If eligible, ask “Would you like to link this work to an existing goal, add a new goal, or keep working on it without a goal?” Keep one-off quick tasks quiet. If asked to draft a goal, add a brief description of why it matters. Avoid guessing that a manager approved it.

When the person says they want to continue anyway, save their response once with `nudge --project ID --session SESSION --reason alignment --action continue --note "their response"`. The returned Markdown file documents their choice across tools. Do not call it manager approval. Do not repeat the alignment question for that project and goal set. If they want a new goal, confirm its wording and preserve existing goals when updating the goal list.

Before surfacing a coaching reminder, call `nudge` with the host session ID, project, and reason. Show only a returned eligible reminder. Honor shared budgets, snoozes, dismissals, and manager approval.

Before finishing meaningful project work, silently ask yourself: "Is this project nearly ready or complete?" Use concrete cues in this chat, such as a final rollout, accepted deliverable, or user confirmation. A merged PR alone does not establish that the whole project is complete. If the answer is no or unknown, stay quiet. Do not read old chats or start another turn to run this check.

If the project is nearly ready or complete and its outcome is not yet documented, call the outcomes reminder. If eligible, ask what KPIs, before-and-after measurements, or qualitative feedback would show the impact. Record supplied results with their source links; leave missing measurements unknown. Respect a request to wait by snoozing or dismissing this reminder.

Then consider one follow-up under their saved development goal and actual company ladder. Examples include a broader demo, documenting lessons, or applying the learning elsewhere. Call the sharing reminder before suggesting it. Do not give a generic checklist or force another prompt when the shared budget suppresses it.

Report saved evidence IDs and the record path when the user asks. Do not claim success if the CLI failed.

When the user asks to review saved candidates, run `inbox` for their selected period. Show the contribution and short context. Apply `triage --id ID --action include|exclude` only to the entries the user chooses.
