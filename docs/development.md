# Development

## Toolchain

Install Terraform from [`.terraform-version`](../.terraform-version) and Node from [`.node-version`](../.node-version), then use the [README quick start](../README.md#quick-start). These files are the only version sources. The TypeScript helpers use Node built-ins and run directly without npm dependencies.

## Local state lifecycle

`script/noop` and `script/deploy` create a fresh directory beneath `RUNNER_TEMP` or `TMPDIR`. Terraform's data directory, plan, and state live there. The scripts select the default workspace, overriding any inherited `TF_WORKSPACE`, so a named workspace cannot redirect state into the checkout.

- `script/noop` plans one `terraform_data` resource and exits without applying it.
- `script/deploy` applies the saved plan, verifies the resource and revision from local state, destroys the resource, verifies that state is empty, and removes the temporary directory.
- Failure cleanup attempts a destroy when state contains a resource. It preserves the original command failure if cleanup also fails, and a failed destroy cannot be reported as success.

Nothing persists between jobs or workflow runs. This is deliberate. The example does not pretend that local state can coordinate real infrastructure across ephemeral runners.

`terraform_data` is a built-in resource, so it demonstrates Terraform's real plan, apply, state, output, and destroy behavior without provider credentials, provider downloads, or a dependency lock file. If an external provider is added, follow the [provider vendoring guide](provider-vendoring.md) and commit its lock and mirror as one reviewed dependency change.

See [deployment comments](deployment-comments.md) for reusable Markdown examples and the focused rendering fixtures.

## Tests

GitHub runs each entry point in its own lowercase `lint`, `test`, or `acceptance` workflow.

- `script/lint` checks Terraform formatting and validation, shell syntax, immutable action pins, checkout credential settings, toolchain pins, and the no-cache policy.
- `script/test` runs Terraform's native tests against the real module and Node tests for version checks, summary validation, rendering, and Terraform control files.
- `script/acceptance` invokes the public noop and deploy scripts with real Terraform, checks real summary capture, verifies that candidate helper files are ignored, checks temporary-state cleanup, and verifies apply and cleanup failure semantics with a controlled Terraform fixture.

The IssueOps workflow itself is an opt-in live acceptance path. Local tests do not create GitHub deployments, comments, reactions, or locks.
