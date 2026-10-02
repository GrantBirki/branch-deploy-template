# Deployment comments

A result should make sense with its details closed: one outcome, one metadata block, then the changed-resource groups. Put useful supporting text in one fenced disclosure below the groups. Leave unchanged resources out entirely.

The examples below use the built-in `terraform_data` type to illustrate the layout for projects built from this template; they are not a resource inventory or executable configuration.

## What the template can report

The workflow's [summary adapter](../.github/scripts/deployment-summary.ts) validates saved-plan resource actions for both noop and deploy. The [renderer](../.github/scripts/render-deployment-message.ts) puts nonempty Import, Create, Update, Replace, and Delete groups above a fenced **Plan** disclosure containing aggregate planned resource totals and replacement order. Rows use emoji and inline code without bullet prefixes. Imports remain visible even with a `no-op` action.

A deploy comment labels those groups **Planned changes**. Its success status comes from the execution job, which includes apply, verification, and destroy in this disposable demonstration. It has no separate actual-apply totals. The comment must not turn planned counts into completed counts or suggest that the example leaves resources deployed.

An empty validated resource-action list produces ✅ **Resources: no changes planned.** and no empty disclosure. The summary excludes outputs, state moves, and plan completeness, so it cannot support the stronger **No changes.** example below. It also cannot distinguish output-only work from other omitted effects. Failed, cancelled, skipped, or unknown execution keeps its explicit job result beside any available planned groups. Missing or invalid summaries retain that result and the workflow log link.

