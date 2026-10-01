import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readPinnedVersion, runToolVersionsCli, verifyToolVersions } from "../.github/scripts/tool-versions.ts";

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "template-versions-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, ".terraform-version"), "1.2.3\n");
  writeFileSync(join(root, ".node-version"), "24.0.0\n");
  return root;
}

test("strict version parsing prevents multiline output injection and floating versions", t => {
  const root = fixture(t);
  assert.equal(readPinnedVersion(root, ".terraform-version"), "1.2.3");
  for (const contents of ["", "1.2.3\n\n", "latest\n", "1.2.3\nother=value\n", " 1.2.3\n", "1.2.3-rc1\n"]) {
    writeFileSync(join(root, ".terraform-version"), contents);
    assert.throws(() => readPinnedVersion(root, ".terraform-version"));
  }
});

test("Terraform and Node outputs remain distinct and verify rejects toolchain drift", t => {
  const root = fixture(t);
  const output = join(root, "output");
  const env = { repositoryRoot: root, githubOutput: output };
  assert.equal(runToolVersionsCli(["terraform"], env, () => {}), 0);
  assert.equal(runToolVersionsCli(["node"], env, () => {}), 0);
  assert.equal(readFileSync(output, "utf8"), "version=1.2.3\nnode_version=24.0.0\n");
  const versions = { ...env, terraformOutput: "Terraform v1.2.3\non test\n", nodeVersion: "v24.0.0" };
  assert.doesNotThrow(() => verifyToolVersions(versions));
  assert.throws(() => verifyToolVersions({ ...versions, terraformOutput: "Terraform v1.2.30" }));
  assert.throws(() => verifyToolVersions({ ...versions, nodeVersion: "v24.0.1" }));
  assert.equal(runToolVersionsCli(["invalid"], env, () => {}, () => {}), 1);
});
