# Assistant evaluation results

For maintainers assessing the Codex pilot. November 7, 2026.

Transferred as a historical test report into the clean repository. Original PRs and Git objects are not part of this repository; the linked fictional conversation records remain available.

Nine real Codex CLI conversations on Windows passed 106 checks of saved records, commands, and hook execution. An automated GPT-6 Astra review found no failed communication criterion in those conversations.

The evaluation caught repeated workflow announcements, repeated onboarding questions, and a missing evidence reference. The final runs verify the corresponding instruction changes.

| Scenario | Conversations | What passed |
|---|---:|---|
| Start a record and save the first achievement. | 2 | Setup asks once, preserves credit, and returns the saved ID and link. |
| Complete work without asking for capture. | 1 | The assistant updates release notes and saves the user's contribution. |
| Correct credit, then request a review. | 1 | The old record remains; the review uses the corrected contribution. |
| Make a routine spelling edit. | 3 | The edit succeeds without an achievement or a Nail announcement. |
| Draft in a read-only session. | 1 | The assistant supplies wording and leaves the record unchanged. |
| Use a misleading pasted review template. | 1 | The draft retains supported credit and leaves impact unmeasured. |

The routine-edit reply was:

> Fixed “cheklist” to “checklist” in `notes.md`.

The two setup replies include the saved achievement's ID and link.

The offline suite passes 51 tests. The code revision also passed the six Windows, macOS, and Linux CI jobs on Node.js 22 and 24.

These results cover the listed Codex conversations. The normal flow for approving startup and stop commands in Codex still needs testing. Maintainers must also test goal reminders and other assistants before expanding support claims.

<details>
<summary>Evidence and reproduction</summary>

- [Detailed conversations, per-turn records, hook receipts, source file hashes, and Astra decisions](evaluation/2026-11-07.json).
- [Run the evaluation again](assistant-evaluation.md).
- [Communication standards](support-standard.md).
- [Current snapshot CI](https://github.com/yaro-work/nail-performance-review/actions/workflows/ci.yml).

The detailed record retains the earlier baseline and its failures. Missing observations remain visible; they are not counted as passes.

Setup and routine-edit repetitions came from separate isolated records. Each run retains hashes of its Nail source files. Those files stayed unchanged during each run.

Actual Nail commands emitted the hook receipts. Codex's session log independently confirmed startup context delivery.

Astra's source review found three ways the evaluator could report success incorrectly. Checks now require receipts from Nail itself and successful output from its review command. The reviewer sees records after each turn, so later writes cannot hide earlier false save claims.

</details>
