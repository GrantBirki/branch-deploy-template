# branch-deploy-template 🚀

[![lint](https://github.com/GrantBirki/branch-deploy-template/actions/workflows/lint.yml/badge.svg)](https://github.com/GrantBirki/branch-deploy-template/actions/workflows/lint.yml)
[![test](https://github.com/GrantBirki/branch-deploy-template/actions/workflows/test.yml/badge.svg)](https://github.com/GrantBirki/branch-deploy-template/actions/workflows/test.yml)
[![acceptance](https://github.com/GrantBirki/branch-deploy-template/actions/workflows/acceptance.yml/badge.svg)](https://github.com/GrantBirki/branch-deploy-template/actions/workflows/acceptance.yml)

A small Terraform starter for trying [Branch Deploy](https://github.com/GrantBirki/branch-deploy) with pull request comments.

The example uses Terraform's built-in `terraform_data` resource. It creates no cloud infrastructure: each deployment applies, verifies, and destroys temporary local state. No cloud credentials or external providers are needed.

## Quick start

Install the exact Terraform version in [`.terraform-version`](.terraform-version) and Node version in [`.node-version`](.node-version), then run:

```console
script/bootstrap
script/lint
script/test
script/acceptance
```

Local development and CI use the same [scripts](script/). The TypeScript helpers run directly on Node without npm dependencies.

## Try a deployment

Follow the [repository setup](docs/operations.md#repository-setup) and [label setup](docs/operations.md#pull-request-status), get the workflows onto the default branch, then open a pull request and wait for CI.

Comment on the pull request to run a plan:

```text
.noop
```

Or run the apply, verification, and cleanup lifecycle:

```text
.deploy
```

Both commands use `production`, the only deployment environment. Separate `terraform plan` and `terraform apply` steps show which path ran in Actions. Branch Deploy reports the result on the pull request, and PR Status maintains its lifecycle label.

Deployments use sticky locks, released on merge or with `.unlock`. The workflow explicitly denies forks and configures `GrantBirki` as an admin who can deploy without branch-protection approvals. Review that setting when using this template.

## How it works

Trusted tooling checks out and verifies the selected commit before running candidate Terraform in a separate read-only job. Another job validates the resource-action summary before the result is posted. Default-branch pushes use Branch Deploy's merge-commit strategy.

This is a disposable demonstration. Candidate Terraform can execute code, including during a noop; read the [trust model](docs/security.md) before adding real infrastructure or credentials.

## Documentation

- [Operations](docs/operations.md): repository setup, commands, locks, labels, and default-branch deployments.
- [Development](docs/development.md): tool versions, local state, and test coverage.
- [Provider vendoring](docs/provider-vendoring.md): adding an external provider through a reviewed dependency change.
- [Contributing](AGENTS.md): repository conventions and required checks.

## License

[MIT](LICENSE)
