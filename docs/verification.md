# Verification record

For maintainers assessing release readiness. Updated November 8, 2026.

This clean repository starts from a parentless snapshot. Earlier conversation records below are retained test artifacts, not earlier commits in this repository. Fresh snapshot checks run locally and through the [current CI workflow](https://github.com/yaro-work/nail-performance-review/actions/workflows/ci.yml).

The current revision passes 61 local tests. Seven new checks cover upgrading old skill names across all four adapters and the manual-handoff installer, repeated installation, edited-file conflicts, and direct uninstall of an old-name installation.

A real Codex setup conversation passed 12 checks after the rename. It read `nail-performance-review-setup/SKILL.md`, whose discovery name matched the folder, and saved the fictional first achievement. [Retained evidence](evaluation/2026-11-08-skill-rename.json). Archived earlier conversations keep their original skill names and source hashes.

Other tests save a user choice in Markdown, suppress its alignment question across four adapters, retain outcomes reminders, reopen alignment after goals change, and detect malformed decision files.

Four new real Codex conversations passed 57 checks. They cover saving a choice without inventing a goal or manager approval, staying quiet on the following routine edit, asking about outcomes near completion, and leaving unfinished work in progress without an outcomes prompt. [Retained conversation evidence and source hashes](evaluation/2026-11-08.json) record these fictional scenarios. This is targeted behavior evidence, not a reliability rate.

Chrome rendered six cards in each SVG without text overflow. Responsive checks selected the correct asset at widths of 1,000 and 390 pixels. The locally rendered README had three tables and no page overflow at 1,280 and 390 pixels. Rendered screenshots were inspected. These checks do not establish other hosts' conversation behavior.

GitHub saved three preparation rulesets through the browser. [Publication preparation](public-readiness.md) records their status and required live checks.

The CLI and adapter checks pass. Native Codex sessions saved and corrected fictional evidence, then drafted supported reviews. A later milestone scenario saved evidence without an explicit capture request. Capture completeness across everyday work remains unverified.

The [repeatable evaluation](assistant-evaluation.md) preserves conversations, per-turn records, command outcomes, and actual hook receipts. A separate Astra review checks communication quality.

Nine native conversations passed 106 mechanical checks and Astra's communication review. They cover six scenarios, with repeated setup and routine-edit conversations. See the [results and retained evidence](assistant-evaluation-results.md).

## Features and the evidence behind them

| Working capability | Proof | What the proof does not cover |
|---|---|---|
| Create records and update roles, goals, projects, and promotion interests. | The designer command scenario reads the resulting packet and HTML. | Conversational setup and role-specific coaching quality. |
| Store contributions, collaborators, links, measurements, and delivery state. | Record validation and report tests inspect saved files and output. | Whether a person or assistant supplied truthful evidence. |
| Retry captures without duplicates and retain separate contributions. | Replay, shared-PR, and concurrent-process tests. | Semantic deduplication when agents invent different event identifiers. |
| Correct a claim without losing its original. | Automated cross-project scenario and native Codex correction. | Every form of conflicting manual edit. |
| Share one record across projects and adapter formats. | Four hook entry points resolve the same bound folder; native Codex hooks execute in isolated records. | Native hook activation in Claude Code, Cursor, and Gemini. |
| Separate employer records. | Another project binding selects another folder without work-record content. | An explicit wrong override or an unbound project using the default. |
| Limit reminders and honor snooze, dismissal, and approval. | Command scenario plus expiry, goal-revision, and concurrency tests. | Whether an assistant chooses helpful moments or reasons. |
| Prepare annual, half-year, or dated review evidence. | Period-boundary tests and native Codex drafts with evidence references. | Consistently good writing or attribution from every model. |
| Produce offline HTML only on request. | Report assertions and inspected desktop/phone screenshots. | Every browser, accessibility audit, or very large record. |
| Export/import evidence and preserve destination company settings. | Handoff scenario reimports the same bundle without duplicates. | Cloud synchronization, hosted-chat behavior, or interruption mid-import. |
| Install, update, inspect, and uninstall adapters. | Preservation tests execute generated commands and retain user edits. | Every host version, policy, or external concurrent settings edit. |

The [scenario diagrams](scenarios.md) show these workflows. The [fact sheet](evidence.md) separates checked claims from open questions.

## Automated behavior

The current suite passes 52 tests on Windows with Node.js 26.13.0. The ABCD illustration adds one command scenario to the prior 51-test suite.

Five new regression checks failed against the previous implementation and passed after the fixes. They cover solo work, whitespace-preserving retries, missing evidence IDs, UUID case variants, and the default registry path. The sixth verifies full company expectations and manager feedback in the review packet.

The tests exercise actual files and concurrent CLI processes. They cover corrections, duplicate events, historical goals, shared reminders, handoffs, review packets, and HTML escaping.

Adapter tests cover all four host formats. They preserve unrelated settings, detect edited skills, and execute generated Windows commands with spaces and apostrophes.

The test suite uses fictional records in worktree-local test directories. It does not install into the real user's assistant configuration.

The earlier illustration revision passed its six-job CI matrix during development. Its original PR and CI URLs belonged to the retired repository and are not reused here.

## HTML inspection

Chrome rendered the fictional half-year report at desktop and phone widths. Both contained two achievement cards without horizontal overflow.

The first phone check found an overflowing snapshot fingerprint. Wrapping long text fixed that failure. Both layouts were inspected after the fix.

The three supporting scenario diagrams use Mermaid. The README now uses a generated SVG illustration with wide and stacked layouts, inspected in Chrome at desktop and phone widths.

The November 8 ABCD check verifies saved goals, startup context, an in-progress contribution, sourced 100 ms to 50 ms measurements, reminder limits, a separate sharing reminder, and review/HTML output. The numbers are fictional. This check does not evaluate an assistant's completion judgment or dashboard access.

Both SVGs parsed with six cards and no overflowing card text. The local README preview selected the wide asset at 1,000 pixels and the stacked asset at 390 pixels, without horizontal overflow. A fresh reader found the sequence and capability boundaries clear.

GitHub [documents support for responsive picture elements](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github). An optional API render request was rejected by automatic approval review before execution because it would upload the private README. No payload was sent; GitHub-side rendering of this exact file was not checked through that endpoint.

## Native assistant evaluation

A prerelease Codex CLI started an isolated fictional test using project-scoped Nail skills.

The first attempt could not run terminal tools because runtime policy rejected the command. No achievement was saved.

The assistant's provisional response preserved Avery's contribution and did not invent the requested reliability percentage. That response does not establish functional capture.

The second attempt used normal automatic approval review and succeeded. Codex discovered the project skills, saved one achievement, and prepared an H1 evidence packet.

The resulting review credited Avery, cited the supporting link, and left reliability improvement unmeasured. An independent CLI read confirmed one saved record and its evidence ID.

A later native Codex session corrected the contribution from designing a plan to reviewing Avery's plan. It preserved the original and drafted from the correction.

Those sessions verified explicitly requested assisted capture and correction. They did not exercise implicit capture, lifecycle hook activation, or conversational setup. The later repeatable evaluation covers those selected Codex scenarios.

Claude Code and Cursor were not found on PATH or in the checked installation locations. Their native scenarios have not run.

Gemini CLI 0.67.0 could not start the cross-tool correction scenario. Its account returned `UNSUPPORTED_CLIENT` and directed individual users to Antigravity.

The fixture directory was also untrusted. No trust settings were changed, and no Gemini correction was saved. Its adapter format remains covered by automated tests.

Those earlier sessions verified explicitly requested capture. The earlier repeatable evaluation observed implicit capture and both lifecycle hooks in Codex. The current adapter uses only startup and sends no record data at startup. Persistent trust onboarding and capture completeness remain unverified.

## Reproduce the checks

1. Run the automated suite from the repository worktree.
2. Render the fictional report with an available Playwright browser.
3. Run the assistant scenarios in isolated records before claiming native support.

<details>
<summary>Commands and local evidence</summary>

```sh
npm test
node --test tests/scenarios.test.mjs
node tests/visual-smoke.mjs
node tests/native-smoke.mjs
node tests/native-smoke.mjs verify
node tests/native-smoke.mjs verify-correction
```

The visual check accepts `NAIL_BROWSER_MODULE` and `NAIL_BROWSER_EXECUTABLE` when Playwright or the browser is provided externally.

This laptop used the bundled Playwright module and the installed Google Chrome executable. Neither is a runtime dependency of Nail.

Local generated artifacts are ignored by Git:

- `.scratch/visual/report.html`, `desktop.png`, and `phone.png` contain fictional data.
- `.scratch/native/prompt.txt` contains the fictional native scenario.
- `.scratch/native/session.jsonl` and `stderr.log` record the first native attempt.
- `.scratch/native/session-retry.jsonl` and `stderr-retry.log` record its retry.
- `.scratch/native/response.md` contains the successful Codex draft and saved evidence ID.
- `.scratch/native/correction-session.jsonl` and `correction-response.md` contain the native correction and resulting review.
- `.scratch/native/gemini-session.jsonl` and `gemini-stderr.log` record the blocked cross-tool attempt.

The scenario matrix is in `tests/assistant-scenarios.md`. Unit tests do not substitute for those assistant evaluations.

This revision's local evidence includes `.scratch/full-test-results.txt`, `.scratch/review-regressions-before.txt`, and `.scratch/review-regressions-after.txt`. Rendered diagrams are in `.scratch/diagrams/`.

The optional Python skill validator could not start because its environment lacks PyYAML. Node checks validated the four skill discovery headers.

</details>

## Are these tests enough?

They support a local pilot with an assistant that you supervise. They cover useful command paths, several invalid inputs, concurrent normal writes, adapter configuration, and one model's assisted capture and correction.

They are not sufficient for a broadly verified four-host release. Missing checks include native coaching, persistent hook-trust onboarding, cross-host sessions, crash recovery, long-running records, and human usability.

The native test included one misleading pasted instruction. That is a useful example, not a prompt-injection safety guarantee. Real user information should still follow the privacy guidance.

The [Astra cold-review record](cold-review.md) lists what the independent reviewer found and how each accepted issue was addressed.
