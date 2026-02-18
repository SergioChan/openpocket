import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizeAction } = require("../dist/agent/actions.js");

test("normalizeAction handles invalid payload", () => {
  const out = normalizeAction(null);
  assert.equal(out.type, "wait");
  assert.match(out.reason, /invalid action payload/);
});

test("normalizeAction converts numeric fields for tap/swipe", () => {
  const tap = normalizeAction({ type: "tap", x: "12", y: "34" });
  assert.deepEqual(tap, { type: "tap", x: 12, y: 34, reason: undefined });

  const swipe = normalizeAction({
    type: "swipe",
    x1: "1",
    y1: "2",
    x2: "3",
    y2: "4",
    durationMs: "500",
  });
  assert.equal(swipe.type, "swipe");
  assert.equal(swipe.durationMs, 500);
});

test("normalizeAction sets defaults for run_script and finish", () => {
  const runScript = normalizeAction({ type: "run_script", script: "echo hi" });
  assert.equal(runScript.type, "run_script");
  assert.equal(runScript.timeoutSec, 60);

  const finish = normalizeAction({ type: "finish" });
  assert.equal(finish.type, "finish");
  assert.equal(finish.message, "Task finished.");
});

test("normalizeAction falls back for unknown action", () => {
  const out = normalizeAction({ type: "unknown_x" });
  assert.equal(out.type, "wait");
  assert.match(out.reason, /unknown action type/);
});
