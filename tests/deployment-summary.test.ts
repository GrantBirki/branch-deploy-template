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

test("rendered plan details remain informational and the real job result stays visible", () => {
  for (const outcome of ["success", "failure", "cancelled", "skipped"]) {
    const message = renderSummary(serialized(), identity, outcome);
    assert.ok(message.includes(`Terraform job result: **${outcome}**`));
    assert.ok(message.includes("Planned resource changes (informational)"));
    assert.ok(message.includes("Create (1)"));
    assert.ok(message.includes("terraform_data.example: create"));
    assert.ok(!message.includes("do-not-publish"));
    assert.ok(message.length < 60_000);
  }
  assert.throws(() => renderSummary(serialized(), identity, "unknown"));
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
