# Repository guidance

## Scope

- Keep this a harmless Branch Deploy example. Do not add cloud resources, credentials, a remote backend, or persistent shared state.
- Keep the repository small. Add a dependency, script, workflow, or document only when it protects a real behavior or makes the example easier to operate.

## Development

- Use the scripts in `script/` as the shared local and CI entry points.
- Treat `.terraform-version` as the only Terraform version source.
- Keep GitHub Actions pinned to full commit SHAs, permissions minimal, checkout credentials disabled, and caches off.
- Keep trusted admission and result handling separate from candidate Terraform execution. A noop executes candidate code and is not a trusted inspection.
- Preserve exact-SHA checkout and verification. Do not pass candidate artifacts, output, or caches into a privileged job.
- Continue using the built-in `terraform_data` resource unless the example truly needs an external provider. Follow `docs/provider-vendoring.md` before adding one.

## Testing

Run these before submitting a change:

```console
script/bootstrap
script/lint
script/test
script/acceptance
```

Tests should cover executable behavior, failure handling, and trust boundaries. Avoid tests that merely repeat YAML values, file inventories, formatting preferences, or other static configuration.

## Changes

- Keep workflow and step names short and lowercase, with a blank line between steps.
- Document durable trust assumptions and operational limits without claiming this example is a production baseline.
- Keep public content generic and original. Never add private repository names, URLs, identifiers, secrets, or copied internal material.
- Do not merge, release, change repository settings, create credentials, or run live IssueOps deployments unless the task explicitly authorizes it.