The richer zero-change, output-only, and actual-apply cases below are presentation contracts for derived projects once they capture and validate the necessary evidence. They are not claims about fields this template currently collects. Keep the existing [execution boundaries](security.md#issueops-jobs) and [adaptation guidance](adapting.md); no provider, backend, credential, or lifecycle changes are needed to adopt the layout.

## Reading the examples

Copy the contents of each outer `markdown` block into a GitHub preview. The inner three-backtick `terraform` fence belongs in the generated comment. Keep the blank lines around headings, metadata, `<details>`, and code fences. The resource rows intentionally have no bullet prefix; their two trailing spaces produce separate, closely spaced lines.

All usernames, branches, timestamps, addresses, and URLs below are synthetic placeholders. `https://example.invalid/workflow-run` stands for the actual admitted workflow run, and `2000-01-01T00:00:00Z` stands for its actual completion time. Every resource address is invented. Substitute only validated metadata; never copy real identifiers or values from source screenshots into fixtures.

The template generates a small, value-free summary from validated metadata. Derived projects can opt into [native plan diffs](#native-plan-diffs-in-derived-projects) when attribute values are appropriate for their comment audience. Keep raw plan JSON, state, binary plans, and apply logs out of comments. Layout examples do not expand the executable summary schema; never invent resource bodies or execution evidence to fill the box.

## 1. Successful noop with a complete zero-change plan

Keep the positive no-change result prominent. No unchanged resource rows belong anywhere in the comment.

````markdown
### Deployment Results :white_check_mark:

**example-user** successfully **noop** deployed branch `example-noop` to **production**

- **Logs:** [workflow run](https://example.invalid/workflow-run) 🔗
- **Completed:** `2000-01-01T00:00:00Z` 📆

✅ **No changes.**

<details><summary>Plan</summary>

```terraform
Plan: 0 to add, 0 to change, 0 to destroy.
```

</details>
````

Use this only when the complete successful plan establishes no resource, import, output, pending read, or other state/action work. Do not infer “Your infrastructure matches the configuration” from an empty resource-action list. If the only available evidence is the bounded resource subset, use ✅ **Resources: no changes planned.** and omit the unsupported complete-plan result. An empty or unavailable Plan disclosure should be omitted rather than filled with repeated reassurance.

## 2. Import-only noop

The addresses and **Import (4)** heading are visible while **Plan** is collapsed. There is no separate `Plan: 4 import` line and no second Import group inside the disclosure.

````markdown
### Deployment Results :white_check_mark:

**example-user** successfully **noop** deployed branch `example-import` to **production**

- **Logs:** [workflow run](https://example.invalid/workflow-run) 🔗
- **Completed:** `2000-01-01T00:00:00Z` 📆

### Import (4)

⬆️ `terraform_data.example_primary`  
⬆️ `terraform_data.example_blog`  
⬆️ `terraform_data.example_docs`  
⬆️ `terraform_data.example_status`

<details><summary>Plan</summary>

```terraform
Plan: 4 to import, 0 to add, 0 to change, 0 to destroy.
```

</details>
````

This shows existing resources being adopted into state without representing the import itself as resource creation. Import support belongs to a derived project; the template does not execute this scenario. Keep importing resources even when their action array is `no-op`; omit ordinary unchanged resources. No import IDs, account identifiers, attributes, or values are needed to achieve this layout.

## 3. Mixed plan with create, update, replacement, and deletion

Only nonempty groups appear. Keep the group order consistent: Import, Create, Update, Replace, Delete. If an import also changes a resource, retain both the import indication and its planned action. Do not count an import alone as a create.

````markdown
### Deployment Results :white_check_mark:

**example-user** successfully **noop** deployed branch `example-change` to **production**

- **Logs:** [workflow run](https://example.invalid/workflow-run) 🔗
- **Completed:** `2000-01-01T00:00:00Z` 📆

### Create (1)

🟢 `terraform_data.example_worker`

### Update (1)

🟡 `terraform_data.example_tls`

### Replace (1)

🔁 `terraform_data.example_cache`

### Delete (1)

🔴 `terraform_data.example_legacy`

<details><summary>Plan</summary>

```terraform
# terraform_data.example_cache: destroy, then create

Plan: 2 to add, 1 to change, 2 to destroy.
```

</details>
````

The replacement is one resource in **Replace (1)**, but contributes once to each native add/destroy total. For the opposite action order, the detail must say `create before destroy`. Keep deletion visible as its own group. Don't duplicate all the group headings and addresses inside Plan, and don't reintroduce `: no-op` rows to make the detail block longer.

## 4. Successful apply with real completion totals

Lead with the actual apply result. When a derived project has aggregate apply evidence and a saved-plan address list, the visible resource groups must remain explicitly planned. **Create** must not silently become **Created** merely because the overall job succeeded.

````markdown
### Deployment Results :white_check_mark:

**example-user** successfully **branch** deployed branch `example-change` to **production**

- **Logs:** [workflow run](https://example.invalid/workflow-run) 🔗
- **Completed:** `2000-01-01T00:00:00Z` 📆

✅ **Apply complete. 1 added, 1 changed, 0 destroyed.**

**Planned changes**

### Create (1)

🟢 `terraform_data.example_worker`

### Update (1)

🟡 `terraform_data.example_tls`

<details><summary>Apply</summary>

```terraform
Apply complete! Resources: 1 added, 1 changed, 0 destroyed.
```

</details>
````

The compact native-style completion line inside Apply is generated from validated execution totals. It must agree with the prominent result even if those totals differ from the saved plan. The disclosure is labeled **Apply** because its contents describe execution; plan-only content belongs under **Plan** or **Planned changes**. If an apply disclosure adds nothing useful beyond the result line, omit it. Do not move the resource groups into it.

For an import-only apply with confirmed totals, show **Apply complete. 4 imported, 0 added, 0 changed, 0 destroyed.** The saved-plan addresses can use the same **Planned changes** label and **Import (4)** group. Use **Imported (4)** for addresses only if per-resource completion evidence is actually available.

## 5. Successful apply with zero resource actions

This can stay short. There is no unchanged-resource inventory or empty Apply disclosure.

````markdown
### Deployment Results :white_check_mark:

**example-user** successfully **branch** deployed branch `example-noop` to **production**

- **Logs:** [workflow run](https://example.invalid/workflow-run) 🔗
- **Completed:** `2000-01-01T00:00:00Z` 📆

✅ **Apply complete. 0 added, 0 changed, 0 destroyed.**
````

Zero resource totals alone do not establish that imports, outputs, or state were unchanged. Keep any relevant import totals or planned output/state indications underneath the result. This example assumes none are present.

## 6. Output-only and incomplete evidence

These are result-section replacements beneath the same heading, status, Logs, and Completed metadata, not separate comments. Output names and values remain omitted.

For a successful output-only plan:

````markdown
✅ **Resources: no changes planned.**

### Outputs (1)

1 output change planned.
````

For incomplete plan evidence:

````markdown
**Plan incomplete or reads pending.**
````

Keep any known changed-resource groups visible below that line, but do not print **No changes.** or fabricate exact complete-plan totals. On apply comments, output changes derived only from the plan must still say **planned**. Retain validated state-move, drift, and other-work indications when present; they should not disappear to make a result look cleaner.

## 7. Failure, cancellation, unknown outcome, and reporting failure

The success header and actor sentence must change along with the outcome. Here is a complete failed-apply example; no completion totals or invented raw diagnostic are shown:

````markdown
### Deployment Results :x:

**example-user**'s **branch** deployment of `example-change` to **production** failed.

- **Logs:** [workflow run](https://example.invalid/workflow-run) 🔗
- **Completed:** `2000-01-01T00:00:00Z` 📆

**Apply failed.**

**Planned changes**

### Update (1)

🟡 `terraform_data.example_tls`
````

The visible Update group describes intent, not proof that the resource changed or was rolled back. Preserve truthful partial-execution information if it exists. Do not manufacture an Apply disclosure when the only available detail is the log link.

Use the corresponding concise result for other outcomes, with an outer status that agrees:

```markdown
**Apply cancelled.**
```

```markdown
**Apply outcome unknown.**
```

```markdown
**Apply skipped.**
```

```markdown
**Plan summary unavailable.**
```

When apply is known to have succeeded but reporting failed, keep both facts visible. For example, use `### Deployment Results :warning:` and `**example-user**'s **branch** deployment of \`example-change\` to **production** applied successfully, but reporting failed.` above the normal metadata, followed by:

```markdown
**Apply succeeded; resource totals unavailable.**

Reporting failed after apply.
```

This is a presentation distinction, not permission to turn a failed workflow/reporting result green. Never claim apply failure solely because the summary is unavailable, and never claim success when execution itself is unknown. Use an actual terminal timestamp only when available; omit Completed rather than inventing it for an interrupted run.

## Large groups and incomplete data

Bound rows without losing the full validated count. An Import group with 30 resources shows its first 25 addresses followed by `_... and 5 more._`; the heading remains `### Import (30)` and the plan total remains 30 imports. The current renderer limits each group to 25 rows and caps the overall comment. Keep any actual truncation notice next to the shortened content.

Display truncation and incomplete source data are different. Exact totals are appropriate when all input was validated and only the displayed rows were shortened. A missing, rejected, oversized, or partially captured summary cannot establish zero changes or exact full totals. Do not convert either case into an empty successful plan.

## Native plan diffs in derived projects

A useful Plan disclosure shows what will change: the resource block, its attribute diff, and the plan totals. Keep the resource groups above it so the comment is readable while collapsed. This is an optional adaptation; the template's executable example still reports only resource actions and aggregate counts.

Capture the human-readable output of `terraform show -no-color` from the same saved plan used for the structured summary and any later apply. Use the pinned Terraform binary through trusted tooling. Keep that text separate from validated action counts and execution results: a formatting failure must not erase known counts, claim zero changes, or change whether an apply succeeded.

Terraform masks values marked sensitive in its human-readable output. Unmarked values, identifiers, and output values can remain visible. Choose this format only when those details are suitable for everyone who can read the PR; trimming an intro is not secret scrubbing. Do not forward `terraform show -json` into a comment or try to reconstruct a redacted diff from its values.

Bind the text to the admitted SHA, run, attempt, and mode. Bound its UTF-8 size before transferring it between jobs; reject malformed text and preserve complete characters when truncating. Validate and render in the existing fresh, read-only reporting job, then pass only bounded Markdown and GitHub job results to privileged completion. Treat the text as display data, not evidence that candidate code was safe or execution succeeded. Keep literal template replacement, a code fence longer than any backtick run inside the text, and safe multiline output delimiters.

If the text is missing, invalid, or suppressed by GitHub's secret masking, keep the validated groups and totals and link to the workflow logs. Do not bypass masking. Put a truncation notice beside shortened detail. A genuine no-change result can stay compact without repeating an empty diff.

### Example with the intro removed

This invented attribute diff illustrates the expanded Plan section. In an actual comment, use the saved plan's native text rather than filling a resource-shaped template:

````markdown
### Update (1)

🟡 `terraform_data.example`

<details><summary>Plan</summary>

```terraform
# terraform_data.example will be updated in-place
~ resource "terraform_data" "example" {
    ~ input = "before" -> "after"
  }

Plan: 0 to add, 1 to change, 0 to destroy.
```

</details>
````

For a deploy result, show independently validated actual apply totals above these groups. The saved diff remains labelled **Plan**, even after a successful apply. Prefix its fenced text with `# Saved plan; actual apply totals are shown above.` so planned intent cannot be mistaken for per-resource completion. Preserve failure, cancellation, unknown execution, and reporting-failure distinctions from the examples above.

### Trim the standard opening text

Remove the standard opening paragraph, action legend, and redundant “Terraform will perform the following actions” line before applying the display byte limit. An anchored match leaves warnings, drift notices, resource bodies, totals, and unfamiliar formats intact. For example:

```typescript
function trimPlanIntro(text: string): string {
  return text.trimStart().replace(
    /^Terraform used the selected providers to generate the following execution\r?\nplan\. Resource actions are indicated with the following symbols:\r?\n(?:(?: {2}[+~-]|[+-]\/[+-]| <=) [^\r\n]+\r?\n)+\r?\nTerraform will perform the following actions:\r?\n\r?\n/,
    "",
  );
}
```

This deliberately recognizes one known opening format. If Terraform emits a different format or a warning before it, show the original text. Do not remove everything before the first resource or broadly filter lines containing “Warning”, “Plan”, or action symbols; those can carry useful evidence or appear inside values. Keep sensitivity markers, replacement order, computed values, output changes, and totals as Terraform printed them.

Use small fixtures for the normal intro, multiple action types, CRLF, unknown or incomplete openings, diagnostics before and after the plan, and truncation after trimming. Also cover stale identities, missing detail, Markdown/template-like values, and actual apply results staying independent of plan text. These tests need no provider credentials or new dependencies.

Because `issue_comment` uses trusted helpers from the default branch, land reporting changes there before expecting a resource PR's `.noop` to show the new format. Then refresh that PR as needed and run a fresh `.noop` to verify the published comment.

## Adapting the renderer

- Keep [.github/deployment_message.md](../.github/deployment_message.md) responsible for the outer heading, actor, branch, environment, logs, and completion time. Render this metadata once. Align its status with known execution and reporting outcomes; omit unavailable terminal timestamps.
- Keep the visible summary and the supporting disclosure separate in `renderSummary()` and `renderDeploymentResults()`. Use real third-level headings, normal blank-line spacing, and two trailing spaces between address rows. Omit empty groups and empty disclosures. Avoid a second group inventory or a routine warning under every result.
- Capture additional evidence only when a derived project needs a richer case: complete-plan effects for **No changes**, bounded output-change counts for **Outputs**, and validated execution results for actual apply totals. Saved-plan addresses stay planned unless per-resource execution evidence exists. Replacements count as one replaced resource and contribute to both add and destroy totals.
- Preserve execution results independently of rendering. Missing details do not prove execution failed; a successful apply phase alone does not prove that later verification or cleanup succeeded. Keep these phases distinct when adapting the demonstration to persistent state.
- Generate public text from validated, bounded fields. The template excludes attributes, output values, import IDs, and raw diagnostics. A derived project that opts into native plan diffs must review their visibility and preserve the separate bounded text path described above. Escape addresses and metadata for their Markdown context when broadening the current address grammar. Preserve literal template replacement, Unicode-safe truncation, run/SHA/attempt/mode checks, and multiline output delimiter safety.

Use focused fixtures in [deployment-summary.test.ts](../tests/deployment-summary.test.ts) and [render-deployment-message.test.ts](../tests/render-deployment-message.test.ts): unchanged and read-only rows disappear, imports survive `no-op`, replacement orders and counts stay correct, failed execution cannot become success, missing evidence cannot become no changes, and truncated groups retain accurate counts. Keep the existing sensitive-data and identity validation coverage. Test extra evidence cases alongside their implementation in derived projects; no provider credentials, live IssueOps run, giant snapshots, or configuration inventory tests are needed for this layout.

For visual review, preview the raw Markdown on GitHub with Plan/Apply both closed and expanded. Check the no-change, import, mixed-plan, successful-apply, and failed-apply examples. The outcome, metadata, and every displayed group should be readable before opening the disclosure; opening it should reveal useful fenced detail: the template's value-free summary or the derived project's approved native diff.
