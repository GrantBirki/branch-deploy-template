import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { checkTerraformScope } from "../.github/scripts/check-terraform-scope.ts";

function fixture(t: { after: (fn: () => void) => void }): string {
  const root = mkdtempSync(join(tmpdir(), "template-scope-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ["backend.tf", ".terraform-version", ".node-version"]) copyFileSync(resolve(name), join(root, name));
  return root;
}

test("candidate resource config is allowed while backend and tools remain trusted", t => {
  const root = fixture(t);
  writeFileSync(join(root, "resource.tf"), 'resource "terraform_data" "example" { input = "candidate" }');
  assert.doesNotThrow(() => checkTerraformScope(root));
  writeFileSync(join(root, "backend.tf"), 'terraform { backend "http" {} }');
  assert.throws(() => checkTerraformScope(root), /must match/);
});

test("candidate toolchain updates cannot select deployment runtimes before merge", t => {
  const root = fixture(t);
  writeFileSync(join(root, ".terraform-version"), "99.0.0\n");
  assert.throws(() => checkTerraformScope(root), /must match/);
});

for (const name of ["override.tf", "backend_override.tf.json", ".terraform.lock.hcl", "terraform.tfstate", "terraform.tfstate.backup"]) {
  test(`rejects ${name} before Terraform execution`, t => {
    const root = fixture(t);
    writeFileSync(join(root, name), "{}");
    assert.throws(() => checkTerraformScope(root));
  });
}

test("rejects preexisting Terraform data and symlinked source/control files", t => {
  const root = fixture(t);
  mkdirSync(join(root, ".terraform"));
  assert.throws(() => checkTerraformScope(root));
  rmSync(join(root, ".terraform"), { recursive: true });
  symlinkSync(resolve("main.tf"), join(root, "link.tf"));
  assert.throws(() => checkTerraformScope(root));
  rmSync(join(root, "link.tf"));
  rmSync(join(root, "backend.tf"));
  symlinkSync(resolve("backend.tf"), join(root, "backend.tf"));
  assert.throws(() => checkTerraformScope(root));
});
