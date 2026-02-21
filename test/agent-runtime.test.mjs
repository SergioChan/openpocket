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
    scaleX: 1,
    scaleY: 1,
    scaledWidth: 1080,
    scaledHeight: 2400,
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

test("AgentRuntime pauses for request_human_auth and resumes after approval", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  const actions = [];
  const authRequests = [];

  runtime.adb = {
    captureScreenSnapshot: () => makeSnapshot(),
    executeAction: async (action) => {
      actions.push(action);
      return "ok";
    },
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  let callCount = 0;
  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        thought: "Need real camera authorization",
        action: {
          type: "request_human_auth",
          capability: "camera",
          instruction: "Please approve camera access.",
          timeoutSec: 120,
        },
        raw: '{"thought":"Need real camera authorization","action":{"type":"request_human_auth","capability":"camera","instruction":"Please approve camera access.","timeoutSec":120}}',
      };
    }
    return {
      thought: "Done",
      action: { type: "finish", message: "Completed after approval" },
      raw: '{"thought":"Done","action":{"type":"finish","message":"Completed after approval"}}',
    };
  };

  try {
    const result = await runtime.runTask(
      "human auth resume test",
      undefined,
      undefined,
      async (request) => {
        authRequests.push(request);
        return {
          requestId: "req-1",
          approved: true,
          status: "approved",
          message: "Approved by test.",
          decidedAt: new Date().toISOString(),
          artifactPath: null,
        };
      },
    );
    assert.equal(result.ok, true);
    assert.equal(authRequests.length, 1);
    assert.equal(authRequests[0].capability, "camera");
    assert.equal(actions.some((item) => item.type === "request_human_auth"), false);
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
  }
});

test("AgentRuntime fails when request_human_auth is rejected", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  runtime.adb = {
    captureScreenSnapshot: () => makeSnapshot(),
    executeAction: async () => "ok",
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => ({
    thought: "Need OTP",
    action: {
      type: "request_human_auth",
      capability: "2fa",
      instruction: "Confirm OTP code.",
      timeoutSec: 60,
    },
    raw: '{"thought":"Need OTP","action":{"type":"request_human_auth","capability":"2fa","instruction":"Confirm OTP code.","timeoutSec":60}}',
  });

  try {
    const result = await runtime.runTask(
      "human auth reject test",
      undefined,
      undefined,
      async () => ({
        requestId: "req-2",
        approved: false,
        status: "rejected",
        message: "User rejected",
        decidedAt: new Date().toISOString(),
        artifactPath: null,
      }),
    );
    assert.equal(result.ok, false);
    assert.match(result.message, /Human authorization rejected/);
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
  }
});

test("AgentRuntime auto-triggers human auth on Android permission dialog app", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  runtime.config.humanAuth.enabled = true;
  const authRequests = [];
  let snapshotCount = 0;

  runtime.adb = {
    captureScreenSnapshot: () => {
      snapshotCount += 1;
      if (snapshotCount === 1) {
        return {
          ...makeSnapshot(),
          currentApp: "com.android.permissioncontroller",
        };
      }
      return makeSnapshot();
    },
    executeAction: async () => "ok",
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  let modelCalls = 0;
  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => {
    modelCalls += 1;
    return {
      thought: "done",
      action: { type: "finish", message: "Completed after auto human auth" },
      raw: '{"thought":"done","action":{"type":"finish","message":"Completed after auto human auth"}}',
    };
  };

  try {
    const result = await runtime.runTask(
      "auto permission dialog test",
      undefined,
      undefined,
      async (request) => {
        authRequests.push(request);
        return {
          requestId: "req-auto-perm",
          approved: true,
          status: "approved",
          message: "Approved from phone",
          decidedAt: new Date().toISOString(),
          artifactPath: null,
        };
      },
    );

    assert.equal(result.ok, true);
    assert.equal(authRequests.length, 1);
    assert.equal(authRequests[0].capability, "permission");
    assert.match(authRequests[0].instruction, /system permission dialog/i);
    assert.equal(modelCalls >= 1, true);
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
  }
});

