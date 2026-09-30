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

## IssueOps flow

After this workflow is present on the default branch, open a pull request and wait for CI to pass. A repository writer or administrator can then comment:

```text
.noop test
```

The noop path checks out the exact commit approved by Branch Deploy and runs `terraform init`, `terraform validate`, and `terraform plan`. A noop still executes candidate Terraform and repository scripts. It is not a trusted or read-only inspection.

To exercise the local apply lifecycle, comment:

```text
.deploy test
```

Both commands require a confirmation reaction. The workflow admits commands in a trusted job, executes the selected commit in a separate job, and reports the result in a final trusted job. `.lock`, `.unlock`, `.wcid`, and `.help` are also handled by Branch Deploy.

Result mode keeps the original lock when execution is cancelled. A force-cancelled run, lost runner, or result job that never starts can leave completion unfinished. Use `.wcid` to inspect the current lock before deciding whether a manual `.unlock test` is appropriate.

## Trust model

The [Branch Deploy workflow](.github/workflows/branch-deploy.yml) keeps three boundaries explicit:

1. `admit` runs the full-SHA-pinned Branch Deploy action from the default-branch workflow. It checks the command, reviews, CI, actor permissions, confirmation, and lock without checking out pull request content.
2. `terraform` validates the admitted SHA, checks out that exact commit with credential persistence disabled, verifies `HEAD`, and runs the candidate scripts with only `contents: read`. It receives no deployment secrets or environment credentials.
3. `complete` forwards the unchanged trusted context and job results to Branch Deploy result mode. Result mode reports the real outcome and handles only the original eligible lock.

The execution job intentionally has no artifact or cache handoff from candidate code into a privileged job. Cache mode is `none`: the workflows use neither the Actions cache nor a Terraform plugin cache.

GitHub still provides its normal runner and Actions runtime context to jobs. This example limits repository permissions and credentials, but it is not a sandbox for hostile code.

## Local state lifecycle

`script/noop` and `script/deploy` create a fresh directory beneath `RUNNER_TEMP` or `TMPDIR`. Terraform's data directory, plan, and state live there.

- `script/noop` plans one `terraform_data` resource and exits without applying it.
- `script/deploy` applies the saved plan, verifies the resource and revision from local state, destroys the resource, verifies that state is empty, and removes the temporary directory.
- Failure cleanup attempts a destroy when state contains a resource. It preserves the original command failure if cleanup also fails, and a failed destroy cannot be reported as success.

Nothing persists between jobs or workflow runs. This is deliberate. The example does not pretend that local state can coordinate real infrastructure across ephemeral runners.

`terraform_data` is a built-in resource, so it demonstrates Terraform's real plan, apply, state, output, and destroy behavior without provider credentials, provider downloads, or a dependency lock file. If an external provider is added, commit and validate `.terraform.lock.hcl` with that change.

## Tests

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
