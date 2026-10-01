import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { directExecutionExitCode, errorMessage } from "./cli.ts";

export type VersionEnvironment = {
  githubOutput?: string;
  nodeVersion?: string;
  repositoryRoot?: string;
  terraformOutput?: string;
};

export const repositoryRoot = resolve(import.meta.dirname, "../..");

export function readPinnedVersion(root: string, relativePath: string): string {
  const contents = readFileSync(resolve(root, relativePath), "utf8");
  const match = contents.match(/^([0-9]+\.[0-9]+\.[0-9]+)\n?$/);
  if (!match || match[0] !== contents) {
    throw new Error(`${relativePath} must contain one exact stable version`);
  }
  return match[1]!;
}

export function appendGitHubOutput(path: string | undefined, name: string, value: string): void {
  if (path) {
    appendFileSync(path, `${name}=${value}\n`, { encoding: "utf8", mode: 0o600 });
  }
}

export function terraformVersion(root: string): string {
  return readPinnedVersion(root, ".terraform-version");
}

export function nodeVersion(root: string): string {
  return readPinnedVersion(root, ".node-version");
}

export function verifyVersionOutput(
  expectedTerraform: string,
  terraformOutput: string,
  expectedNode: string,
  actualNode: string,
): void {
  if (terraformOutput.split(/\r?\n/, 1)[0] !== `Terraform v${expectedTerraform}`) {
    throw new Error(`unexpected Terraform version; expected ${expectedTerraform}`);
  }
  if (actualNode !== `v${expectedNode}`) {
    throw new Error(`unexpected Node version; expected v${expectedNode}`);
  }
}

export function verifyToolVersions(environment: VersionEnvironment = {}): {
  node: string;
  terraform: string;
} {
  const root = environment.repositoryRoot ?? repositoryRoot;
  const terraform =
    environment.terraformOutput ??
    execFileSync("terraform", ["version"], {
      cwd: root,
      encoding: "utf8",
    });
  const node = environment.nodeVersion ?? process.version;

  verifyVersionOutput(terraformVersion(root), terraform, nodeVersion(root), node);
  return { node, terraform: terraform.trimEnd() };
}

export function runToolVersionsCli(
  argumentsList: string[],
  environment: VersionEnvironment = {},
  write = console.log,
  reportError = console.error,
): number {
  try {
    const root = environment.repositoryRoot ?? repositoryRoot;
    if (argumentsList.length !== 1) {
      throw new Error("usage: tool-versions.ts terraform|node|verify");
    }

    if (argumentsList[0] === "terraform" || argumentsList[0] === "node") {
      const version = argumentsList[0] === "node" ? nodeVersion(root) : terraformVersion(root);
      write(version);
      appendGitHubOutput(environment.githubOutput ?? process.env.GITHUB_OUTPUT, argumentsList[0] === "node" ? "node_version" : "version", version);
      return 0;
    }

    if (argumentsList[0] === "verify") {
      const versions = verifyToolVersions(environment);
      write(versions.terraform);
      write(versions.node);
      return 0;
    }

    throw new Error(`unsupported command: ${argumentsList[0]}`);
  } catch (error) {
    reportError(errorMessage(error));
    return 1;
  }
}

process.exitCode = directExecutionExitCode(
  import.meta.url,
  process.argv[1],
  runToolVersionsCli,
  [process.argv.slice(2)],
  process.exitCode,
);
