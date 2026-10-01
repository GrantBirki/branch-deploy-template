import assert from "node:assert/strict";
import test from "node:test";
import { captureSummary, MAX_RESOURCES, MAX_SUMMARY_BYTES, renderSummary, validateSummary, type Identity } from "../.github/scripts/deployment-summary.ts";

const identity: Identity = { sha: "a".repeat(40), run: "123", attempt: "1", mode: "plan" };
const plan = { resource_changes: [{ address: "terraform_data.example", change: { actions: ["create"], before: null, after: { private: "do-not-publish" }, after_sensitive: { private: true } } }], outputs: { private: "do-not-publish" } };
const serialized = () => JSON.stringify(captureSummary(plan, identity));

test("capture keeps only resource actions and drops values, sensitive outputs, and import IDs", () => {
  const result = captureSummary(plan, identity);
  assert.deepEqual(result.resource_changes, [{ address: "terraform_data.example", change: { actions: ["create"] } }]);
  assert.ok(!JSON.stringify(result).includes("do-not-publish"));
  const imported = captureSummary({ resource_changes: [{ address: "terraform_data.example", change: { actions: ["no-op"], importing: { id: "do-not-publish" } } }] }, identity);
  assert.deepEqual(imported.resource_changes[0].change, { actions: ["no-op"], importing: true });
});

test("summary must match the admitted revision, run, attempt, and operation", () => {
  for (const patch of [{ sha: "b".repeat(40) }, { run: "124" }, { attempt: "2" }, { mode: "apply" as const }]) {
    assert.throws(() => validateSummary(serialized(), { ...identity, ...patch }), /identity mismatch/);
  }
  assert.throws(() => validateSummary(serialized(), { ...identity, sha: "main" }));
});

test("untrusted payload limits reject oversized, malformed, duplicate, or extra data", () => {
  assert.throws(() => validateSummary("x".repeat(MAX_SUMMARY_BYTES + 1), identity));
  assert.throws(() => validateSummary("{", identity));
  const summary = JSON.parse(serialized());
  for (const payload of [
    { ...summary, results: "untrusted" },
    { ...summary, resource_changes: Array(MAX_RESOURCES + 1).fill(summary.resource_changes[0]) },
    { ...summary, resource_changes: [summary.resource_changes[0], summary.resource_changes[0]] },
    { ...summary, resource_changes: [{ address: "terraform_data.example", change: { actions: ["create"], after: { private: "secret" } } }] },
  ]) assert.throws(() => validateSummary(JSON.stringify(payload), identity));
});

test("resource metadata cannot inject Markdown, templates, shell commands, or file paths", () => {
  for (const address of ["terraform_data.example\n", "terraform_data.example\u2028", "../../script", "terraform_data.x`\n@someone", "{{ actor }}", "terraform_data.$(id)", "terraform_data.x[\"secret\"]", "aws_instance.example"]) {
    assert.throws(() => captureSummary({ resource_changes: [{ address, change: { actions: ["create"] } }] }, identity));
  }
  for (const actions of [[], ["<script>"], ["create", "create"], ["create,delete"], ["create", "delete", "create"], [true]]) {
    assert.throws(() => captureSummary({ resource_changes: [{ address: "terraform_data.example", change: { actions } }] }, identity));
  }
});

test("successful summaries show grouped planned actions without inventing apply results", () => {
  for (const mode of ["plan", "apply"] as const) {
    const operation = { ...identity, mode };
    const message = renderSummary(JSON.stringify(captureSummary(plan, operation)), operation, "success");
    assert.ok(message.startsWith(mode === "plan" ? "### Create (1)" : "**Planned changes**\n\n### Create (1)"));
    assert.ok(message.includes("<details><summary>Plan</summary>"));
    assert.ok(message.indexOf("### Create (1)") < message.indexOf("<details>"));
    assert.ok(message.includes("Plan: 1 to add, 0 to change, 0 to destroy."));
    assert.ok(!message.includes("Apply complete"));
    assert.ok(!message.includes("do-not-publish"));
    assert.ok(message.length < 60_000);
  }
});

test("unsuccessful job results stay visible alongside informational planned actions", () => {
  for (const outcome of ["failure", "cancelled", "skipped", "unknown"]) {
    const message = renderSummary(serialized(), identity, outcome);
    assert.ok(message.startsWith(`Terraform job result: **${outcome}**.\n\n**Planned changes**\n\n### Create (1)`));
    assert.ok(message.includes("Plan: 1 to add, 0 to change, 0 to destroy."));
    assert.ok(!message.includes("do-not-publish"));
  }
  assert.throws(() => renderSummary(serialized(), identity, "invented"));
});

