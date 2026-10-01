import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

import { directExecutionExitCode as runWhenDirect } from "./cli.ts";

export type ResourceChange = {
  address: string;
  change?: {
    actions?: string[];
    importing?: unknown;
  };
};

export type PlanJson = {
  resource_changes?: ResourceChange[];
};

export type Mode = "plan" | "apply";

export type DisplayOutput = {
  notice: string;
  text: string;
};

export type ResourceChangeSummary = {
  imports: string[];
  creates: string[];
  updates: string[];
  replaces: string[];
  deletes: string[];
};

export type RendererArgs = {
  displayOutputPath?: string;
  githubEnvPath?: string;
  mode: Mode;
  templatePath: string;
  outputPath: string;
  rawOutputPath: string;
  planJsonPath?: string;
};

export type ErrorReporter = (message: string) => void;

export const MAX_ADDR_PER_SECTION = 25;
export const MAX_DISPLAY_LINES = 250;
export const MAX_DISPLAY_CHARS = 20_000;
export const MAX_RENDERED_COMMENT_CHARS = 60_000;
export const NO_CHANGES_TEXT =
  "No changes. Your infrastructure matches the configuration.";
export const COMMENT_LIMIT_NOTICE =
  "_Terraform output further truncated to fit GitHub's PR comment size limit; see the linked workflow run for complete output._";
export const SUMMARY_LIMIT_NOTICE =
  "_Terraform action summary truncated to fit GitHub's PR comment size limit; see the linked workflow run for complete output._";
export const USAGE =
  "Usage: node render-deployment-message.ts --mode=plan|apply --template=<path> --output=<path> --raw-output=<path> [--plan-json=<path>] [--display-output=<path>] [--github-env=<path>]";

export function parseArgs(argv: string[]): RendererArgs {
  const args = new Map<string, string>();

  for (const arg of argv) {
    const [key, value] = arg.split("=", 2);
    if (key.startsWith("--") && value !== undefined) {
      args.set(key.slice(2), value);
    }
  }

  const mode = args.get("mode");
  const templatePath = args.get("template");
  const outputPath = args.get("output");
  const rawOutputPath = args.get("raw-output");
  const planJsonPath = args.get("plan-json");
  const displayOutputPath = args.get("display-output");
  const githubEnvPath = args.get("github-env");

  if (
    (mode !== "plan" && mode !== "apply") ||
    !templatePath ||
    !outputPath ||
    !rawOutputPath
  ) {
    throw new Error(USAGE);
  }

  return {
    mode,
    templatePath,
    outputPath,
    rawOutputPath,
    planJsonPath,
    displayOutputPath,
    githubEnvPath,
  };
}

