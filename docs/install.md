# Install nail-performance-review in your AI tools

For people setting up a shared performance record. Updated November 8, 2026.

Choose where your notes live once, then connect each AI tool you use. Your records stay in that folder when you switch projects or prepare a review.

For the shortest setup, follow the [README installation steps](../README.md#install-it), or give that README to your local AI coding tool and ask it to install the plugin. Install [Git](https://git-scm.com/downloads/) and [Node.js LTS, version 22 or later](https://nodejs.org/en/download), then reopen your terminal. Check them with `git --version` and `node --version`.

Each AI tool connects to the same selected performance directory. Install an adapter in every tool you use, then start a new conversation.

Only Codex has completed a native capture-and-review test so far. Other adapters have automated checks, and unattended capture remains unverified. Check the [current evidence](verification.md) before relying on it.

## Create your record

1. Clone the repository into a folder you will keep.
2. Initialize a record outside your source repositories.
3. Check that the command reports the intended absolute record path.

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

Hooks are small scripts the host runs when a session starts or ends. In Codex, open `/hooks` to review and trust nail-performance-review's definitions. Other hosts apply their own trust and workspace policies.

Native plugin manifests are also included for manual host plugin loading. Installing files does not prove the host has activated them.

Keep the cloned repository at its installed location. The adapter uses its local CLI and reference files. Reinstall after moving the repository.

</details>

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

## Upgrade or uninstall

Before upgrading, finish the current session and back up your performance directory. Update the clone to a reviewed commit or release, then rerun adapter installation.

Rerunning `install --target YOUR_TOOL` replaces unchanged older short-name skill files with the full-name versions. If you edited an installed skill, the installer stops and preserves it so you can back up and resolve your changes. Your performance records and unrelated settings stay in place. Restart the AI tool after upgrading. Archived test conversations retain the names used when they ran.

The initial preview wrote its registry under the home folder instead of the documented configuration directory. If it stops finding your record after upgrading, rerun `init` with the existing root and name. This restores registration without replacing existing notes.

Uninstall removes nail-performance-review-owned adapter additions. It leaves the performance directory and unrelated host settings intact.

<details>
<summary>Uninstall commands</summary>

```sh
node bin/nail.mjs uninstall --target codex --dry-run
node bin/nail.mjs uninstall --target codex
```

Repeat for each installed host. Review a reported conflict before removing a file that someone edited after installation.

</details>

## Check a host before relying on capture

Record one fictional achievement in a test record, correct it, and request a review packet. Confirm another tool can read the correction.

Consult the [verification record](verification.md) for tested versions and remaining gaps. A hook fixture test does not establish native host behavior.
