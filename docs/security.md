# Trust and execution boundaries

## IssueOps jobs

The [Branch Deploy workflow](../.github/workflows/branch-deploy.yml) separates admission, execution, rendering, and reporting:

1. `branch-deploy` runs only the pinned action from the exact default-branch workflow revision. The action checks the command, reviews, CI, actor permissions, and lock. The configured `admins: "GrantBirki"` exception lets that user deploy without branch-protection approvals.
2. `deploy` checks out trusted tooling at `github.sha` into `trusted/` and the admitted SHA into `source/`, verifies both `HEAD` values, selects tool versions from the trusted checkout, and runs only the trusted scripts against the candidate Terraform root. Its token has only `contents: read`; it receives no deployment credentials.
3. `deployment-message` starts on a fresh runner with a read-only token and an exact trusted checkout. It validates a summary of at most 32 KiB and 100 built-in resource addresses against the admitted SHA, run ID, attempt, and operation. Only resource actions are accepted; Terraform values, outputs, import IDs, and raw logs are excluded. The summary is informational and cannot prove that candidate code behaved honestly.
4. `status` receives only the bounded Markdown produced by that trusted renderer and GitHub job results. It forwards the original admission context to Branch Deploy result mode. Candidate code, raw output, artifacts, and caches never run in or supply executable content to this privileged job.

Keep execution evidence separate from summary availability. Candidate-provided completion text must not replace the trusted job result or turn failed execution into success. If a derived project captures process outcomes and apply events, preserve validated execution evidence before file or parser failures, then report unavailable totals separately. The [adaptation guide](adapting.md#preserve-execution-outcomes-when-reporting-fails) describes that boundary and its regression cases.

The candidate's `backend.tf`, `.terraform-version`, and `.node-version` must match the trusted checkout. The scope check rejects symlinks, Terraform override files, provider lock files, and preexisting Terraform working directories or state at the candidate root; it does not recursively inspect descendants. Each noop or deploy uses a fresh CLI configuration and data directory. Its initialization uses an empty provider directory and disables module installation, so no external provider or module is downloaded through that initialization. Additional backend declarations fail Terraform's own configuration validation. These are narrow controls for this demo, not a custom Terraform parser or a general sandbox.

The shared scripts stay in `script/` so local and CI execution exercise the same lifecycle. IssueOps runs them from the trusted checkout; PR edits cannot select deployment helpers or tool versions before merge. Candidate Terraform itself can still execute code, including provisioners, so trusted checkouts do not make it safe to hand that process production credentials. Pull request CI runs candidate tooling with read-only permissions and no deployment secrets.

Branch Deploy fetches [the exact deployment message](../.github/deployment_message.md) from the trusted workflow revision and uses its non-executable renderer. The reused TypeScript renderer supplies grouped plan actions and a bounded details section through `results`. Resource values and raw output remain in the workflow logs. Every workflow declares [`cache-mode: none`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#cache-mode), denying Actions cache restores and saves. Job overrides must not re-enable access. Disabling setup-node automatic caching alone does not deny cache access. Noop/deploy also disable Terraform plugin caches. Candidate code still has network access; the Fence steps in metadata workflows run in audit mode.

The `production` action target is not a job-level GitHub environment binding. The jobs do not request environment secrets. If an environment is added later, its branch rule checks the workflow run's `GITHUB_REF`, not a subsequent PR checkout. An `issue_comment` run can therefore satisfy a `main` rule while evaluating PR Terraform. Use a separately designed credentialed execution path; the branch rule and trusted helper checkout alone do not isolate secrets from candidate configuration. See [GitHub's environment rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) and [trusted checkout guidance](https://github.com/GrantBirki/branch-deploy/blob/main/docs/trusted-checkouts.md).

The [comment guide](deployment-comments.md) shows how to keep visible plan intent, actual execution evidence, and missing details distinct without publishing resource values.

## Hardening guides

Use the [Branch Deploy hardening guides](https://github.com/GrantBirki/branch-deploy/tree/main/docs/security_hardening_guides) when adapting this demo:

- [Workflow boundaries](https://github.com/GrantBirki/branch-deploy/blob/main/docs/security_hardening_guides/workflow-boundaries.md): keep invocation checks, candidate execution, and privileged reporting separate. Same-repository noops can proceed without review; commit verification does not establish that code is harmless.
- [Terraform plans and providers](https://github.com/GrantBirki/branch-deploy/blob/main/docs/security_hardening_guides/terraform-plans.md): credentialed planning needs a complete input-admission policy before initialization, plus independently verified providers. This demo does not implement that policy; even built-in data sources can make network requests.
- [Rollout and recovery](https://github.com/GrantBirki/branch-deploy/blob/main/docs/security_hardening_guides/rollout-and-recovery.md): apply the saved plan, preserve failures, and inspect completion before retrying. Resource-action summaries omit output and state effects, so they cannot establish a zero-change rollout. See the [local recovery rules](operations.md#commands-and-locks).

## Before adding real infrastructure

This repository is a harmless demonstration, not a production infrastructure baseline. Adding a cloud provider or real infrastructure changes the trust model. Design that separately before adding credentials:

- decide whether candidate Terraform may access credentials at all;
- protect credentials with an environment and required reviewers;
- use durable remote state with native locking when runs must share state;
- serialize jobs that mutate the same state;
- keep orchestration and output processing in trusted code;
- preserve exact-SHA checkout and result-mode completion;
- review fork, approval, commit-signing, and branch-protection policy for the repository.

Do not place credentials in this workflow or quietly replace the local state lifecycle with a remote backend.
