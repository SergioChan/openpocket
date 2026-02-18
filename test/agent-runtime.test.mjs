import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadConfig } = require("../dist/config/index.js");
const { AgentRuntime } = require("../dist/agent/agent-runtime.js");
const { ModelClient } = require("../dist/agent/model-client.js");

function makeSnapshot() {
  return {
    deviceId: "emulator-5554",
    currentApp: "com.android.launcher3",
    width: 1080,
    height: 2400,
    screenshotBase64: "abc",
    capturedAt: new Date().toISOString(),
  };
}

function setupRuntime({ returnHomeOnTaskEnd }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "openpocket-runtime-"));
  const prevHome = process.env.OPENPOCKET_HOME;
  process.env.OPENPOCKET_HOME = home;
  const cfg = loadConfig();
  cfg.agent.verbose = false;
  cfg.agent.maxSteps = 3;
  cfg.agent.loopDelayMs = 1;
  cfg.agent.returnHomeOnTaskEnd = returnHomeOnTaskEnd;
  cfg.models[cfg.defaultModel].apiKey = "dummy";
  cfg.models[cfg.defaultModel].apiKeyEnv = "MISSING_OPENAI_KEY";

  const runtime = new AgentRuntime(cfg);
  if (prevHome === undefined) {
    delete process.env.OPENPOCKET_HOME;
  } else {
    process.env.OPENPOCKET_HOME = prevHome;
  }
  return runtime;
}

test("AgentRuntime returns home after successful task by default", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: true });
  const actionCalls = [];

  runtime.adb = {
    captureScreenSnapshot: () => makeSnapshot(),
    executeAction: async (action) => {
      actionCalls.push(action);
      return "ok";
    },
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => ({
    thought: "done",
    action: { type: "finish", message: "task completed" },
    raw: '{"thought":"done","action":{"type":"finish","message":"task completed"}}',
  });

  try {
    const result = await runtime.runTask("go home test");
    assert.equal(result.ok, true);
    assert.equal(
      actionCalls.some((action) => action.type === "keyevent" && action.keycode === "KEYCODE_HOME"),
      true,
    );
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
  }
});

test("AgentRuntime does not return home when config is disabled", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  const actionCalls = [];

  runtime.adb = {
    captureScreenSnapshot: () => makeSnapshot(),
    executeAction: async (action) => {
      actionCalls.push(action);
      return "ok";
    },
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => ({
    thought: "done",
    action: { type: "finish", message: "task completed" },
    raw: '{"thought":"done","action":{"type":"finish","message":"task completed"}}',
  });

  try {
    const result = await runtime.runTask("no-home test");
    assert.equal(result.ok, true);
    assert.equal(
      actionCalls.some((action) => action.type === "keyevent" && action.keycode === "KEYCODE_HOME"),
      false,
    );
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
  }
});
