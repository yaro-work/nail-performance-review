# Evidence for the README and scenarios

Checked November 8, 2026. This is a fact sheet, not a promise that every host follows the skills.

| Claim | Status | Source and limit |
|---|---|---|
| The same records work for nonengineering roles. | Checked | The designer scenario updates role, goals, project, evidence, review packet, and HTML through the CLI. It does not evaluate a designer's career advice. |
| Four adapters resolve a shared project-bound record. | Checked | The shared-record scenario calls each host's hook entry point. Three host applications have not loaded those hooks in a native evaluation. |
| Another employer can have a separate record. | Checked | The shared-record scenario selects another binding and checks that work-record content is absent. Explicit overrides and the configured default still apply. |
| Corrections retain history and update reports. | Checked | The correction scenario checks current context, review content, and both evidence files. Native Codex capture and correction logs provide separate assistant evidence. |
| Reminder decisions and budgets work across sessions. | Checked | The reminder scenario checks repeat suppression, dismiss, approval, snooze, and the weekly budget. Expiry and goal changes have separate automated tests. |
| Evidence can move through a Markdown handoff. | Checked | The handoff scenario exports and imports real files twice. It verifies evidence transfer, not transmission to a hosted chat or transfer of company settings. |
| Records and reports are durable under concurrent normal writes. | Checked | Concurrent-process tests cover distinct events and retries. Abrupt process termination, power loss, and network filesystems are not covered. |
| Native Codex can capture and correct a fictional contribution. | Checked | Two successful native sessions on Codex CLI 0.167.0-alpha.3.2. They used explicit requests, not unattended work. Local evidence is listed in verification.md. |
| Native Claude, Cursor, and Gemini capture works. | Open | Claude/Cursor were not found in the checked locations. Gemini rejected the account's installed client. |
| Nail saves time or improves promotion outcomes. | Open | No user study or measured outcome. The README describes intended benefits without measured savings or promotion promises. |
| Cold-review defects have regression coverage. | Checked | Five tests failed against the previous code and pass after fixes. A sixth checks full company expectations and manager feedback. See cold-review.md. |
| The ABCD infographic follows supported command paths. | Checked | The ABCD scenario verifies goal/role context, milestone and measured records, reminder eligibility, and report output. Its metrics are fictional; completion judgment and dashboard access remain assistant-dependent. |
| The infographic has readable wide and stacked layouts. | Checked | Both SVGs have six cards, parse without errors, and have no clipped card text. Local previews select the wide source at 1,000 pixels and the mobile source at 390 pixels. GitHub-side preview through its API was blocked before upload. |

<details>
<summary>Reproduction</summary>

```sh
node --test tests/scenarios.test.mjs
npm test
node tests/native-smoke.mjs verify
node tests/native-smoke.mjs verify-correction
```

Test names and observable outputs are mapped in scenarios.md and verification.md. Native checks inspect the existing fictional session artifacts; preparing a fixture alone does not run an assistant.

</details>
