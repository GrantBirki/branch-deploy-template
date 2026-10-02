# Adapting the template

This repository is a disposable demonstration. A derived infrastructure project needs its own ownership, state, credential, and deployment decisions; copying the workflows does not settle those decisions.

## Keep resource changes small

Use Terraform as the source of truth for resource declarations and values. Put adoption scope, live inventory findings, plan evidence, and temporary limitations in the PR and workflow logs. Keep documentation focused on durable commands, ownership boundaries, and recovery procedures. Ordinary HCL additions, updates, and deletions should not require documentation inventories, helper edits, or tests that repeat resource names and settings.

Keep shared helpers small and resource-independent. Tests should verify executable behavior and trust boundaries. Retain the template's disposable acceptance checks here, but choose downstream acceptance and PR-status workflows for the value they provide rather than copying every workflow.

## Bootstrap before using IssueOps

`issue_comment` workflows execute from the default branch. Bootstrap trusted workflows and helpers there before expecting a PR to use new deployment behavior. Keep exact checkout verification, actor and fork restrictions, CI checks, protected credentials, state locking, and trusted reporting when adapting the execution path. Read the [trust model](security.md) before giving candidate Terraform access to credentials.

Review summary address handling and resource-count and byte limits before a large adoption. A helper change in a PR cannot expand the reporting capacity of the default-branch workflow running that PR. Keep limits bounded and the structured summary free of values, import IDs, secrets, and raw exports. If the comment audience may see attribute values, follow the separate [native plan diff guidance](deployment-comments.md#native-plan-diffs-in-derived-projects), including sensitivity limits and intro trimming.

The template explicitly sets `deployment_confirmation: "false"`, matching the action's default. This avoids the extra confirmation reaction. Choose this setting for the project's trust model; an owner-operated private project may keep it disabled while retaining deployment authorization, CI, and review checks. Use `true` when the project calls for the additional confirmation.

The merge-time deployment check must use the same environment as IssueOps and unlock-on-merge. Decide whether automatic fallback applies are appropriate for persistent infrastructure instead of inheriting the disposable demonstration's behavior.

## Preserve execution outcomes when reporting fails

The template renders a bounded plan-action summary in a separate read-only job. It does not collect apply completion events; deployment success covers the disposable apply, verification, and cleanup lifecycle. A derived project that adds actual apply totals needs to preserve the process result independently of summary capture.

Save the apply exit code before reading its event file. Validate the admitted identity and exit code, then construct a bounded fallback with that exit code and unavailable totals. Put file existence, size, read, and parse checks inside the path that emits this fallback when capture fails. Otherwise an oversized or unreadable log can discard known execution success and make a reporting failure look like an apply failure.

Keep capture failure visible under the project's reporting policy without overwriting the execution fact. A known exit-zero apply with unavailable totals can say “Apply succeeded; resource totals unavailable.” Preserve a nonzero apply exit code even when capture also fails. If execution itself is unknown, say so; never infer success, zero changes, or rollback from missing output. Invalid identity or exit-code input cannot establish an outcome, and a failed output write may prevent even the fallback from being published.

Use validated completion metadata for actual totals and label saved-plan actions as planned. Bind summaries to the admitted SHA, run, attempt, and operation; retain bounded, value-free fields and the read-only rendering boundary. Do not raise limits or forward raw events to privileged reporting to avoid a capture failure.

For an implementation that collects events, use small fake-process fixtures for exit zero and nonzero combined with oversized, missing, unreadable, malformed, and truncated event files. Check both the preserved execution result and the separate reporting failure. Include missing completion events, invalid identity, output-write failure, and sentinel values that must never appear in comments or parser errors. These tests do not require real infrastructure or a new test framework.

## Adopt existing resources separately from changes

Before declaring an import, verify the existing owner, live identity and values, provider import support, required permissions, and side effects. Preserve external owners such as application deployments and data management. Match actual provider reads rather than inferred dashboard defaults, and do not hide meaningful drift with broad lifecycle ignores.

Use native import blocks and require an import-only plan with zero additions, changes, or deletions. Resolve mismatches or leave the affected resource outside the adoption; do not bundle a configuration fix into a baseline import. Unsupported imports and missing permissions are limits to report, not reasons to recreate a resource or weaken the deployment checks.

A successful plan does not prove that state imports ran. After an authorized apply, verify the import result, a fresh zero-change plan, and relevant live behavior before merging. Keep state and saved plans private and out of Git.
