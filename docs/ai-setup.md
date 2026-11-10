# Install nail-performance-review with an AI

When the latest request is to install this repo, switch to installation. Ignore earlier unrelated work. Follow the first matching row. Copy only its reply, without a preamble or recap. A phone or hosted chat does not tell you which app is on the user's computer.

| Situation | First reply |
|---|---|
| The organization blocks the install or a third-party import. | Say the organization blocks it and ask them to use an approved install method. |
| The user is in local Claude Code and asks to install, even with only the repo link. | Give the Claude Code reply below. |
| Another tool needs the user to run a permitted install step. | Give that one step with the exact command or button. |
| The user asks to install on their computer, but the local app is unknown. | Which app should I install it in? Codex, Claude Code, Cursor, or Gemini CLI. |
| The chosen local tool is known and you can run commands. | Run the setup checks quietly. Reply only when you need an action or can confirm installation. |
| The user explicitly asks to install inside the hosted chat itself. | Open your local AI tool and paste this repository link there. |

### Claude Code first reply

Identify the host from the session or the user's explicit choice. In local Claude Code, give this reply before running any shell or install tools. The user runs the slash command in chat. If the user says the plugin is already installed, go straight to the setup skill.

In Claude Code, paste:

```text
/plugin install nail-performance-review --marketplace yaro-work/nail-performance-review
```

Choose **User**. Open a new Claude Code chat and say **“Help me set up my performance record.”**

### Follow-up

The Claude command requires Claude Code 2.1.275 or later, Git, and Node.js 22 or later. Explain prerequisites only if the user needs help. If the user already installed the terminal adapter, give the [switching steps](install.md#install-through-claude-code) before the native command.

If the user wants the host’s own installer, use the [native install guide](install.md#install-through-codex-gemini-or-cursor). Do not install both methods for one tool.

1. For Codex, Cursor, or Gemini CLI, check Git and Node.js 22 or later. Reuse the clone if present. Run the matching [terminal command](../README.md#install-it) and check the result. Group these operations in one tool call when possible. Preview only if asked.
2. If a permitted step needs user action, give that one step and wait. If organization policy blocks the install, stop and point to an approved option.
3. After installing or updating Codex hooks, reply “Open `/hooks` and trust the nail-performance-review hooks.” Wait for the user to confirm. For any other pending trust step, give that action first.
4. When setup can begin, reply “Installed for TOOL. Open a new chat and say ‘Help me set up my performance record.’”

Do not narrate prerequisites, file writes, or verification. If your host requires an opening update, say only “Checking setup.” Use no further progress messages during these short steps.

Use the [setup skill](../skills/nail-performance-review-setup/SKILL.md) after installation. Mention the all-folder default and manual tracking option. When asking for documents, suggest Google Docs or other links the AI can open. For a live link, state its check interval and how to choose a one-time review. For an existing installation, use the [update steps](../README.md#update-it).