test("missing, malicious, and stale summaries fall back without inventing success or no changes", () => {
  for (const input of ["", "{{ actor }}", JSON.stringify({ ...JSON.parse(serialized()), attempt: "2" })]) {
    const message = renderSummary(input, identity, "failure");
    assert.ok(message.includes("**failure**"));
    assert.ok(message.includes("unavailable or invalid"));
    assert.ok(!message.includes("No changes"));
    assert.ok(!message.includes("{{"));
  }
});

test("resource-only summaries do not claim that outputs or state are unchanged", () => {
  for (const actions of [null, ["no-op"], ["read"]]) {
    const summary = captureSummary({
      resource_changes: actions ? [{ address: "terraform_data.example", change: { actions } }] : [],
      output_changes: { receipt: { actions: ["update"], before: "old", after: "new" } },
    }, identity);
    const message = renderSummary(JSON.stringify(summary), identity, "success");
    assert.equal(message, "**Resources: no changes planned.**");
    assert.ok(!message.includes("Your infrastructure matches the configuration"));
    assert.ok(!message.includes("receipt"));
  }
});

test("imports and replacements retain their meaning while unchanged rows disappear", () => {
  const changes = [
    { address: "terraform_data.example_import", change: { actions: ["no-op"], importing: { id: "private-import-id" } } },
    { address: "terraform_data.example_create", change: { actions: ["create"] } },
    { address: "terraform_data.example_update", change: { actions: ["update"] } },
    { address: "terraform_data.example_replace_first", change: { actions: ["delete", "create"] } },
    { address: "terraform_data.example_replace_last", change: { actions: ["create", "delete"] } },
    { address: "terraform_data.example_delete", change: { actions: ["delete"] } },
    { address: "terraform_data.example_unchanged", change: { actions: ["no-op"] } },
    { address: "terraform_data.example_read", change: { actions: ["read"] } },
  ];
  const message = renderSummary(JSON.stringify(captureSummary({ resource_changes: changes }, identity)), identity, "success");
  const [visible, details] = message.split("<details>");
  for (const group of ["Import (1)", "Create (1)", "Update (1)", "Replace (2)", "Delete (1)"]) {
    assert.ok(visible.includes(`### ${group}`));
    assert.ok(!details.includes(`### ${group}`));
  }
  assert.ok(details.includes("# terraform_data.example_replace_first: destroy, then create"));
  assert.ok(details.includes("# terraform_data.example_replace_last: create before destroy"));
  assert.ok(details.includes("Plan: 1 to import, 3 to add, 1 to change, 3 to destroy."));
  for (const omitted of ["example_unchanged", "example_read", "no-op", "private-import-id"]) assert.ok(!message.includes(omitted));
});

test("bounded import groups preserve totals and separate address rows", () => {
  const changes = Array.from({ length: 30 }, (_, index) => ({
    address: `terraform_data.example_import_${index}`, change: { actions: ["no-op"], importing: true },
  }));
  const message = renderSummary(JSON.stringify(captureSummary({ resource_changes: changes }, identity)), identity, "success");
  assert.ok(message.startsWith("### Import (30)"));
  assert.ok(message.includes("`terraform_data.example_import_0`  \n⬆️ `terraform_data.example_import_1`"));
  assert.equal((message.match(/⬆️ `/g) ?? []).length, 25);
  assert.ok(message.includes("_... and 5 more._"));
  assert.ok(message.includes("Plan: 30 to import, 0 to add, 0 to change, 0 to destroy."));
  assert.ok(!message.includes("No changes"));
});

test("missing and truncated evidence preserves every known job outcome", () => {
  for (const outcome of ["success", "failure", "cancelled", "skipped", "unknown"]) {
    for (const payload of ["", serialized().slice(0, -1), "x".repeat(MAX_SUMMARY_BYTES + 1)]) {
      const message = renderSummary(payload, identity, outcome);
      assert.ok(message.startsWith(`Terraform job result: **${outcome}**.`));
      assert.ok(message.includes("Plan details are unavailable or invalid"));
      for (const unsupported of ["No changes", "no changes planned", "Apply complete", "<details>"]) assert.ok(!message.includes(unsupported));
    }
  }
});
