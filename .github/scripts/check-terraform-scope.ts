import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { directExecutionExitCode, errorMessage } from "./cli.ts";
import { repositoryRoot } from "./tool-versions.ts";

// This checks the demo's control files, not the safety of arbitrary Terraform.
export function checkTerraformScope(source: string, trusted = repositoryRoot): void {
  if (!lstatSync(source).isDirectory() || lstatSync(source).isSymbolicLink()) {
    throw new Error("Terraform root must be a real directory");
  }
  for (const name of ["backend.tf", ".terraform-version", ".node-version"]) {
    const candidate = resolve(source, name);
    if (!lstatSync(candidate).isFile() || lstatSync(candidate).isSymbolicLink() ||
        !readFileSync(candidate).equals(readFileSync(resolve(trusted, name)))) {
      throw new Error(`${name} must match the trusted checkout`);
    }
  }
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || /(?:^|_)override\.tf(?:\.json)?$/.test(entry.name) ||
        entry.name === ".terraform" || entry.name === ".terraform.lock.hcl" ||
        /\.tfstate(?:\.|$)/.test(entry.name)) {
      throw new Error("Terraform root contains a symlink, override, provider lock, or persistent state");
    }
  }
  // Resolving both roots also rejects a missing or invalid trusted directory.
  realpathSync(trusted);
  realpathSync(source);
}

export function runScopeCli(args: string[]): number {
  try {
    if (args.length !== 1) throw new Error("Usage: check-terraform-scope.ts SOURCE");
    checkTerraformScope(resolve(args[0]!));
    return 0;
  } catch (error) {
    console.error(errorMessage(error));
    return 1;
  }
}

process.exitCode = directExecutionExitCode(import.meta.url, process.argv[1], runScopeCli, [process.argv.slice(2)], process.exitCode);
