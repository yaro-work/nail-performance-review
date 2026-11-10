# Development workflow

Use `main` as the stable branch. Every change starts in a feature branch and returns through a pull request.

Keep changes small enough to explain and verify. Nail's core must run on Node.js 22 or later without third-party runtime dependencies.

```text
main -> feature branch -> pull request -> squash merge into main
```

1. Fetch the latest `origin/main` and create a linked worktree with a new feature branch.
2. Add a behavior test when changing behavior.
3. Run `npm test` from the repository root.
4. Check changed CLI commands with an isolated record and user home.
5. Open a pull request against `main` with the problem, resulting behavior, and verification evidence.
6. Review the diff and wait for passing CI before squash-merging. Start the next branch from the latest `origin/main`.

Use `feat/<name>`, `fix/<name>`, or `chore/<name>` for branch names. Do not push directly to `main`.

If assistant behavior changes, run the [native conversation evaluation](docs/assistant-evaluation.md) before claiming that behavior works.

Never include real performance notes, credentials, or private company documents in a patch. Use clearly fictional names and links.

Submit only material you have the right to contribute, including any required employer permission. Contributions are provided under this repository's MIT license. Preserve applicable third-party notices and identify any material with different license terms.

Keep native host verification separate from hook fixtures. A passing simulated hook test does not prove that a host loads a plugin.

For Claude marketplace changes, run `claude plugin validate .` and install the branch in a temporary Claude profile. The Claude marketplace and plugin manifests omit a version so Claude can update by Git commit. [Claude marketplace versioning](https://code.claude.com/docs/en/plugins/host-marketplace#release-a-new-version)

For skill changes, exercise the relevant [assistant scenarios](tests/assistant-scenarios.md). Report observed behavior and any scenario that could not run.

For career examples, write original summaries and link to primary sources. Record the source's update date when available.

The public repository requires code-owner review from `yaro-work` and six CI checks. Only the maintainer can bypass review and CI through a PR. Force-push and deletion safeguards remain separate. See the [contribution policy and verification limits](docs/public-readiness.md).
