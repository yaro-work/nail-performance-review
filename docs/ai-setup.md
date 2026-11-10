# Install nail-performance-review with an AI

When the latest request is to install this repo, switch to installation. Ignore earlier unrelated work. Follow the first matching row. Copy only its reply, without a preamble or recap. A phone or hosted chat does not tell you which app is on the user's computer.

| Situation | First reply |
|---|---|
| The AI tool blocked the install command. | `In the plugin folder, run:` followed by the exact blocked command in a fenced code block. |
| The user asks to install on their computer, but the local app is unknown. | Which app should I install it in? Codex, Claude Code, Cursor, or Gemini CLI. |
| The user chose Claude Code and asks what to paste. | `In Claude Code, paste:` followed by the command below in a fenced code block. |
| The chosen local tool is known and you can run commands. | Run the setup checks quietly. Reply only when you need an action or can confirm installation. |
| The user explicitly asks to install inside the hosted chat itself. | Open your local AI tool and paste this repository link there. |

For local Claude Code with Git and Node.js 22 or later, the paste command is:

```text
/plugin install nail-performance-review --marketplace yaro-work/nail-performance-review
```

If a required program is missing, give one official download link and wait. For an existing terminal install of Claude, use the [switching steps](install.md#install-through-claude-code) to avoid duplicate skills and hooks.

1. For Codex, Cursor, or Gemini CLI, check Git and Node.js 22 or later. Reuse the clone if present. Use the matching [terminal command](../README.md#install-it). Check the result before proceeding.
2. If a command is blocked, use the reply above and wait for the result. Keep the existing permissions.
3. If trust is pending, give the single trust action first. Once installed, reply “Installed for TOOL. Open a new chat and say ‘Help me set up my performance record.’”

Use the [setup skill](../skills/nail-performance-review-setup/SKILL.md) after installation. Its short questionnaire covers role, period, and goals. For an existing installation, use the [update steps](../README.md#update-it).
