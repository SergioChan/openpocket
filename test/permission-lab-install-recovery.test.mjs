import test from "node:test";
import assert from "node:assert/strict";

import { isAdbInstallUpdateIncompatible } from "../dist/test/permission-lab.js";

test("isAdbInstallUpdateIncompatible detects signature mismatch error", () => {
  const detail = [
    "adb: failed to install /tmp/permission-lab-debug.apk: Failure",
    "[INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package ai.openpocket.permissionlab signatures do not match newer version; ignoring!]",
  ].join("\n");
  assert.equal(isAdbInstallUpdateIncompatible(detail), true);
});

test("isAdbInstallUpdateIncompatible ignores unrelated install failures", () => {
  const detail = "Failure [INSTALL_FAILED_VERSION_DOWNGRADE]";
  assert.equal(isAdbInstallUpdateIncompatible(detail), false);
});
