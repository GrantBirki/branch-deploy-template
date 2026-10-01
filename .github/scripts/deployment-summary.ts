import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { directExecutionExitCode } from "./cli.ts";
import { nodeVersion, repositoryRoot } from "./tool-versions.ts";
import {
  appendDeploymentMessage, fitCommentToGitHubLimit, renderDeploymentResults,
  renderResourceChangeSummary, classifyResourceChanges, type ResourceChange,
} from "./render-deployment-message.ts";

export const MAX_SUMMARY_BYTES = 32_768;
export const MAX_RESOURCES = 100;
const ADDRESS = /^terraform_data\.[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const ACTIONS = new Set(["no-op", "create", "read", "update", "delete", "delete,create", "create,delete"]);

export type Identity = { sha: string; run: string; attempt: string; mode: "plan" | "apply" };
export type Summary = Identity & { resource_changes: ResourceChange[] };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid summary object");
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).sort().join() !== expected.sort().join()) throw new Error("Unexpected summary fields");
}

function validateIdentity(value: Identity): void {
  if (Object.values(value).some(field => typeof field !== "string" || field.trim() !== field)) throw new Error("Invalid summary identity");
  if (!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(value.sha) ||
      !/^[1-9][0-9]{0,19}$/.test(value.run) || !/^[1-9][0-9]{0,9}$/.test(value.attempt) ||
      !["plan", "apply"].includes(value.mode)) throw new Error("Invalid summary identity");
}

// Only built-in resource addresses and action names cross the job boundary.
// No values, outputs, import IDs, diagnostic text, or raw Terraform logs are accepted.
export function validateSummary(serialized: string, expected: Identity): Summary {
  validateIdentity(expected);
  if (!serialized || Buffer.byteLength(serialized) > MAX_SUMMARY_BYTES) throw new Error("Summary size limit");
  const value = record(JSON.parse(serialized));
  keys(value, ["sha", "run", "attempt", "mode", "resource_changes"]);
  for (const key of ["sha", "run", "attempt", "mode"] as const) {
    if (value[key] !== expected[key]) throw new Error("Summary identity mismatch");
  }
  if (!Array.isArray(value.resource_changes) || value.resource_changes.length > MAX_RESOURCES) {
    throw new Error("Resource count limit");
  }
  const seen = new Set<string>();
  const resource_changes = value.resource_changes.map((entry): ResourceChange => {
    const resource = record(entry);
    keys(resource, ["address", "change"]);
    if (typeof resource.address !== "string" || resource.address.trim() !== resource.address || !ADDRESS.test(resource.address) || seen.has(resource.address)) {
      throw new Error("Invalid resource address");
    }
    seen.add(resource.address);
    const change = record(resource.change);
    keys(change, change.importing === true ? ["actions", "importing"] : ["actions"]);
    if (!Array.isArray(change.actions) || change.actions.length < 1 || change.actions.length > 2 ||
        !change.actions.every(action => typeof action === "string" && /^[a-z-]+$/.test(action)) ||
        !ACTIONS.has(change.actions.join())) throw new Error("Invalid resource actions");
    return { address: resource.address, change: {
      actions: change.actions as string[], ...(change.importing === true ? { importing: true } : {}),
    } };
  });
  return { ...expected, resource_changes };
}

export function captureSummary(plan: unknown, identity: Identity): Summary {
  const data = record(plan);
  const changes = data.resource_changes ?? [];
  if (!Array.isArray(changes) || changes.length > MAX_RESOURCES) throw new Error("Resource count limit");
  const resource_changes = changes.map(entry => {
    const resource = record(entry);
    const change = record(resource.change);
    return { address: resource.address, change: {
      actions: change.actions, ...(change.importing !== undefined ? { importing: true } : {}),
    } };
  });
  return validateSummary(JSON.stringify({ ...identity, resource_changes }), identity);
}

export function renderSummary(serialized: string, identity: Identity, outcome: string,
  templatePath = resolve(repositoryRoot, ".github/deployment_message.md")): string {
  if (!["success", "failure", "cancelled", "skipped"].includes(outcome)) throw new Error("Invalid job result");
  const result = `Terraform job result: **${outcome}**.`;
  let data: Summary;
  try {
    data = validateSummary(serialized, identity);
  } catch {
    return `${result} Plan details are unavailable or invalid; see the workflow logs.`;
  }
  const summary = `${result}\n\nPlanned resource changes (informational):\n\n${
    renderResourceChangeSummary(classifyResourceChanges(data.resource_changes))}`;
  const display = {
    text: data.resource_changes.map(resource => `${resource.address}: ${resource.change!.actions!.join(", ")}`).join("\n") || "No planned resource changes.",
    notice: "_Resource actions only; state values and raw output are omitted. See the workflow logs for full output. The job result includes apply, verification, and cleanup when applicable._",
  };
  const fitted = fitCommentToGitHubLimit(templatePath, summary, display, identity.mode);
  return renderDeploymentResults(fitted.displayOutput.text, fitted.displayOutput.notice, fitted.summary, identity.mode);
}

function identityFromEnvironment(): Identity {
  const mode = process.env.SUMMARY_MODE;
  if (mode !== "noop" && mode !== "deploy") throw new Error("Invalid summary mode");
  return {
    sha: process.env.DEPLOYMENT_SHA ?? "", run: process.env.GITHUB_RUN_ID ?? "",
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
    mode: mode === "noop" ? "plan" : "apply",
  };
}

export function runSummaryCli(args: string[]): number {
  try {
    if (process.version !== `v${nodeVersion(repositoryRoot)}`) throw new Error("Unexpected Node version");
    const identity = identityFromEnvironment();
    const output = process.env.GITHUB_OUTPUT;
    if (!output) throw new Error("Missing output path");
    if (args[0] === "capture" && args.length === 2) {
      const raw = execFileSync("terraform", [`-chdir=${process.env.TERRAFORM_ROOT ?? repositoryRoot}`, "show", "-json", args[1]!], {
        encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
      });
      const summary = captureSummary(JSON.parse(raw), identity);
      appendFileSync(output, `summary=${JSON.stringify(summary)}\n`);
    } else if (args[0] === "render" && args.length === 1) {
      const message = renderSummary(process.env.PLAN_SUMMARY ?? "", identity, process.env.JOB_RESULT ?? "");
      appendDeploymentMessage(output, message);
    } else throw new Error("Invalid summary command");
    return 0;
  } catch {
    // Never echo untrusted plan contents or parser errors into trusted logs.
    console.error("Terraform summary could not be processed; see the execution logs.");
    return 1;
  }
}

process.exitCode = directExecutionExitCode(import.meta.url, process.argv[1], runSummaryCli, [process.argv.slice(2)], process.exitCode);
