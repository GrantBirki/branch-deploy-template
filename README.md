# branch-deploy-template

A small Terraform repository that demonstrates secure `.noop` and `.deploy` flows with [GrantBirki/branch-deploy](https://github.com/GrantBirki/branch-deploy).

The example creates no cloud infrastructure. It uses Terraform's built-in [`terraform_data`](https://developer.hashicorp.com/terraform/language/resources/terraform-data) resource, writes state only to a temporary local directory, verifies the result, destroys it, and removes the temporary directory before the command exits.

## Quick start

Install the exact Terraform version in [`.terraform-version`](.terraform-version), then run:

```console
script/bootstrap
script/lint
script/test
script/acceptance
```

The same scripts run locally and in GitHub Actions. There is no package manager, custom provider, remote module, or external Terraform provider to install.

`.terraform-version` is the single source of truth for the exact Terraform release. `tfenv` reads it directly, and the workflows pass the same validated value to `setup-terraform`.

## IssueOps flow

After this workflow is present on the default branch, open a pull request and wait for CI to pass. The trusted `branch-deploy` job accepts commands only from commenters whose author association is `OWNER` or `MEMBER`:

```text
.noop
```

`author_association` describes the commenter, not the pull request source. This guard supplements Branch Deploy's pinned fork-denial default and its permissions, review, confirmation, and exact-SHA checks; add `COLLABORATOR` only when the repository intentionally trusts outside collaborators to request deployments.

The noop path checks out the exact commit approved by Branch Deploy and runs `terraform init`, `terraform validate`, and `terraform plan`. A noop still executes candidate Terraform and repository scripts. It is not a trusted or read-only inspection.

To exercise the local apply lifecycle, comment:

```text
.deploy
```

Both commands use `production`, the only deployment environment, and require a confirmation reaction. Branch Deploy already defaults to `production`; `environment_targets` restricts the available targets to that environment. The workflow admits commands in a trusted job, executes the selected commit in a separate job, and reports the result in a final trusted job. `.lock`, `.unlock`, `.wcid`, and `.help` are also handled by Branch Deploy.

Branch Deploy result mode reports the noop or deploy outcome for the admitted SHA in its pull request comment. The execution job's result determines success; candidate output is never read by the privileged result job.

Result mode keeps the original lock when execution is cancelled. A force-cancelled run, lost runner, or result job that never starts can leave completion unfinished. Use `.wcid` to inspect the current lock before deciding whether a manual `.unlock` is appropriate.

The [unlock on merge workflow](.github/workflows/unlock-on-merge.yml) asks Branch Deploy to release locks created by a pull request after GitHub reports that pull request merged. It uses the same `production` environment target and does not check out or run candidate content. The pinned action's compare-and-delete protection leaves a lock alone if another operation replaced it during cleanup.

## Pull request status

Create these repository labels before enabling the metadata workflows:

- `deploy: ready`
- `deploy: needs attention`

The `new pull request` workflow leaves deployment instructions. The `pr status` workflow uses the released [GrantBirki/pr-status](https://github.com/GrantBirki/pr-status/tree/v3.0.0) action to evaluate GitHub's review decision, at least one current non-bot approval, a non-draft pull request, and passing CI. It applies `deploy: ready` when those checks pass and `deploy: needs attention` otherwise. Missing CI evidence fails the evaluation.

The small event adapter resolves affected pull requests, ignores forks and deleted source repositories, and clears labels when a pull request closes or its head changes during evaluation. It never checks out candidate content. A review is current according to GitHub's review policy; configure dismissal of stale approvals when approvals must be tied to the latest commit. Labels do not require a prior noop and do not record deployment completion.

`pr status` handles submitted and dismissed reviews directly and fetches the current review state from GitHub. [Review events run the PR workflow revision](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_review), so this path trusts contributors with permission to push branches to the repository. Fork review runs are skipped. Pull request lifecycle, CI completion, and commit status events use the default-branch workflow.

These labels are informational. Branch Deploy remains the authorization gate and independently enforces actor permissions, reviews, checks, confirmation, fork denial, and exact-SHA selection.

## Default-branch deploy

The [deploy workflow](.github/workflows/deploy.yml) uses Branch Deploy's public [merge commit strategy](https://github.com/GrantBirki/branch-deploy/blob/main/docs/merge-commit-strategy.md) on pushes to `main`. A read-only job compares the latest default-branch tree with the newest relevant Branch Deploy deployment for `production`. It skips execution only when that deployment is active and its tree matches. Missing, unsuccessful, or different deployment history leads to a fallback run.

The fallback checks out and verifies the exact default-branch SHA selected by the action, which may be newer than the push event's SHA. It runs `script/deploy` and preserves failures as workflow failures. Merge mode does not acquire a Branch Deploy lock or return result-mode context. The fallback therefore uses the workflow result and does not create a deployment record or release an IssueOps lock. A later push may run the fallback again because it did not add deployment history.

This demonstrates a deployment-history comparison, not persistent infrastructure. A successful IssueOps deployment records completion of the disposable apply-and-destroy exercise. An active GitHub deployment record does not mean Terraform resources or state remain. The comparison is an observation, not an atomic deployment lock.

GitHub does not allow an expression in a push branch filter. If the repository's default branch is renamed, update the literal `main` filters in `.github/workflows/` and set Branch Deploy's `stable_branch` input during the same change.

The direct and IssueOps paths can overlap because they own separate temporary state. There is no shared Terraform state to protect with a GitHub concurrency group. Branch Deploy still coordinates its IssueOps commands with its own locks; unlock-on-merge remains a separate metadata workflow.

## Trust model

The [Branch Deploy workflow](.github/workflows/branch-deploy.yml) keeps three boundaries explicit:

1. `branch-deploy` accepts only pull request comments from owners or organization members. It reads the Terraform version from the exact default-branch revision, then runs the full-SHA-pinned Branch Deploy action to check the command, reviews, CI, actor permissions, confirmation, and lock without checking out pull request content.
2. `terraform` installs that trusted Terraform version, validates the admitted SHA, checks out that exact candidate commit with credential persistence disabled, verifies `HEAD`, and runs the candidate scripts with only `contents: read`. It receives no deployment secrets or environment credentials.
3. `status` forwards the unchanged trusted context and job results to Branch Deploy result mode. Result mode reports the real outcome and handles only the original eligible lock.

Pull request CI reads the candidate `.terraform-version` in an unprivileged job. IssueOps does not: a version change must merge before a deployment can use it. Until then, the candidate version check fails instead of installing PR-selected tooling.

The execution job intentionally has no artifact or cache handoff from candidate code into a privileged job. Cache mode is `none`: the workflows use neither the Actions cache nor a Terraform plugin cache.

Branch Deploy fetches [the deployment message](.github/deployment_message.md) from the exact trusted workflow revision. The template uses only escaped metadata and deliberately omits raw deployment results.

GitHub still provides its normal runner and Actions runtime context to jobs. This example limits repository permissions and credentials, but it is not a sandbox for hostile code.

## Local state lifecycle

`script/noop` and `script/deploy` create a fresh directory beneath `RUNNER_TEMP` or `TMPDIR`. Terraform's data directory, plan, and state live there. The scripts select the default workspace, overriding any inherited `TF_WORKSPACE`, so a named workspace cannot redirect state into the checkout.

- `script/noop` plans one `terraform_data` resource and exits without applying it.
- `script/deploy` applies the saved plan, verifies the resource and revision from local state, destroys the resource, verifies that state is empty, and removes the temporary directory.
- Failure cleanup attempts a destroy when state contains a resource. It preserves the original command failure if cleanup also fails, and a failed destroy cannot be reported as success.

Nothing persists between jobs or workflow runs. This is deliberate. The example does not pretend that local state can coordinate real infrastructure across ephemeral runners.

`terraform_data` is a built-in resource, so it demonstrates Terraform's real plan, apply, state, output, and destroy behavior without provider credentials, provider downloads, or a dependency lock file. If an external provider is added, follow the [provider vendoring guide](docs/provider-vendoring.md) and commit its lock and mirror as one reviewed dependency change.

## Tests

GitHub runs each entry point in its own lowercase `lint`, `test`, or `acceptance` workflow.

- `script/lint` checks Terraform formatting and validation, shell syntax, immutable action pins, checkout credential settings, toolchain pins, and the no-cache policy.
- `script/test` runs Terraform's native tests against the real module.
- `script/acceptance` invokes the public noop and deploy scripts with real Terraform, checks that temporary state is removed, and verifies apply and cleanup failure semantics with a controlled Terraform fixture.

The IssueOps workflow itself is an opt-in live acceptance path. Local tests do not create GitHub deployments, comments, reactions, or locks.

## Before adapting this template

This repository is a harmless demonstration, not a production infrastructure baseline. Adding a cloud provider or real infrastructure changes the trust model. Design that separately before adding credentials:

- decide whether candidate Terraform may access credentials at all;
- protect credentials with an environment and required reviewers;
- use durable remote state with native locking when runs must share state;
- serialize jobs that mutate the same state;
- keep orchestration and output processing in trusted code;
- preserve exact-SHA checkout and result-mode completion;
- review fork, approval, commit-signing, and branch-protection policy for the repository.

Do not place credentials in this workflow or quietly replace the local state lifecycle with a remote backend.

## Repository settings

The workflow assumes the default branch is protected. Require the `lint`, `test`, and `acceptance` jobs, require pull request review, and restrict who can push to protected branches. Repository rules are not stored or configured by this template, so verify them in GitHub before treating a deployment approval as meaningful.

## License

[MIT](LICENSE)
