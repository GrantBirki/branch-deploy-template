# Repository guidance

## Scope

- Keep this a harmless Branch Deploy example. Do not add cloud resources, credentials, a remote backend, or persistent shared state.
- Keep the repository small. Add a dependency, script, workflow, or document only when it protects a real behavior or makes the example easier to operate.

## Development

- Use the scripts in `script/` as the shared local and CI entry points.
- Treat `.terraform-version` as the only Terraform version source. Pin Node in `.node-version`, link to version files in docs, and preserve exact provider versions and lock files when adapting the template.
- Keep GitHub Actions pinned to full commit SHAs, permissions minimal, checkout credentials disabled, and `cache-mode: none` explicit on every workflow with no job overrides. Disabling automatic caching alone does not deny cache access.
- Keep trusted admission and result handling separate from candidate Terraform execution. A noop executes candidate code and is not a trusted inspection.
- Preserve default-branch rollback independently of the comment's PR head, state, and CI. Require the selected default-branch SHA to match the trusted workflow revision and current remote default branch; scope extra PR checks to PR deployments. See [rollback guidance](docs/operations.md#rollback-to-the-default-branch).
- Preserve exact-SHA checkout and verification for trusted tooling and candidate Terraform. Validate bounded candidate summaries in a fresh read-only job; privileged reporting may receive only its rendered Markdown and GitHub job results. Never execute candidate code or consume candidate artifacts or caches in a privileged job.
- Continue using the built-in `terraform_data` resource unless the example truly needs an external provider. Follow `docs/provider-vendoring.md` before adding one.

## Documentation

- Keep the main README concise, human-readable, and friendly; use a few useful emojis and status badges for lint, test, deploy, and unlock on merge. Do not add a Branch Deploy badge. Link to version files and durable guidance instead of repeating values that need updates.
- Keep durable operating instructions and trust assumptions in `docs/`. Update them when the operator workflow, ownership boundary, or security contract changes, not for ordinary resource additions, updates, or deletions.
- Do not duplicate Terraform resource inventories, values, initial-adoption scope, rollout status, or deployment history in docs or this file. Keep resource-specific review context and verification evidence in PR descriptions and workflow logs. Avoid wording such as "the first adoption is limited to the resources below" that requires later resource PRs to edit documentation.
- A small HCL change should stay a small HCL change. Do not require companion documentation, TypeScript guards, or unit-test changes unless the executable behavior or trust boundary actually changes.

## Adapting the template

- Prefer native Terraform resources, import blocks, and lifecycle features over resource-specific helper code. Ordinary resource changes in a derived infrastructure repository should be HCL-only.
- Small TypeScript helpers using Node built-ins are appropriate for shared workflow behavior and bounded reporting. The template keeps resource values out of comments; derived projects can follow [the native plan diff guide](docs/deployment-comments.md#native-plan-diffs-in-derived-projects) when their comment audience may see those values. Keep display text separate from counts and execution results. Avoid resource allowlists, parallel configuration formats, or policy engines that need edits whenever HCL changes.
- Keep the disposable demonstration and its acceptance tests here. In a derived project, retain acceptance and PR-status workflows only when they provide useful coverage or operator feedback; do not copy them merely because the template has them. Keep CI small and batch pushes to avoid redundant runs.
- Follow [the adaptation guide](docs/adapting.md) before introducing persistent state, credentials, external providers, or resource imports.

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

- Keep workflow, job, and step names short and lowercase, with a blank line between steps. Use `test / test` and `lint / lint`; name the admission job and action step `branch-deploy`. Use `runs-on: ubuntu-latest` unless the task requires another runner. Do not add `timeout-minutes` unless the owner requests it.
- Document durable trust assumptions and operational limits without claiming this example is a production baseline.
- Keep public content generic and original. Never add private repository names, URLs, identifiers, secrets, or copied internal material.
- Do not merge, release, change repository settings, create credentials, or run live IssueOps deployments unless the task explicitly authorizes it.
