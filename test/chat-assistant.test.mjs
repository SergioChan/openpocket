import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadConfig } = require("../dist/config/index.js");
const { ChatAssistant } = require("../dist/gateway/chat-assistant.js");

function createAssistant() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "openpocket-chat-"));
  const prev = process.env.OPENPOCKET_HOME;
  process.env.OPENPOCKET_HOME = home;
  const cfg = loadConfig();
  cfg.models[cfg.defaultModel].apiKey = "";
  cfg.models[cfg.defaultModel].apiKeyEnv = "MISSING_OPENAI_KEY";
  const assistant = new ChatAssistant(cfg);
  if (prev === undefined) {
    delete process.env.OPENPOCKET_HOME;
  } else {
    process.env.OPENPOCKET_HOME = prev;
  }
  return assistant;
}

test("ChatAssistant decide returns chat for greeting", async () => {
  const assistant = createAssistant();
  const out = await assistant.decide(1, "hi");
  assert.equal(out.mode, "chat");
  assert.equal(out.reason, "greeting");
  assert.match(out.reply, /decide whether to execute a task/i);
});

test("ChatAssistant decide returns task for obvious task keywords", async () => {
  const assistant = createAssistant();
  const out = await assistant.decide(2, "search weather in san francisco");
  assert.equal(out.mode, "task");
  assert.equal(out.task, "search weather in san francisco");
});

test("ChatAssistant reply handles missing API key gracefully", async () => {
  const assistant = createAssistant();
  const out = await assistant.reply(3, "who are you");
  assert.match(out, /API key.*not configured/i);
});