export function readText(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

export function readJson(filePath: string): PlanJson {
  return JSON.parse(readText(filePath)) as PlanJson;
}

export function fileExists(filePath: string | undefined): boolean {
  return Boolean(filePath) && existsSync(filePath);
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

export function renderSection(
  label: string,
  emoji: string,
  items: string[],
): string[] {
  if (!items.length) {
    return [];
  }

  const shown = items.slice(0, MAX_ADDR_PER_SECTION);
  const hiddenCount = items.length - shown.length;
  const lines = [`### ${label} (${items.length})`, ""];

  lines.push(...shown.map((item) => `${emoji} \`${item}\``));

  if (hiddenCount > 0) {
    lines.push("", `_... and ${hiddenCount} more._`);
  }

  lines.push("");
  return lines;
}

export function normalizeRawOutput(rawOutputPath: string): string {
  if (!fileExists(rawOutputPath)) {
    return "No Terraform output captured.";
  }

  return normalizeNewlines(readText(rawOutputPath));
}

export function isNoiseLine(line: string): boolean {
  return [
    /^.+: Refreshing state\.\.\. \[id=.*\]$/,
    /^.+data\..+: Reading\.\.\.$/,
    /^.+data\..+: Read complete after .+ \[id=.*\]$/,
    /^Acquiring state lock\. This may take a few moments\.\.\.$/,
    /^Releasing state lock\. This may take a few moments\.\.\.$/,
  ].some((pattern) => pattern.test(line));
}

export function filterNoiseLines(text: string): string {
  const original = normalizeNewlines(text);
  const filtered = original
    .split("\n")
    .filter((line) => !isNoiseLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd();

  return filtered || original;
}

export function truncateDisplayOutput(text: string): DisplayOutput {
  const allLines = normalizeNewlines(text).split("\n");
  let truncatedByLines = false;
  let truncatedByChars = false;
  let displayText = allLines.join("\n");

  if (allLines.length > MAX_DISPLAY_LINES) {
    displayText = allLines.slice(0, MAX_DISPLAY_LINES).join("\n");
    truncatedByLines = true;
  }

  if (displayText.length > MAX_DISPLAY_CHARS) {
    let truncated = truncateUtf16Safely(displayText, MAX_DISPLAY_CHARS);
    const lastNewline = truncated.lastIndexOf("\n");

    if (lastNewline >= 0) {
      truncated = truncated.slice(0, lastNewline);
    }

    displayText = truncated;
    truncatedByChars = true;
  }

  const notices: string[] = [];

  if (truncatedByLines) {
    notices.push(
      `_Terraform output truncated to the first ${MAX_DISPLAY_LINES} lines; see the linked workflow run for complete output._`,
    );
  }

  if (truncatedByChars) {
    notices.push(
      `_Terraform output truncated to ${MAX_DISPLAY_CHARS.toLocaleString("en-US")} characters; see the linked workflow run for complete output._`,
    );
  }

  return {
    notice: notices.join("\n"),
    text: displayText.replace(/^\n+/, "").trimEnd() || "No Terraform output captured.",
  };
}

export function appendNotice(existingNotice: string, notice: string): string {
  if (!existingNotice) {
    return notice;
  }

  if (existingNotice.includes(notice)) {
    return existingNotice;
  }

  return `${existingNotice}\n${notice}`;
}

export function truncateUtf16Safely(text: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }

  if (text.length <= maxChars) {
    return text;
  }

  let truncated = text.slice(0, maxChars);
  const lastCodeUnit = truncated.charCodeAt(truncated.length - 1);

  if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
    truncated = truncated.slice(0, -1);
  }

  return truncated;
}

export function truncateToLineBoundary(text: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }

  if (text.length <= maxChars) {
    return text.trimEnd();
  }

  let truncated = truncateUtf16Safely(text, maxChars);
  const lastNewline = truncated.lastIndexOf("\n");

  if (lastNewline > 0) {
    truncated = truncated.slice(0, lastNewline);
  }

  return truncated.trimEnd();
}

export function buildDisplayOutput(
  rawOutputPath: string,
  displayOutputPath?: string,
): DisplayOutput {
  if (fileExists(displayOutputPath)) {
    return truncateDisplayOutput(readText(displayOutputPath as string));
  }

  return truncateDisplayOutput(filterNoiseLines(normalizeRawOutput(rawOutputPath)));
}

export function classifyResourceChanges(
  resourceChanges: ResourceChange[],
): ResourceChangeSummary {
  const summary: ResourceChangeSummary = {
    imports: [],
    creates: [],
    updates: [],
    replaces: [],
    deletes: [],
  };

  for (const resourceChange of resourceChanges) {
    const address = resourceChange.address;
    const change = resourceChange.change || {};
    const actions = change.actions || [];

    if (change.importing !== undefined) {
      summary.imports.push(address);
    }

    if (actions.length === 1 && actions[0] === "create") {
      summary.creates.push(address);
    } else if (actions.length === 1 && actions[0] === "update") {
      summary.updates.push(address);
    } else if (actions.length === 1 && actions[0] === "delete") {
      summary.deletes.push(address);
    } else if (actions.includes("delete") && actions.includes("create")) {
      summary.replaces.push(address);
    }
  }

  return summary;
}

export function renderResourceChangeSummary(
  summary: ResourceChangeSummary,
): string {
  const lines: string[] = [];

  lines.push(...renderSection("Import", "⬆️", summary.imports));
  lines.push(...renderSection("Create", "🟢", summary.creates));
  lines.push(...renderSection("Update", "🟡", summary.updates));
  lines.push(...renderSection("Replace", "🔁", summary.replaces));
  lines.push(...renderSection("Delete", "🔴", summary.deletes));

  if (lines.length === 0) {
    lines.push(`✅ **${NO_CHANGES_TEXT}**`);
  }

  return lines.join("\n").trimEnd();
}

