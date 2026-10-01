# Adapting the template

This repository is a disposable demonstration. A derived infrastructure project needs its own ownership, state, credential, and deployment decisions; copying the workflows does not settle those decisions.

## Keep resource changes small

Use Terraform as the source of truth for resource declarations and values. Put adoption scope, live inventory findings, plan evidence, and temporary limitations in the PR and workflow logs. Keep documentation focused on durable commands, ownership boundaries, and recovery procedures. Ordinary HCL additions, updates, and deletions should not require documentation inventories, helper edits, or tests that repeat resource names and settings.

Keep shared helpers small and resource-independent. Tests should verify executable behavior and trust boundaries. Retain the template's disposable acceptance checks here, but choose downstream acceptance and PR-status workflows for the value they provide rather than copying every workflow.

## Bootstrap before using IssueOps

`issue_comment` workflows execute from the default branch. Bootstrap trusted workflows and helpers there before expecting a PR to use new deployment behavior. Keep exact checkout verification, actor and fork restrictions, CI checks, protected credentials, state locking, and trusted reporting when adapting the execution path. Read the [trust model](security.md) before giving candidate Terraform access to credentials.

Review summary address handling and resource-count and byte limits before a large adoption. A helper change in a PR cannot expand the reporting capacity of the default-branch workflow running that PR. Keep limits bounded and reporting free of state values, import IDs, secrets, and raw exports.

The template explicitly sets `deployment_confirmation: "false"`, matching the action's default. This avoids the extra confirmation reaction. Choose this setting for the project's trust model; an owner-operated private project may keep it disabled while retaining deployment authorization, CI, and review checks. Use `true` when the project calls for the additional confirmation.

The merge-time deployment check must use the same environment as IssueOps and unlock-on-merge. Decide whether automatic fallback applies are appropriate for persistent infrastructure instead of inheriting the disposable demonstration's behavior.

## Adopt existing resources separately from changes

Before declaring an import, verify the existing owner, live identity and values, provider import support, required permissions, and side effects. Preserve external owners such as application deployments and data management. Match actual provider reads rather than inferred dashboard defaults, and do not hide meaningful drift with broad lifecycle ignores.

Use native import blocks and require an import-only plan with zero additions, changes, or deletions. Resolve mismatches or leave the affected resource outside the adoption; do not bundle a configuration fix into a baseline import. Unsupported imports and missing permissions are limits to report, not reasons to recreate a resource or weaken the deployment checks.

A successful plan does not prove that state imports ran. After an authorized apply, verify the import result, a fresh zero-change plan, and relevant live behavior before merging. Keep state and saved plans private and out of Git.
