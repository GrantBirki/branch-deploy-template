import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Execute the actual workflow check against an offline GitHub API double.
const workflow = readFileSync(new URL("../.github/workflows/branch-deploy.yml", import.meta.url), "utf8");
const script = workflow.split("      - name: check revision\n")[1]?.split("\n      - name:")[0]?.split("        run: |\n")[1]?.replace(/^          /gm, "");
assert.ok(script, "missing revision check");
const trusted = "a".repeat(40);
const candidate = "b".repeat(40);
const moved = "c".repeat(40);

function check(env: Record<string, string> = {}): number | null {
  return spawnSync("bash", ["-c", `
    gh() {
      [[ "$2" == "repos/example/repo/git/ref/heads/main" ]] || return 99
      printf '%s\n' "$MAIN_SHA"
    }
    ${script}
  `], { encoding: "utf8", env: {
    PATH: process.env.PATH, GITHUB_REPOSITORY: "example/repo", DEFAULT_BRANCH: "main",
    DEPLOYMENT_REF: "main", DEPLOYMENT_SHA: trusted, TRUSTED_SHA: trusted, MAIN_SHA: trusted, ...env,
  } }).status;
}

test("rollback uses trusted main without consulting the comment's PR", () => {
  assert.equal(check(), 0);
});

test("rollback rejects another SHA, moved main, or an unavailable main ref", () => {
  assert.notEqual(check({ DEPLOYMENT_SHA: candidate }), 0);
  assert.notEqual(check({ MAIN_SHA: moved }), 0);
  assert.notEqual(check({ DEPLOYMENT_SHA: moved, MAIN_SHA: moved }), 0);
  assert.notEqual(check({ MAIN_SHA: "" }), 0);
});

test("PR deployments retain Branch Deploy's admission rather than requiring the main SHA", () => {
  assert.equal(check({ DEPLOYMENT_REF: "feature", DEPLOYMENT_SHA: candidate, MAIN_SHA: "unavailable" }), 0);
});
