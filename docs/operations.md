# Operating the template

## Repository setup

The workflow assumes the default branch is protected. Require the `lint`, `test`, and `acceptance` jobs, require pull request review, and restrict who can push to protected branches. Repository rules are not stored or configured by this template, so verify them in GitHub before treating a deployment approval as meaningful.

IssueOps runs only after the workflow is on the default branch. Commands are accepted from `OWNER` or `MEMBER` commenters on pull requests.

See [deployment comments](deployment-comments.md) for the layout, evidence requirements, and copyable examples used when adapting the result comment.

## Commands and locks

`author_association` describes the commenter, not the pull request source. This guard supplements Branch Deploy's explicit fork denial and its permissions, review and exact-SHA checks; add `COLLABORATOR` only when the repository intentionally trusts outside collaborators to request deployments.

Separate conditional `terraform plan` and `terraform apply` steps make the selected path visible in the Actions log. The noop path checks out the exact commit approved by Branch Deploy and runs trusted scripts for `terraform init`, `terraform validate`, and `terraform plan` against the candidate configuration. A noop still evaluates candidate Terraform. It is not a trusted or read-only inspection.

`.noop` and `.deploy` use `production`, the only deployment environment. Branch Deploy already defaults to `production`; `environment_targets` restricts the available targets to that environment. The workflow admits commands in a trusted job, executes the selected commit in a separate job, and reports the result in a final trusted job. `.lock`, `.unlock`, `.wcid`, and `.help` are also handled by Branch Deploy.

Branch Deploy result mode reports the noop or deploy outcome for the admitted SHA in its pull request comment. The execution job's result determines success. A separate read-only job validates the candidate's bounded resource-action summary and renders the comment details using trusted code. Missing or invalid details fall back to the job result and workflow logs; a formatting failure does not change the deployment outcome.

Deployments claim sticky locks that remain until `.unlock` or merge cleanup; noops keep the default non-sticky behavior. Result mode also keeps the original lock when execution is cancelled. A force-cancelled run, lost runner, or result job that never starts can leave completion unfinished. Use `.wcid` to inspect the current lock before deciding whether a manual `.unlock` is appropriate.

Rerun the whole IssueOps workflow to obtain fresh admission; rerunning only failed jobs cannot reuse a prior attempt's context. Before retrying, inspect the execution logs, deployment record, and lock: reporting can fail after apply and cleanup succeeded. A successful resource-action summary does not prove unchanged outputs or state. Pre-merge comments also use the current default-branch workflow and helpers, so they do not exercise a PR's new trusted tooling.

When a summary is unavailable, distinguish an execution failure from a rendering or reporting failure before retrying. In this template, inspect the execution job for apply, verification, and cleanup results; successful apply alone does not establish a completed demonstration. In a persistent-state adaptation, reporting failure may follow a successful state change. Preserve that known outcome and investigate missing detail rather than retrying solely to repair the comment. See [execution and reporting outcomes](adapting.md#preserve-execution-outcomes-when-reporting-fails).

The [unlock on merge workflow](../.github/workflows/unlock-on-merge.yml) asks Branch Deploy to release locks created by a pull request after GitHub reports that pull request merged. It uses the same `production` environment target and does not check out or run candidate content. The pinned action's compare-and-delete protection leaves a lock alone if another operation replaced it during cleanup.

## Pull request status

Create these repository labels before enabling the metadata workflows:

- `needs-noop`
- `ready-for-review`
- `ready-for-deployment`
- `ready-to-merge`

The `new pull request` workflow embeds the deployment instructions in its comment step. The `pr-status` workflow uses [GrantBirki/pr-status](https://github.com/GrantBirki/pr-status/tree/c5f7a6585b4a86b0bd618c4bac9f5197318c8d6b) in branch-deploy mode to maintain the current lifecycle label. New commits need a noop. A successful noop moves to review or deployment readiness, depending on approval. A successful deployment reaches merge readiness only while review policy passes. Failed or stale results cannot advance the current head. Draft and closed pull requests have no managed label.

Pull request lifecycle and submitted or dismissed review events run the status workflow directly. After an admitted noop or deploy, the IssueOps workflow calls it with the trusted pull request number, selected SHA, operation type, and Terraform job result. Stable-branch and explicit-SHA deployments do not update a pull request's lifecycle label. The status workflow never checks out candidate content or consumes candidate output, artifacts, or caches.

The policy requires GitHub's review decision, at least one current non-bot approval, and a non-draft pull request. It does not include CI in the label evaluation; Branch Deploy checks CI independently during admission. Review currency follows GitHub's policy, so configure dismissal of stale approvals when approvals must be tied to the latest commit.

[Pull request and review events use the PR workflow revision](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_review). These metadata workflows trust contributors who can push repository branches. Public fork tokens are read-only, so lifecycle label updates require a same-repository pull request. The welcome comment is best-effort and may fail for forks. Both metadata workflows run the public [Fence action](https://github.com/openai/fence) in audit mode.

These labels are informational. Branch Deploy independently enforces actor permissions, checks, fork denial, exact-SHA selection, and reviews subject to the configured admin exception. The status job queues label updates for each pull request; Terraform runs still use separate disposable state.

## Default-branch deploy

The [deploy workflow](../.github/workflows/deploy.yml) uses Branch Deploy's public [merge commit strategy](https://github.com/GrantBirki/branch-deploy/blob/main/docs/merge-commit-strategy.md) on pushes to `main`. A read-only job compares the latest default-branch tree with the newest relevant Branch Deploy deployment for `production`. It skips execution only when that deployment is active and its tree matches. Missing, unsuccessful, or different deployment history leads to a fallback run.

The fallback checks out and verifies the exact default-branch SHA selected by the action, which may be newer than the push event's SHA. It runs `script/deploy` and preserves failures as workflow failures. Merge mode does not acquire a Branch Deploy lock or return result-mode context. The fallback therefore uses the workflow result and does not create a deployment record or release an IssueOps lock. A later push may run the fallback again because it did not add deployment history.

This demonstrates a deployment-history comparison, not persistent infrastructure. A successful IssueOps deployment records completion of the disposable apply-and-destroy exercise. An active GitHub deployment record does not mean Terraform resources or state remain. The comparison is an observation, not an atomic deployment lock.

GitHub does not allow an expression in a push branch filter. If the repository's default branch is renamed, update the literal `main` filters in `.github/workflows/` and set Branch Deploy's `stable_branch` input during the same change.

The direct and IssueOps paths can overlap because they own separate temporary state. There is no shared Terraform state to protect with a GitHub concurrency group. Branch Deploy still coordinates its IssueOps commands with its own locks; unlock-on-merge remains a separate metadata workflow.