export function buildStructuredSummary(planJsonPath: string): string {
  const plan = readJson(planJsonPath);
  return renderResourceChangeSummary(
    classifyResourceChanges(plan.resource_changes || []),
  );
}

export function buildPlanSummary(
  planJsonPath: string | undefined,
  rawOutputPath: string,
): string {
  const rawOutput = normalizeRawOutput(rawOutputPath);
  const lines: string[] = [];

  if (!fileExists(planJsonPath)) {
    if (rawOutput.includes(NO_CHANGES_TEXT)) {
      return `✅ **${NO_CHANGES_TEXT}**`;
    }

    lines.push(
      "Terraform plan output is available below.",
      "",
      "The structured plan summary could not be generated, so review the plan output below.",
    );
    return lines.join("\n").trimEnd();
  }

  return buildStructuredSummary(planJsonPath as string);
}

export function buildApplySummary(
  rawOutputPath: string,
  planJsonPath?: string,
): string {
  const rawOutput = normalizeRawOutput(rawOutputPath);
  const lines: string[] = [];

  const applyCompleteLine = rawOutput
    .split("\n")
    .find((line) => line.startsWith("Apply complete!"));

  if (applyCompleteLine) {
    return fileExists(planJsonPath)
      ? buildStructuredSummary(planJsonPath as string)
      : `**${applyCompleteLine}**`;
  }

  if (rawOutput.includes("Error:")) {
    lines.push(
      "Terraform apply did not complete successfully.",
      "",
      "Review the apply output below.",
    );
    return lines.join("\n").trimEnd();
  }

  lines.push(
    "Terraform apply output is available below.",
    "",
    "Review the apply output below.",
  );
  return lines.join("\n").trimEnd();
}

export function renderDeploymentResults(
  results: string,
  resultsNotice: string,
  summary: string,
  mode: Mode,
): string {
  const details = mode === "plan" ? "Plan" : "Apply";
  const notice = resultsNotice ? `\n\n${resultsNotice}` : "";

  return `${summary}\n\n<details><summary>${details}</summary>\n\n\`\`\`terraform\n${results}\n\`\`\`${notice}\n\n</details>`;
}

export function renderTemplate(
  templatePath: string,
  outputPath: string,
  results: string,
  resultsNotice: string,
  summary: string,
  mode: Mode = "plan",
): void {
  const template = readText(templatePath);
  renderTemplateText(template, results, resultsNotice, summary, mode);
  writeFileSync(
    outputPath,
    renderDeploymentResults(results, resultsNotice, summary, mode),
  );
}

export function renderTemplateText(
  template: string,
  results: string,
  resultsNotice: string,
  summary: string,
  mode: Mode = "plan",
): string {
  const resultsPlaceholder = "{{ results }}";
  const resultsIndex = template.indexOf(resultsPlaceholder);

  if (resultsIndex === -1) {
    throw new Error("Results placeholder not found in template");
  }

  if (
    template.indexOf(resultsPlaceholder, resultsIndex + resultsPlaceholder.length) !== -1
  ) {
    throw new Error("Results placeholder must occur exactly once in template");
  }

  return template.replace(
    resultsPlaceholder,
    renderDeploymentResults(results, resultsNotice, summary, mode),
  );
}

export function appendDeploymentMessage(
  githubEnvPath: string,
  message: string,
  generateBytes: (size: number) => Buffer = randomBytes,
): void {
  let delimiter: string;
  const lines = message.split(/\r?\n/);

  do {
    delimiter = `deployment_message_${generateBytes(16).toString("hex")}`;
  } while (lines.includes(delimiter));

  appendFileSync(
    githubEnvPath,
    `DEPLOY_MESSAGE<<${delimiter}\n${message}\n${delimiter}\n`,
    "utf8",
  );
}