test("AgentRuntime maps approved permission decision to permission dialog tap", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  const actions = [];
  const uiDumpXml = [
    "<hierarchy rotation=\"0\">",
    "<node index=\"0\" text=\"Don't allow\" resource-id=\"com.android.permissioncontroller:id/permission_deny_button\" class=\"android.widget.Button\" package=\"com.android.permissioncontroller\" clickable=\"true\" enabled=\"true\" bounds=\"[56,2100][520,2200]\" />",
    "<node index=\"1\" text=\"Allow\" resource-id=\"com.android.permissioncontroller:id/permission_allow_button\" class=\"android.widget.Button\" package=\"com.android.permissioncontroller\" clickable=\"true\" enabled=\"true\" bounds=\"[560,2100][1024,2200]\" />",
    "</hierarchy>",
  ].join("");

  runtime.adb = {
    captureScreenSnapshot: () => ({
      ...makeSnapshot(),
      currentApp: "com.android.permissioncontroller",
    }),
    resolveDeviceId: () => "emulator-5554",
    executeAction: async (action) => {
      actions.push(action);
      return "ok";
    },
  };
  runtime.emulator = {
    runAdb: (args) => {
      if (Array.isArray(args) && args.includes("cat")) {
        return uiDumpXml;
      }
      return "ok";
    },
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  let callCount = 0;
  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        thought: "Need permission decision",
        action: {
          type: "request_human_auth",
          capability: "permission",
          instruction: "Please decide this permission.",
          timeoutSec: 90,
        },
        raw: '{"thought":"Need permission decision","action":{"type":"request_human_auth","capability":"permission","instruction":"Please decide this permission.","timeoutSec":90}}',
      };
    }
    return {
      thought: "Done",
      action: { type: "finish", message: "Completed after permission decision" },
      raw: '{"thought":"Done","action":{"type":"finish","message":"Completed after permission decision"}}',
    };
  };

  try {
    const result = await runtime.runTask(
      "permission decision tap test",
      undefined,
      undefined,
      async () => ({
        requestId: "req-perm-tap",
        approved: true,
        status: "approved",
        message: "Approved from phone",
        decidedAt: new Date().toISOString(),
        artifactPath: null,
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(
      actions.some(
        (action) =>
          action.type === "tap"
          && action.reason === "human_auth_permission_approve"
          && action.x >= 760
          && action.y >= 2100,
      ),
      true,
    );
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
  }
});

test("AgentRuntime applies OTP code from manual approval note when no artifact is provided", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  const actions = [];

  runtime.adb = {
    captureScreenSnapshot: () => makeSnapshot(),
    resolveDeviceId: () => "emulator-5554",
    executeAction: async (action) => {
      actions.push(action);
      return "ok";
    },
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  let callCount = 0;
  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        thought: "Need OTP code",
        action: {
          type: "request_human_auth",
          capability: "2fa",
          instruction: "Please provide current OTP.",
          timeoutSec: 90,
        },
        raw: '{"thought":"Need OTP code","action":{"type":"request_human_auth","capability":"2fa","instruction":"Please provide current OTP.","timeoutSec":90}}',
      };
    }
    return {
      thought: "Done",
      action: { type: "finish", message: "Completed after OTP note" },
      raw: '{"thought":"Done","action":{"type":"finish","message":"Completed after OTP note"}}',
    };
  };

  try {
    const result = await runtime.runTask(
      "otp note fallback test",
      undefined,
      undefined,
      async () => ({
        requestId: "req-otp-note",
        approved: true,
        status: "approved",
        message: "123456",
        decidedAt: new Date().toISOString(),
        artifactPath: null,
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(
      actions.some((action) => action.type === "type" && action.text === "123456"),
      true,
    );
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
  }
});

test("AgentRuntime applies delegated text artifact after human auth approval", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  const actions = [];
  const artifactFile = path.join(os.tmpdir(), `openpocket-artifact-text-${Date.now()}.json`);
  fs.writeFileSync(
    artifactFile,
    JSON.stringify({
      kind: "text",
      value: "123456",
      capability: "2fa",
    }),
    "utf-8",
  );

  runtime.adb = {
    captureScreenSnapshot: () => makeSnapshot(),
    resolveDeviceId: () => "emulator-5554",
    executeAction: async (action) => {
      actions.push(action);
      return "ok";
    },
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  let callCount = 0;
  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        thought: "Need OTP from phone",
        action: {
          type: "request_human_auth",
          capability: "2fa",
          instruction: "Input OTP code.",
          timeoutSec: 90,
        },
        raw: '{"thought":"Need OTP from phone","action":{"type":"request_human_auth","capability":"2fa","instruction":"Input OTP code.","timeoutSec":90}}',
      };
    }
    return {
      thought: "Done",
      action: { type: "finish", message: "Completed after OTP delegation" },
      raw: '{"thought":"Done","action":{"type":"finish","message":"Completed after OTP delegation"}}',
    };
  };

  try {
    const result = await runtime.runTask(
      "delegated text test",
      undefined,
      undefined,
      async () => ({
        requestId: "req-text",
        approved: true,
        status: "approved",
        message: "Code confirmed",
        decidedAt: new Date().toISOString(),
        artifactPath: artifactFile,
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(
      actions.some((action) => action.type === "type" && action.text === "123456"),
      true,
    );
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
    fs.rmSync(artifactFile, { force: true });
  }
});

test("AgentRuntime applies delegated location artifact after human auth approval", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  const adbActions = [];
  const emulatorCommands = [];
  const artifactFile = path.join(os.tmpdir(), `openpocket-artifact-geo-${Date.now()}.json`);
  fs.writeFileSync(
    artifactFile,
    JSON.stringify({
      kind: "geo",
      lat: 37.785834,
      lon: -122.406417,
      capability: "location",
    }),
    "utf-8",
  );

  runtime.adb = {
    captureScreenSnapshot: () => makeSnapshot(),
    resolveDeviceId: () => "emulator-5554",
    executeAction: async (action) => {
      adbActions.push(action);
      return "ok";
    },
  };
  runtime.emulator = {
    runAdb: (args) => {
      emulatorCommands.push(args);
      return "ok";
    },
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  let callCount = 0;
  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        thought: "Need real location",
        action: {
          type: "request_human_auth",
          capability: "location",
          instruction: "Share current location.",
          timeoutSec: 90,
        },
        raw: '{"thought":"Need real location","action":{"type":"request_human_auth","capability":"location","instruction":"Share current location.","timeoutSec":90}}',
      };
    }
    return {
      thought: "Done",
      action: { type: "finish", message: "Completed after delegated location" },
      raw: '{"thought":"Done","action":{"type":"finish","message":"Completed after delegated location"}}',
    };
  };

  try {
    const result = await runtime.runTask(
      "delegated geo test",
      undefined,
      undefined,
      async () => ({
        requestId: "req-geo",
        approved: true,
        status: "approved",
        message: "Location shared",
        decidedAt: new Date().toISOString(),
        artifactPath: artifactFile,
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(
      emulatorCommands.some(
        (args) =>
          Array.isArray(args) &&
          args.includes("emu") &&
          args.includes("geo") &&
          args.includes("fix") &&
          args.includes(String(-122.406417)) &&
          args.includes(String(37.785834)),
      ),
      true,
    );
    assert.equal(
      adbActions.some((action) => action.type === "type"),
      false,
    );
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
    fs.rmSync(artifactFile, { force: true });
  }
});

test("AgentRuntime appends gallery template hint after delegated image artifact", async () => {
  const runtime = setupRuntime({ returnHomeOnTaskEnd: false });
  const emulatorCommands = [];
  const artifactFile = path.join(os.tmpdir(), `openpocket-artifact-image-${Date.now()}.jpg`);
  fs.writeFileSync(artifactFile, Buffer.from("fake-image-bytes"));

  runtime.adb = {
    captureScreenSnapshot: () => makeSnapshot(),
    resolveDeviceId: () => "emulator-5554",
    executeAction: async () => "ok",
  };
  runtime.emulator = {
    runAdb: (args) => {
      emulatorCommands.push(args);
      return "ok";
    },
  };
  runtime.autoArtifactBuilder = {
    build: () => ({ skillPath: null, scriptPath: null }),
  };

  const observedHistories = [];
  let callCount = 0;
  const originalNextStep = ModelClient.prototype.nextStep;
  ModelClient.prototype.nextStep = async (params) => {
    observedHistories.push([...(params.history || [])]);
    callCount += 1;
    if (callCount === 1) {
      return {
        thought: "Need delegated camera capture",
        action: {
          type: "request_human_auth",
          capability: "camera",
          instruction: "Capture an image from real device camera.",
          timeoutSec: 120,
        },
        raw: '{"thought":"Need delegated camera capture","action":{"type":"request_human_auth","capability":"camera","instruction":"Capture an image from real device camera.","timeoutSec":120}}',
      };
    }
    return {
      thought: "Continue with picker",
      action: { type: "finish", message: "Completed with delegated image" },
      raw: '{"thought":"Continue with picker","action":{"type":"finish","message":"Completed with delegated image"}}',
    };
  };

  try {
    const result = await runtime.runTask(
      "delegated image template test",
      undefined,
      undefined,
      async () => ({
        requestId: "req-image",
        approved: true,
        status: "approved",
        message: "Image captured",
        decidedAt: new Date().toISOString(),
        artifactPath: artifactFile,
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(
      emulatorCommands.some((args) => Array.isArray(args) && args.includes("push") && args.includes(artifactFile)),
      true,
    );
    const secondCallHistory = observedHistories[1] || [];
    assert.equal(
      secondCallHistory.some((line) => typeof line === "string" && line.includes("delegation_template gallery_import_template")),
      true,
    );
  } finally {
    ModelClient.prototype.nextStep = originalNextStep;
    fs.rmSync(artifactFile, { force: true });
  }
});
