# Check assistant behavior before release

For maintainers changing Nail, its skills, or host adapters. November 7, 2026.

This workflow checks real Codex conversations against saved records. A separate Astra review checks communication against six written standards.

Each conversation gets its own fictional record and project. The runner keeps prompts, replies, command events, hook receipts, and resulting records.

```text
Scenario -> Native Codex session -> Hook receipt and saved files
                                      |
                               Mechanical checks
                                      |
Conversation and records -> Astra communication review -> Acceptance
```

1. Run the offline suite before starting paid assistant sessions.
2. Inspect the active hook sources and acknowledge their current fingerprint.
3. Run the native scenarios. Preserve failures alongside successful runs.
4. Run Astra against the resulting conversations and records.
5. Inspect every failed check and quoted concern before accepting a change.
6. Rerun affected scenarios after fixes. Keep the original evidence for comparison.

Acceptance requires every mechanical check to pass and no failed communication criterion. Completion and brevity must be observed and pass.

Missing observations remain visible and do not prove unexercised behavior. Source changes during a run make its results inconclusive.

One passing run demonstrates those conversations on that host and model. It does not establish a population success rate or verify other hosts.

The runner keeps installed hook commands intact. Nail writes optional execution receipts; Codex's own context log separately establishes context delivery.

The one-run hook trust option does not establish that a user completed persistent trust through `/hooks`. No everyday Codex configuration is changed.

Live runs use your Codex account and consume model usage. Raw transcripts contain fictional data, remain local, and are ignored by Git.

<details>
<summary>Commands, evidence, and limits</summary>

```powershell
npm test
$env:NAIL_CODEX = (Get-Command codex).Source
npm run evaluate -- sources
# Read each listed hook source before acknowledging its fingerprint.
$env:NAIL_REVIEWED_HOOKS_SHA256 = '<approvalHash from the inspected sources>'
npm run evaluate
npm run evaluate:judge -- '<absolute run directory printed above>'
```

Run a subset with `npm run evaluate -- small-edit planning`. Set `NAIL_MODEL` to compare a different assistant model.

For a blinded comparison, append an earlier run directory to the judge command. Astra reviews both sets together; acceptance applies to the first run.

The runner starts new conversations and resumes their exact session IDs. It never resumes an unrelated recent session.

Evidence lives under `.scratch/conversations/`. A run contains source fingerprints, host versions, prompts, full command events, replies, hook output, records, and checks.

Nail writes receipts only when `NAIL_HOOK_RECEIPTS` names an absolute file. Receipts contain event status and an output fingerprint, without record content.

The assistant can write only its workspace, private record, and registry under the requested sandbox. Harness evidence stays outside those requested writable directories.

Each turn retains command outcomes and record state. Astra can check whether a save claim was true at that turn.

`results.json` contains mechanical checks. `astra.json` contains the communication review. `acceptance.json` requires both to pass.

The six scenarios cover setup, implicit milestone capture, correction followed by review, routine-work silence, read-only drafting, and misleading pasted instructions.

The runner verifies actual sandbox metadata from its own session log. Wrong permissions produce `inconclusive`, not a plugin failure.

On Windows, ignoring user configuration also removes the Windows sandbox selection. The runner explicitly selects the installed elevated sandbox.

Runs are independent samples. Repeat before a release when model consistency matters; compare the same prompts, standards, and source fingerprints.

Automatic capture remains an assistant decision. A startup-hook receipt alone cannot prove that the assistant saved a milestone.

These scenarios do not yet establish persistent trust onboarding, native Claude/Cursor/Gemini support, crash recovery, or long-term usability.

</details>
