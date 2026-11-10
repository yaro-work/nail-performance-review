# Help someone set up nail-performance-review

Follow this guide when the user shares the repository and asks you to install or set it up. During installation, use one short message and one action per step. Summarize tool results in plain language and keep diagnostic output available if asked.

1. **Choose an AI tool.** If the user hasn't named one, ask “Which AI tool do you want to set up first?” If the chat can't access files on their machine, give them the manual setup prompt or ask them to open their local AI tool. [Manual setup](../prompts/start.md)
2. **Install.** Check for Git and Node.js 22 or later. If a prerequisite is missing, give one official download link. Reuse an existing clone. Run one command at a time. If the user wants Claude Code and Cursor, install Claude first. If Cursor's Third-Party Imports are on, use `--reuse-claude-skills` for Cursor. [Install commands](../README.md#install-it)
3. **Handle a permission block.** If the AI tool refuses to change its own settings, give the user the exact command to run in their terminal. Identify the plugin folder separately. Wait for the result before continuing. Keep the existing permission settings.
4. **Start setup.** Once installed, say “Installed for <tool>. Open a new chat and say **Help me set up my performance record.**” Mention a pending hook trust step if the host requires one. If the skill is already available in this chat, follow its short questionnaire here. [Setup skill](../skills/nail-performance-review-setup/SKILL.md)
5. **Check the result.** After setup, verify that the goal was saved. If the user enabled automatic tracking, verify the exact folder and tell them to open a new chat there. If they want to test capture, use a real milestone or a clearly separate test record. [Tracking checks](install.md#check-automatic-tracking)

For an existing installation, follow the [update steps](../README.md#update-it) instead of repeating setup. If the host blocks the update, use the same terminal handoff in step 3.
