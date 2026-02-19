import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadConfig } = require("../dist/config/index.js");
const { ChatAssistant } = require("../dist/gateway/chat-assistant.js");

function createAssistant(options = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "openpocket-chat-"));
  const prev = process.env.OPENPOCKET_HOME;
  process.env.OPENPOCKET_HOME = home;
  const cfg = loadConfig();
  if (options.withApiKey) {
    cfg.models[cfg.defaultModel].apiKey = "test-key";
  } else {
    cfg.models[cfg.defaultModel].apiKey = "";
    cfg.models[cfg.defaultModel].apiKeyEnv = "MISSING_OPENAI_KEY";
  }
  const assistant = new ChatAssistant(cfg);
  if (prev === undefined) {
    delete process.env.OPENPOCKET_HOME;
  } else {
    process.env.OPENPOCKET_HOME = prev;
  }
  return assistant;
}

test("ChatAssistant decide relies on model routing for greeting text", async () => {
  const assistant = createAssistant({ withApiKey: true });
  assistant.classifyWithModel = async () => ({
    mode: "chat",
    task: "",
    reply: "",
    confidence: 0.93,
    reason: "model_classify",
  });

  const out = await assistant.decide(1, "hi");
  assert.equal(out.mode, "chat");
  assert.equal(out.reason, "model_classify");
  assert.equal(out.reply, "");
});

test("ChatAssistant decide keeps model task result", async () => {
  const assistant = createAssistant({ withApiKey: true });
  assistant.classifyWithModel = async () => ({
    mode: "task",
    task: "search weather in san francisco",
    reply: "",
    confidence: 0.88,
    reason: "model_task",
  });

  const out = await assistant.decide(2, "search weather in san francisco");
  assert.equal(out.mode, "task");
  assert.equal(out.task, "search weather in san francisco");
  assert.equal(out.reason, "model_task");
});

test("ChatAssistant decide reports missing API key without heuristics", async () => {
  const assistant = createAssistant();
  const out = await assistant.decide(3, "hi");
  assert.equal(out.mode, "chat");
  assert.equal(out.reason, "no_api_key");
  assert.match(out.reply, /API key.*not configured/i);
});

test("ChatAssistant reply handles missing API key gracefully", async () => {
  const assistant = createAssistant();
  const out = await assistant.reply(4, "who are you");
  assert.match(out, /API key.*not configured/i);
});