export function fitCommentToGitHubLimit(
  templatePath: string,
  summary: string,
  displayOutput: DisplayOutput,
  mode: Mode = "plan",
): {
  summary: string;
  displayOutput: DisplayOutput;
} {
  const template = readText(templatePath);
  let fittedSummary = summary;
  let fittedDisplayOutput = { ...displayOutput };

  let rendered = renderTemplateText(
    template,
    fittedDisplayOutput.text,
    fittedDisplayOutput.notice,
    fittedSummary,
    mode,
  );

  if (rendered.length <= MAX_RENDERED_COMMENT_CHARS) {
    return { summary: fittedSummary, displayOutput: fittedDisplayOutput };
  }

  fittedDisplayOutput.notice = appendNotice(
    fittedDisplayOutput.notice,
    COMMENT_LIMIT_NOTICE,
  );

  rendered = renderTemplateText(
    template,
    fittedDisplayOutput.text,
    fittedDisplayOutput.notice,
    fittedSummary,
    mode,
  );

  if (
    rendered.length > MAX_RENDERED_COMMENT_CHARS &&
    fittedDisplayOutput.text.length > 0
  ) {
    const overflow = rendered.length - MAX_RENDERED_COMMENT_CHARS;
    const nextResultsLength = Math.max(
      0,
      fittedDisplayOutput.text.length - overflow - 1,
    );

    fittedDisplayOutput.text =
      truncateToLineBoundary(fittedDisplayOutput.text, nextResultsLength) ||
      "Comment body truncated to fit GitHub comment limits.";

    rendered = renderTemplateText(
      template,
      fittedDisplayOutput.text,
      fittedDisplayOutput.notice,
      fittedSummary,
      mode,
    );
  }

  if (rendered.length > MAX_RENDERED_COMMENT_CHARS && fittedSummary.length > 0) {
    const overflow = rendered.length - MAX_RENDERED_COMMENT_CHARS;
    const nextSummaryLength = Math.max(0, fittedSummary.length - overflow - 1);
    const truncatedSummary = truncateToLineBoundary(
      fittedSummary,
      nextSummaryLength,
    );

    fittedSummary = truncatedSummary
      ? `${truncatedSummary}\n\n${SUMMARY_LIMIT_NOTICE}`
      : SUMMARY_LIMIT_NOTICE;

    rendered = renderTemplateText(
      template,
      fittedDisplayOutput.text,
      fittedDisplayOutput.notice,
      fittedSummary,
      mode,
    );
  }

  if (rendered.length > MAX_RENDERED_COMMENT_CHARS) {
    fittedDisplayOutput.text = "Comment body truncated to fit GitHub comment limits.";
    fittedDisplayOutput.notice = COMMENT_LIMIT_NOTICE;

    rendered = renderTemplateText(
      template,
      fittedDisplayOutput.text,
      fittedDisplayOutput.notice,
      fittedSummary,
      mode,
    );
  }

  if (rendered.length > MAX_RENDERED_COMMENT_CHARS) {
    fittedSummary = SUMMARY_LIMIT_NOTICE;
  }

  return { summary: fittedSummary, displayOutput: fittedDisplayOutput };
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const args = parseArgs(argv);
  const displayOutput = buildDisplayOutput(
    args.rawOutputPath,
    args.displayOutputPath,
  );
  const summary =
    args.mode === "plan"
      ? buildPlanSummary(args.planJsonPath, args.rawOutputPath)
      : buildApplySummary(args.rawOutputPath, args.planJsonPath);
  const fittedComment = fitCommentToGitHubLimit(
    args.templatePath,
    summary,
    displayOutput,
    args.mode,
  );

  renderTemplate(
    args.templatePath,
    args.outputPath,
    fittedComment.displayOutput.text,
    fittedComment.displayOutput.notice,
    fittedComment.summary,
    args.mode,
  );

  if (args.githubEnvPath) {
    appendDeploymentMessage(args.githubEnvPath, readText(args.outputPath));
  }
}

export function runCli(argv: string[], reportError: ErrorReporter): number {
  try {
    main(argv);
    return 0;
  } catch (error) {
    if (String(error) === `Error: ${USAGE}`) {
      reportError(USAGE);
      return 1;
    }
    throw error;
  }
}

export function directExecutionExitCode(
  moduleUrl: string,
  scriptPath: string | undefined,
  argv: string[],
  reportError: ErrorReporter,
  currentExitCode: number | undefined,
): number | undefined {
  return runWhenDirect(
    moduleUrl,
    scriptPath,
    runCli,
    [argv, reportError],
    currentExitCode,
  );
}

process.exitCode = directExecutionExitCode(
  import.meta.url,
  process.argv[1],
  process.argv.slice(2),
  console.error,
  process.exitCode,
);
