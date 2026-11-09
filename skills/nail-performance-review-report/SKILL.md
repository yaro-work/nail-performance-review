---
name: nail-performance-review-report
description: Create an on-demand offline HTML overview of an existing nail-performance-review record for a selected review period.
---

# Create a performance overview

Use the installed CLI at `{{NAIL_PACKAGE_ROOT}}/bin/nail.mjs`. If unresolved, find the package root two directories above this skill file. Run it with Node and quote paths.

Generate HTML only when requested. Resolve the selected performance record and date range, then run `doctor` and `report`.

Respect host plan or read-only mode. In those modes, describe the report request without creating output files.

Use the CLI's offline report rather than an external website or hosted dashboard. Include the selected period and links to supporting notes.

Review the result for correct goal grouping, contributor attribution, missing measurements, and superseded evidence. Report validation problems rather than hiding them.

If a browser is available, inspect desktop and phone widths before claiming the layout is verified. A generated file alone does not prove that the layout is readable.

Give the user the absolute HTML path. Explain that the report is a snapshot and must be regenerated after record changes.

The report can contain sensitive work information. Do not publish, upload, or send it unless the user separately requests that action.
