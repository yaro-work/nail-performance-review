# Install nail-performance-review in your AI tools

For people setting up a shared performance record. Updated November 9, 2026.

Choose where your notes live once, then connect each AI tool you use. Your records stay in that folder when you switch projects or prepare a review.

For the shortest setup, follow the [README installation steps](../README.md#install-it), or give that README to your local AI coding tool and ask it to install the plugin. Install [Git](https://git-scm.com/downloads/) and [Node.js LTS, version 22 or later](https://nodejs.org/en/download), then reopen your terminal. Check them with `git --version` and `node --version`.

Each AI tool connects to the same selected performance directory. Install an adapter in every tool you use, then start a new conversation.

See the [verification results](verification.md) for which workflows we ran in real AI sessions. Check your own setup before relying on automatic tracking.

## Create your record

1. Clone the repository into a folder you will keep.
2. Initialize a record outside your source repositories.
3. Check that the command reports the intended absolute record path. Automatic tracking defaults to all folders. If you prefer manual capture, add `--manual` to `init`.

<details>
<summary>Commands</summary>

```sh
git clone https://github.com/yaro-work/nail-performance-review.git
cd nail-performance-review
node bin/nail.mjs init --root /absolute/path/to/performance --name work
node bin/nail.mjs doctor
```

On Windows, use a quoted absolute path, such as `"C:\Users\YourName\performance"`.

The default notes folder is `~/performance`. Omit `--root` to use it; this keeps your private records outside the clone.

</details>

## Connect an AI tool

1. Preview installation for your chosen tool.
2. Run installation without the preview flag.
3. Follow any trust or enablement instructions from the host.
4. Restart the host or begin a new session so it discovers the skills and hooks.
5. Say "Help me set up my performance record."

You can also find the skills by their full plugin name:

| Skill | Use it for |
|---|---|
| `nail-performance-review-setup` | Set up your goals and first achievement. |
| `nail-performance-review-track` | Record milestones and check goal alignment. |
| `nail-performance-review-review` | Draft a self-review from saved evidence. |
| `nail-performance-review-report` | Create an HTML overview. |

<details>
<summary>Commands and installation destinations</summary>

`--target` chooses your AI tool: `codex` for Codex, `claude` for Claude Code, `cursor` for Cursor, or `gemini` for Gemini CLI. Run installation once for each tool you use.

```sh
node bin/nail.mjs install --target codex --dry-run
node bin/nail.mjs install --target codex
node bin/nail.mjs doctor
```

The adapter installs skills in the host's user skill directory and merges nail-performance-review-owned hook entries into its user hook configuration.

| Host | Skills | Hook configuration |
|---|---|---|
| Codex | `~/.agents/skills/` | `~/.codex/hooks.json` |
| Claude Code | `~/.claude/skills/` | `~/.claude/settings.json` |
| Cursor | `~/.cursor/skills/` | `~/.cursor/hooks.json` |
| Gemini CLI | `~/.gemini/skills/` | `~/.gemini/settings.json` |

Installation does not automatically trust hooks or change host approval settings. Existing unrelated settings remain in place.

Nail uses a startup hook. Node.js 22 or newer must be on the host’s PATH. In Codex, open `/hooks` to review and trust nail-performance-review's definitions. Other hosts apply their own trust and workspace policies.

If Claude Code blocks an installation command, run that same command in your terminal from the plugin folder. Leave Claude's permission settings as they are. [Claude Code settings](https://code.claude.com/docs/en/settings)

The terminal adapters for Claude Code, Codex, and Gemini CLI also remind the AI at the start of a turn in enabled workspaces. The native Claude plugin uses an argument list for its per-turn hook. [Claude Code hook formats](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)

Native plugin manifests are also included for manual host plugin loading. Installing files does not prove the host has activated them.

Keep the cloned repository at its installed location. The adapter uses its local CLI and reference files. Reinstall after moving the repository.

</details>

### Install through Claude Code

Use this option in a local Claude Code session. Install Git and Node.js 22 or later. Claude Code 2.1.275 and later can add the marketplace and install in one step.

1. If you installed Claude with the Nail CLI, close Claude Code and remove that adapter from its clone with `node bin/nail.mjs uninstall --target claude`. Your records remain in place. If Cursor reused those Claude skills, reinstall the standalone Cursor adapter with `node bin/nail.mjs install --target cursor`.
2. In Claude Code, enter the command below and review the marketplace source. Choose **User** scope to keep the installation personal.
3. Open a new chat and say **“Help me set up my performance record.”** A new setup defaults to all folders. Ask for selected folders if you prefer.

```text
/plugin install nail-performance-review --marketplace yaro-work/nail-performance-review
```

Use `/plugin` to confirm the plugin is installed and enabled. Nail's `doctor` reports terminal-managed adapters, so use the Claude panel for this installation. To update, choose **Update now** under **Installed**. To opt into Claude's automatic updates, enable them for the marketplace under **Marketplaces**. [Claude Code plugin management](https://code.claude.com/docs/en/discover-plugins)

Claude may still ask before writing to your private record or opening an external document. If auto mode blocks an operation, review it in Claude's **Recently blocked** permission list. [Claude Code permission modes](https://code.claude.com/docs/en/permission-modes#review-denials)

### Install through Codex, Gemini, or Cursor

If you already use the terminal adapter, close the AI tool. In your clone, run `node bin/nail.mjs uninstall --target TOOL` with `codex`, `gemini`, or `cursor` to avoid duplicate hooks. Your notes stay in place.

**Codex CLI.** Run these two commands in your terminal. If your version lacks `codex plugin add`, add the marketplace and install from **Plugins** in the desktop app. Review the hooks in `/hooks`. [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference#codex-plugin)

```sh
codex plugin marketplace add yaro-work/nail-performance-review
codex plugin add nail-performance-review@yaro-work-nail
```

**Gemini CLI.** Run this command in your terminal. Review the extension and hook prompts, then restart Gemini. Add `--auto-update` if you want Gemini to apply extension updates automatically. [Gemini CLI extensions](https://geminicli.com/docs/extensions/reference/)

```sh
gemini extensions install https://github.com/yaro-work/nail-performance-review
```

**Cursor.** Open **Customize → Plugins**. Choose **From GitHub Repository**, paste the repo URL, and install the plugin. If your organization blocks GitHub imports, use the terminal adapter where permitted. [Cursor repository imports](https://cursor.com/docs/skills#installing-skills-from-a-repository)

Start a new chat and say **“Help me set up my performance record.”**

## Enable automatic tracking for a workspace

Your first `init` enables tracking in all folders, including subfolders. Use `init --manual` to start with manual capture or to enable only the folders you choose later. Existing settings stay in place on upgrade. Complete any hook trust steps and open a new chat.

| What you want | Run from the plugin folder |
|---|---|
| Track all folders with one default record. | `node bin/nail.mjs tracking --enable --all --name work` |
| Track one exact folder or give it a different record. | `node bin/nail.mjs tracking --enable --name work --cwd "/absolute/path/to/project"` |
| Track one folder and all its subfolders. | `node bin/nail.mjs tracking --enable --recursive --name work --cwd "/absolute/path/to/project"` |
| Exclude a folder and its subfolders. | `node bin/nail.mjs tracking --disable --cwd "/absolute/path/to/project"` |
| Clear a folder's override or exclusion. | `node bin/nail.mjs tracking --reset --cwd "/absolute/path/to/project"` |
| Turn off the all-folder default. Individually enabled folders stay on. | `node bin/nail.mjs tracking --disable --all` |
| Switch to manual capture everywhere and clear previously enabled folders. | `node bin/nail.mjs tracking --manual` |

To switch to selected folders, turn off the all-folder default and enable the folders you want. The closest folder rule wins. A separately enabled subfolder can track inside an excluded folder. With all-folder tracking on, a Cursor window with several folders can track if all its roots use the same record. A repository’s `.nail.json` selects a record for manual use. Automatic tracking uses the private configuration.

To keep only manual skills, install with `--skills-only`. If Cursor already imports your Nail skills from Claude Code, run `install --target cursor --reuse-claude-skills` after installing the Claude adapter from the same checkout. Keep Third-Party Imports enabled in Cursor. If you turn it off or uninstall Claude skills, reinstall Cursor without the reuse flag. The Cursor adapter also installs a local rule that respects startup opt-in and explicit requests.

## Check automatic tracking

1. In the plugin folder, run `node bin/nail.mjs doctor`. Fix any missing or outdated hooks it reports.
2. Check the exact folder shown in your AI tool. Use the command below and look for `"enabled": true`.
3. Open a new chat in that folder. Describe a real milestone and what you contributed, then look for the saved achievement.

```sh
node bin/nail.mjs tracking --status --cwd "/absolute/path/to/project"
```

The folder check confirms your choice. The real work checks whether your AI can follow the instruction and save a candidate. A quick fix or useful diagnosis counts. Use a separate record if you want to save fictional test data.

If your AI misses a milestone, say **“Save this to my performance record.”** If it asks for permission to write, review the destination before approving.

After setup or an update, ask **“Is my tracking working?”** In the plugin folder, run `node bin/nail.mjs health --cwd "/absolute/path/to/project"` to see the same local checks. Installation, tracking scope, and saved candidates are separate signals.

Ask **“Show my saved candidates”** to check what the AI saved. Say which entries to include or leave out. In the plugin folder, `node bin/nail.mjs inbox` lists candidates for the current review period. Use `node bin/nail.mjs triage --id ID --action include` to include an entry, or use `exclude` to leave it out.

## Use several tools or records

Install each adapter with the same selected record. The shared directory, rather than the model name, determines which notes an assistant uses.

Use distinct named records for separate employers or private work. Select a record explicitly before capturing work in a new context.

<details>
<summary>Explicit selection and isolated testing</summary>

```sh
node bin/nail.mjs init --root /absolute/path/to/another-record --name personal
node bin/nail.mjs context --name work
node bin/nail.mjs context --root /absolute/path/to/performance
```

An explicit `--root` selects that directory for the command. A named record resolves through nail-performance-review's user configuration.

The user configuration is `%APPDATA%\nail\config.json` on Windows and `~/.config/nail/config.json` elsewhere.

To bind a project to a named record, run setup with that name and the project's absolute path:

```sh
node bin/nail.mjs init --root /absolute/path/to/performance --name work --cwd /absolute/path/to/project --bind
```

An explicit root takes precedence over a name. Without either, nail-performance-review uses the nearest project binding, then the configured default record.

For development, set `NAIL_HOME` to an isolated test home and `NAIL_CONFIG` to an isolated configuration file. Keep fixtures away from real notes.

</details>

## Use a hosted chat tool

1. Copy the [starter prompt](../prompts/start.md) into the chat.
2. Upload only the goals and records needed for that conversation.
3. Review the proposed achievement or review text.
4. Import a valid nail-performance-review bundle, or ask your local assistant to record approved prose as evidence.

A hosted chat without local filesystem access cannot update your laptop's folder automatically. Do not describe a downloaded file as synchronized until it has been imported.

The import command accepts nail-performance-review's structured export format. An ordinary prose summary needs to be recorded through the local assistant or CLI.

## Check a manager document for updates

1. Share a Google Doc or another link your AI can open. You can also share a file for a one-time review.
2. For a live document, confirm an enabled workspace. Manager 1:1 notes default to weekly checks. Other tracked links default to every 30 days.
3. Say **“One-time only,” “Check this every 14 days,”** or **“Stop checking this document”** to choose another schedule or opt out.
4. When a check is due, open a new chat in that workspace. The AI uses its existing document access and saves clear, supported changes locally. It asks about ambiguous changes.

The first review covers all accessible sections. Later checks use revision information or review the document again. Ask **“What changed in my linked docs?”** for the last attempt, saved changes, and next check.

After a failed check, the next eligible chat can retry after 15 minutes, then an hour, then daily. A successful check clears the retries. If the laptop is off, the next eligible chat can pick up the overdue check. Cursor and the native Gemini extension check at chat start. Claude Code, Codex, and the Gemini terminal adapter can also check during a chat.

To configure checks from a terminal, pass JSON on stdin to `node bin/nail.mjs manager-source --stdin --name work --cwd "/absolute/path/to/project"`. Use `{"url":"https://example.com/notes","kind":"one-on-one"}` for weekly checks, or add `"intervalDays":0` for manual checks. A kind of `document` defaults to 30 days.

Run `node bin/nail.mjs manager-source --name work` to list source IDs. To change a schedule, pass `{"id":"SOURCE_ID","intervalDays":14}` to the same stdin command. To pause one link, run `node bin/nail.mjs manager-source --disable --id SOURCE_ID --name work`. Omit `--id` to pause all links.

If two links are hard to tell apart, pass `{"url":"HTTPS_DOCUMENT_URL"}` on stdin to `node bin/nail.mjs manager-source --lookup --stdin --name work`. The lookup returns the matching ID without opening the document or changing its schedule.

## Upgrade or uninstall

### Update a native install

Use the same tool you installed with:

| Install method | How to update |
|---|---|
| Claude Code | Open `/plugin`, select **Installed**, then choose **Update now**. |
| Codex CLI | Run `codex plugin marketplace upgrade yaro-work-nail` and restart Codex. |
| Gemini CLI | Run `gemini extensions update nail-performance-review` and restart Gemini. |
| Cursor | Open **Customize → Plugins** and refresh your imported marketplace. |

### Update notices

The plugin starts its 14-day timer the first time you open a chat with tracking enabled. When a check is due, the next eligible startup fetches the public package version. Each AI tool gets one notice per new version. If GitHub is unreachable, the next eligible startup can retry after a day.

Ask your AI **“Check for a plugin update”** or **“Turn off plugin update notices.”** From the plugin folder, use `node bin/nail.mjs update --check` or `node bin/nail.mjs update --notifications off`. Replace `off` with `on` to resume.

### Update a terminal installation

1. Close your AI tools.
2. From the plugin folder, update the clone and refresh the installed adapters with one command.
3. Reopen your AI tools and start a new chat.

```sh
node bin/nail.mjs update --pull
```

This command updates all terminal-managed adapters. It stops if the clone has local changes or Git cannot fast-forward it. The updater keeps your installation choices, including manual skills and Cursor's shared Claude skills. It reports a backup path when it changes an existing settings file.

If an older copy rejects `--pull`, run `git pull --ff-only` first, then run `node bin/nail.mjs update`. If your Claude plugin came from Claude's plugin browser, [update it in Claude](#install-through-claude-code).

The updater replaces old Nail hooks it can identify. If `doctor` still reports a bare Node hook, check that hook's origin in Claude Code before removing it.

The initial preview wrote its registry under the home folder instead of the documented configuration directory. If it stops finding your record after upgrading, rerun `init` with the existing root and name. This restores registration without replacing existing notes.

Uninstall removes nail-performance-review-owned adapter additions. It leaves the performance directory and unrelated host settings intact.

<details>
<summary>Uninstall commands</summary>

```sh
node bin/nail.mjs uninstall --target codex --dry-run
node bin/nail.mjs uninstall --target codex
```

Repeat for each installed host. Review a reported conflict before removing a file that someone edited after installation. The installer refuses symlinked destinations and stops if it detects a concurrent edit. Close the host to avoid races with its settings writer.

Nail recovers a lock when it can confirm the owner process is gone. If a lock is unreadable or ownership is unclear, close every Nail process and inspect the lock before removing it.

</details>

## Check a host before relying on capture

Record one fictional achievement in a test record, correct it, and request a review packet. Confirm another tool can read the correction.

Consult the [verification record](verification.md) for tested versions and remaining gaps. A hook fixture test does not establish native host behavior.
