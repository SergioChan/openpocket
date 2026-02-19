import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadConfig } = require("../dist/config/index.js");
const { runSetupWizard } = require("../dist/onboarding/setup-wizard.js");

class FakePrompter {
  constructor(script) {
    this.script = {
      selects: [...(script.selects ?? [])],
      confirms: [...(script.confirms ?? [])],
      texts: [...(script.texts ?? [])],
      pauseCount: script.pauseCount ?? 0,
    };
    this.closed = false;
  }

  async intro() {}
  async note() {}
  async outro() {}

  async select(_message, _options) {
    if (this.script.selects.length === 0) {
      throw new Error("No scripted select value.");
    }
    return this.script.selects.shift();
  }

  async confirm() {
    if (this.script.confirms.length === 0) {
      throw new Error("No scripted confirm value.");
    }
    return this.script.confirms.shift();
  }

  async text() {
    if (this.script.texts.length === 0) {
      throw new Error("No scripted text value.");
    }
    return this.script.texts.shift();
  }

  async pause() {
    if (this.script.pauseCount <= 0) {
      throw new Error("Unexpected pause.");
    }
    this.script.pauseCount -= 1;
  }

  async close() {
    this.closed = true;
  }
}

class FakeEmulator {
  constructor() {
    this.started = 0;
    this.shown = 0;
    this.adbCalls = [];
  }

  async start() {
    this.started += 1;
    return "Emulator booted: emulator-5554";
  }

  showWindow() {
    this.shown += 1;
    return "Android Emulator window activated.";
  }

  status() {
    return {
      avdName: "OpenPocket_AVD",
      devices: ["emulator-5554"],
      bootedDevices: ["emulator-5554"],
    };
  }

  runAdb(args) {
    this.adbCalls.push(args);
    return "package:/system/priv-app/Phonesky/Phonesky.apk";
  }
}

function withTempHome(prefix, fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const prev = process.env.OPENPOCKET_HOME;
  process.env.OPENPOCKET_HOME = home;
  try {
    return fn(home);
  } finally {
    if (prev === undefined) {
      delete process.env.OPENPOCKET_HOME;
    } else {
      process.env.OPENPOCKET_HOME = prev;
    }
  }
}

test("setup wizard aborts when consent is not accepted", async () => {
  await withTempHome("openpocket-setup-consent-", async () => {
    const cfg = loadConfig();
    const prompter = new FakePrompter({
      confirms: [false],
    });
    const emulator = new FakeEmulator();

    await assert.rejects(
      () => runSetupWizard(cfg, { prompter, emulator, skipTtyCheck: true, printHeader: false }),
      /consent not accepted/i,
    );
    assert.equal(prompter.closed, true);
    assert.equal(fs.existsSync(path.join(cfg.stateDir, "onboarding.json")), false);
  });
});

test("setup wizard configures OpenAI key and records Gmail onboarding state", async () => {
  await withTempHome("openpocket-setup-full-", async () => {
    const cfg = loadConfig();
    const prompter = new FakePrompter({
      confirms: [true, true, true],
      selects: ["gpt-5.2-codex", "config", "start", "disabled"],
      texts: ["sk-test-openpocket"],
      pauseCount: 1,
    });
    const emulator = new FakeEmulator();

    await runSetupWizard(cfg, { prompter, emulator, skipTtyCheck: true, printHeader: false });

    assert.equal(prompter.closed, true);
    assert.equal(emulator.started, 1);
    assert.equal(emulator.shown, 1);
    assert.equal(emulator.adbCalls.length > 0, true);

    const savedCfg = JSON.parse(fs.readFileSync(cfg.configPath, "utf-8"));
    assert.equal(savedCfg.models["gpt-5.2-codex"].apiKey, "sk-test-openpocket");
    assert.equal(savedCfg.models["gpt-5.3-codex"].apiKey, "sk-test-openpocket");

    const statePath = path.join(cfg.stateDir, "onboarding.json");
    assert.equal(fs.existsSync(statePath), true);
    const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    assert.equal(state.modelProfile, "gpt-5.2-codex");
    assert.equal(state.apiKeyEnv, "OPENAI_API_KEY");
    assert.equal(state.apiKeySource, "config");
    assert.equal(typeof state.consentAcceptedAt, "string");
    assert.equal(typeof state.gmailLoginConfirmedAt, "string");
    assert.equal(state.playStoreDetected, true);
  });
});

test("setup wizard applies provider key to selected provider only", async () => {
  await withTempHome("openpocket-setup-provider-", async () => {
    const cfg = loadConfig();
    const prompter = new FakePrompter({
      confirms: [true, true],
      selects: ["autoglm-phone", "config", "skip", "disabled"],
      texts: ["zai-test-key"],
      pauseCount: 0,
    });
    const emulator = new FakeEmulator();

    await runSetupWizard(cfg, { prompter, emulator, skipTtyCheck: true, printHeader: false });

    const savedCfg = JSON.parse(fs.readFileSync(cfg.configPath, "utf-8"));
    assert.equal(savedCfg.models["autoglm-phone"].apiKey, "zai-test-key");
    assert.equal(savedCfg.models["gpt-5.2-codex"].apiKey, "");
    assert.equal(savedCfg.models["claude-sonnet-4.6"].apiKey, "");
  });
});

test("setup wizard configures local human-auth ngrok mode", async () => {
  await withTempHome("openpocket-setup-human-auth-ngrok-", async () => {
    const cfg = loadConfig();
    const prevToken = process.env.NGROK_AUTHTOKEN;
    process.env.NGROK_AUTHTOKEN = "ngrok-test-token";
    const prompter = new FakePrompter({
      confirms: [true],
      selects: ["gpt-5.2-codex", "skip", "skip", "ngrok", "env"],
      texts: [],
      pauseCount: 0,
    });
    const emulator = new FakeEmulator();

    try {
      await runSetupWizard(cfg, { prompter, emulator, skipTtyCheck: true, printHeader: false });
    } finally {
      if (prevToken === undefined) {
        delete process.env.NGROK_AUTHTOKEN;
      } else {
        process.env.NGROK_AUTHTOKEN = prevToken;
      }
    }

    const savedCfg = JSON.parse(fs.readFileSync(cfg.configPath, "utf-8"));
    assert.equal(savedCfg.humanAuth.enabled, true);
    assert.equal(savedCfg.humanAuth.useLocalRelay, true);
    assert.equal(savedCfg.humanAuth.tunnel.provider, "ngrok");
    assert.equal(savedCfg.humanAuth.tunnel.ngrok.enabled, true);
    assert.equal(savedCfg.humanAuth.tunnel.ngrok.authtoken, "");
    assert.equal(savedCfg.humanAuth.localRelayHost, "127.0.0.1");
  });
});
