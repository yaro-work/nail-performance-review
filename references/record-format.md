# nail-performance-review record format

nail-performance-review stores performance facts as Markdown. Structured metadata identifies records, dates, sources, goals, and measurements. Narrative sections describe the work.

Each fact has one authority. Do not duplicate the contribution or outcome in both metadata and prose.

## Create evidence through the CLI

Send one JSON object to `record --stdin`. Use the existing CLI from the installed package and the selected record root.

```json
{
  "date": "2026-06-12",
  "project": "search-migration",
  "goals": ["service-reliability"],
  "source": "codex",
  "state": "delivered",
  "basis": "observed",
  "contribution": "I designed the staged rollout and wrote the recovery procedure.",
  "outcome": "The team completed the migration with the agreed rollback checks.",
  "collaborators": ["Avery", "Sam"],
  "links": ["https://example.com/projects/search-migration"],
  "metrics": []
}
```

The example is fictional. It does not claim that a completed migration improved reliability without measurements.

The CLI assigns an evidence ID unless a valid ID is supplied. Reuse a stable `eventId` when retrying the same capture. Do not reuse it for a different contribution.

Projects and goals use stable short IDs. Record a goal and project before referring to them in evidence.

## Evidence fields

| Field | Meaning |
|---|---|
| `id` | Optional UUID for an evidence record. |
| `eventId` | Optional stable identifier for retrying one capture. |
| `date` | Work date in `YYYY-MM-DD`, interpreted in the record's timezone. |
| `project` | Project ID. |
| `goals` | Related goal IDs. Use an empty list when the mapping is not known. |
| `source` | Tool or source that captured the note. |
| `state` | `in-progress`, `delivered`, or `measured`. |
| `basis` | `observed`, `reported`, or `inferred`. |
| `reviewStatus` | `candidate` awaits a decision, `included` can appear in reviews, and `excluded` stays in private history. Records without this field are included. |
| `sessionId` | Optional opaque ID supplied by the host. Omit unknown IDs and keep transcript paths out. |
| `context` | Optional short summary of why the work came up and what happened, up to 600 characters. |
| `contribution` | The person's action, without claiming a collaborator's work. |
| `outcome` | The result and any relevant limits. |
| `collaborators` | People or teams who contributed. |
| `links` | Supporting HTTP or HTTPS links. |
| `metrics` | Before-and-after measurements, when available. |
| `supersedes` | Existing evidence ID replaced by a correction. |

A measurement contains `name`, numerical `before` and `after`, `unit`, a supporting `source` URL, and `measuredAt` date. Do not convert a guess into a measurement.

`observed` means the active context contains the result or supporting evidence. `reported` means a person supplied it. `inferred` means it remains an interpretation.

## Update the supporting records

Use `profile --stdin`, `goals --stdin`, and `project --stdin` for structured updates. These examples show their input shape.

For goal additions or updates, add `"merge": true` alongside `items`. Include the full fields for each changed goal. Existing goals omitted from the input keep their fields and order.

```json
{"role":"Software engineer","level":"Senior","promotion":false,"timezone":"America/New_York"}
```

```json
{"items":[{"id":"service-reliability","title":"Improve service reliability","description":"Agree the target and measurement with my manager."}]}
```

```json
{"id":"search-migration","title":"Search migration","goals":["service-reliability"],"status":"in-progress"}
```

Changing a goal is a real context change. Reminders can become relevant again after goal revisions.

Keep goal IDs referenced by evidence. Set a goal status to active, completed, or paused.

Project status is separate. Use `in-progress`, `delivered`, `measured`, or `paused`. Use `delivered` for a finished project.

## Correct and edit notes

Use `amend --stdin` with a full corrected record and its `supersedes` ID. Preserve the original evidence and keep the reason clear in the corrected narrative.

Do not create two competing corrections to the same record. If that happens, resolve the conflict before preparing a review.

Direct Markdown edits are supported when the metadata and expected sections remain valid. Run `doctor` after manual edits. Do not silently discard malformed records or prefer a stale duplicate fact.

Review packets include the selected evidence and its identity. If the evidence changes, regenerate the packet before treating the review as current.

## Transfer notes between tools

Use `export --output` with a selected period to create a portable Markdown bundle. Use `import --input` to validate and bring that bundle into another selected record.

Review the bundle before sharing it. Importing the same unchanged bundle again should not duplicate achievements. Conflicting IDs require correction rather than silent replacement.

## Remember a priority choice

When the user chooses to work on an unmatched project anyway, run `nudge --project ID --session SESSION --reason alignment --action continue --note "their response"`. This writes a private Markdown decision under `decisions/` and suppresses that alignment question across tools for the same project and goal set. It does not add a goal or imply manager approval. New goals can reopen the question. `context` includes current choices; `doctor` validates their metadata. Exported evidence bundles do not transfer these local reminder choices.
