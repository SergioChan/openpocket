import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcherPath = path.join(repoRoot, "openpocket");

test("local launcher supports ./openpocket --help", () => {
  const result = spawnSync(launcherPath, ["--help"], {
    cwd: repoRoot,
    encoding: "utf-8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OpenPocket CLI/);
});
