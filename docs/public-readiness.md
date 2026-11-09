# Public contribution policy

For the maintainer and contributors. Public repository settings and verification.

Use a personal public repository on GitHub Free. No organization or paid plan is needed for public branch protections. Keep outside contributors without write access; they can propose changes through fork PRs.

Three active rulesets protect the default branch. Code-owner review requires approval from `yaro-work`, who owns every file through CODEOWNERS. Only that account currently appears in the collaborators API.

| Active rule | Requirements | Bypass |
|---|---|---|
| Review approval | One code-owner approval; dismiss stale approvals. | Only `yaro-work`, through a PR. |
| CI and merge requirements | Six CI checks after updating with the default branch; resolved conversations; PR; linear history. | Only `yaro-work`, through a PR. |
| History safeguards | Block default-branch deletion and force pushes. | None. |

Contribution flow:

```text
Contributor PR → approval from yaro-work → six CI checks → squash merge
Owner PR       → pass checks or explicitly bypass review and CI → squash merge
```

The maintainer can explicitly bypass review and CI through a PR. Direct pushes to the default branch, deletion, and force pushes remain restricted.

1. Keep outside contributors without write access. They can open issues and fork PRs without permission to merge them.
2. Review outside PR code before approving its workflows. Every outside contributor requires workflow approval, including returning contributors.
3. Keep private performance records and credentials outside the repository. Secret scanning and push protection are enabled; report vulnerabilities privately.
4. Recheck the effective branch rules after changing permissions or settings. Do not test deletion or force pushes on real history.

Only `yaro-work` currently appears in the collaborators API, with administrator access. MIT licensing, contribution instructions, and security reporting guidance already exist. CI uses read-only permissions and does not run privileged pull-request workflows. Workflow tokens default to read-only and cannot approve PR reviews. Only squash merging is enabled.

<details>
<summary>Settings and observed evidence</summary>

- [Review ruleset](https://github.com/yaro-work/nail-performance-review/settings/rules): active, one code-owner approval, stale dismissal, owner-only PR bypass.
- [CI and merge ruleset](https://github.com/yaro-work/nail-performance-review/settings/rules): six existing GitHub Actions checks; only `yaro-work` can bypass through a PR. Reloading the saved page confirmed the named bypass.
- [History safeguards](https://github.com/yaro-work/nail-performance-review/settings/rules): saved with deletion and force-push blocks, default-branch targeting, and an empty bypass list.
- The six checks cover Linux, Windows, and macOS with Node.js 22 and 24. Strict status checks require the branch to be current.
- The effective rules API for `main` confirms required code-owner review, six strict CI checks, deletion protection, and force-push protection. All three rulesets report `active`.
- CODEOWNERS validation returned zero errors. Private vulnerability reporting returned `enabled: true`; fork-workflow approval returned `all_external_contributors`.
- The clean repository has a parentless starting snapshot. Replacement verification checks anonymous Git access and the published commit count. Historical credential-pattern checks are not a complete secret audit.
- `gh api repos/yaro-work/nail-performance-review/actions/permissions/workflow` returned `read` and `can_approve_pull_request_reviews: false`.
- `.github/CODEOWNERS` supplies ownership; the active review rule enforces it.
- A separate non-owner account, a merge with failing CI, and destructive branch operations were not exercised. API readback verifies the configuration, not every permission path.
- To revise these rulesets, use their settings pages. Keep the history-safeguard bypass list empty.
- [GitHub ruleset documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).
- [GitHub fork-workflow approval API](https://docs.github.com/en/rest/actions/permissions#set-fork-pr-contributor-approval-permissions-for-a-repository).

The workflow approval policy was applied and read back with:

```sh
gh api --method PUT repos/yaro-work/nail-performance-review/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors
gh api repos/yaro-work/nail-performance-review/actions/permissions/fork-pr-contributor-approval
```

</details>
