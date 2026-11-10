# Keep your performance record private

For people deciding what to store in nail-performance-review. Updated November 9, 2026.

nail-performance-review stores notes on your computer. Its CLI does not call AI APIs, send telemetry, or create a remote account.

Your active AI tool can read the notes you authorize it to use. That tool's data policies still apply. Local storage does not make an AI conversation private by itself.

Automatic tracking is off until you enable it for an exact workspace. Its startup hook sends a short instruction and does not read your performance record. At a milestone, your AI tool can request tracking context for that workspace. That context includes goals and expectations, plus evidence and priority decisions for a named project. Manager notes stay out of tracking context. Manual review and context commands can include more information.

Choose a folder outside source repositories. Keep separate records for employers or contexts that must not share information.

## Choose what to record

1. Record the work, your contribution, collaborators, and outcomes.
2. Prefer approved links over copies of confidential documents.
3. Leave out credentials, customer data, and unnecessary personal information about colleagues.
4. Follow your employer's policy for AI tools and work records.

nail-performance-review's tracking workflow uses the current authorized work context. It does not need to scrape unrelated chat histories or retain raw transcripts.

Evidence can contain sensitive facts even when the original document is not copied. Review a note before sharing it.

Public issues and support email can reach the maintainer. Use fictional examples when requesting help; do not send confidential career records or unnecessary personal information.

## Share a review or export

1. Inspect the selected date range and records.
2. Remove facts and links the recipient should not see.
3. Review the generated Markdown or HTML before sending it.

Exports and HTML reports contain copies of selected information. Removing a source note does not erase an earlier export or someone else's copy.

Markdown exports include the original records behind corrections, even when those originals fall outside your selected dates. Inspect the entire bundle before sharing it. HTML reports show the current corrected claims for the selected dates.

A review evidence packet includes full company expectations and manager notes, which are not filtered by date. It is input for your assistant, not the finished self-review. Inspect it before sharing, and keep unrelated feedback out of the polished draft.

nail-performance-review does not send reviews, post messages, or publish reports for you. Those actions require a separate user request in the active tool.

## Back up and remove records

Use your approved backup method for the performance folder. nail-performance-review does not encrypt records or provide cloud synchronization.

Uninstalling an adapter leaves the performance record and workspace authorizations intact. Run `tracking --disable` from the workspace to revoke its authorization for all adapters. Delete notes only through a deliberate user action and your normal retention process.
