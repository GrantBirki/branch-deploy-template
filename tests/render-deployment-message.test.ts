import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appendDeploymentMessage, classifyResourceChanges, filterNoiseLines, fitCommentToGitHubLimit, renderDeploymentResults, renderResourceChangeSummary, renderTemplateText, truncateDisplayOutput } from "../.github/scripts/render-deployment-message.ts";
import { directExecutionExitCode } from "../.github/scripts/cli.ts";

test("importing the CLI helper does not run another module", () => {
  assert.equal(directExecutionExitCode("file:///one.ts", "/two.ts", () => { throw Error("must not execute"); }, [], 7), 7);
});

test("renderer groups actual resource actions including replacements and imports", () => {
  const summary = classifyResourceChanges([
    { address: "terraform_data.created", change: { actions: ["create"] } },
    { address: "terraform_data.updated", change: { actions: ["update"] } },
    { address: "terraform_data.replaced", change: { actions: ["delete", "create"] } },
    { address: "terraform_data.deleted", change: { actions: ["delete"] } },
    { address: "terraform_data.imported", change: { actions: ["no-op"], importing: true } },
  ]);
  const rendered = renderResourceChangeSummary(summary);
  for (const section of ["Import", "Create", "Update", "Replace", "Delete"]) assert.ok(rendered.includes(`${section} (1)`));
});

test("renderer bounds noisy output and preserves literal template-like data", () => {
  assert.equal(filterNoiseLines("terraform_data.example: Refreshing state... [id=1]\nPlan: 1 to add."), "Plan: 1 to add.");
  const bounded = truncateDisplayOutput(Array(300).fill("x".repeat(200)).join("\n"));
  assert.ok(bounded.text.length <= 20_000);
  assert.ok(bounded.notice.includes("truncated"));
  const template = "{{ actor }}\n{{ results }}";
  const rendered = renderTemplateText(template, "{{ actor }}", "", "summary");
  assert.ok(rendered.includes("```terraform\n{{ actor }}\n```"));
  assert.throws(() => renderTemplateText("missing", "", "", ""));
  assert.throws(() => renderTemplateText("{{ results }} {{ results }}", "", "", ""));
});

test("comment size and multiline output delimiters cannot be escaped", t => {
  const root = mkdtempSync(join(tmpdir(), "template-render-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const template = join(root, "template.md");
  writeFileSync(template, "{{ results }}");
  const fitted = fitCommentToGitHubLimit(template, "large\n".repeat(20_000), { text: "x\n".repeat(30_000), notice: "" });
  assert.ok(renderDeploymentResults(fitted.displayOutput.text, fitted.displayOutput.notice, fitted.summary, "plan").length <= 60_000);
  const output = join(root, "output");
  const collision = `deployment_message_${Buffer.alloc(16).toString("hex")}`;
  let counter = 0;
  appendDeploymentMessage(output, `${collision}\nother=value`, () => Buffer.alloc(16, counter++));
  const lines = readFileSync(output, "utf8").trimEnd().split("\n");
  assert.equal(counter, 2);
  assert.ok(lines[0].startsWith("DEPLOY_MESSAGE<<deployment_message_"));
  assert.equal(lines.at(-1), lines[0].split("<<")[1]);
});
