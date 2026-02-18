import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ModelClient } = require("../dist/agent/model-client.js");

function makeProfile() {
  return {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.2-codex",
    apiKey: "",
    apiKeyEnv: "OPENAI_API_KEY",
    maxTokens: 512,
    reasoningEffort: "medium",
    temperature: null,
  };
}

function makeSnapshot() {
  return {
    deviceId: "emulator-5554",
    currentApp: "com.android.chrome",
    width: 1080,
    height: 2400,
    screenshotBase64: "abc",
    capturedAt: new Date().toISOString(),
  };
}

test("ModelClient falls back from chat to responses", async () => {
  const client = new ModelClient(makeProfile(), "dummy");
  client.client = {
    chat: {
      completions: {
        create: async () => {
          throw new Error("chat not supported");
        },
      },
    },
    responses: {
      create: async () => ({
        output_text: '{"thought":"done","action":{"type":"finish","message":"ok"}}',
      }),
    },
    completions: {
      create: async () => {
        throw new Error("not needed");
      },
    },
  };

  const out = await client.nextStep({
    systemPrompt: "system",
    task: "task",
    step: 1,
    snapshot: makeSnapshot(),
    history: [],
  });

  assert.equal(out.action.type, "finish");
  assert.equal(out.action.message, "ok");
  assert.equal(out.thought, "done");
  assert.equal(client.modeHint, "responses");
});

test("ModelClient converts invalid JSON output into wait action", async () => {
  const client = new ModelClient(makeProfile(), "dummy");
  client.client = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: "this is not json",
              },
            },
          ],
        }),
      },
    },
    responses: {
      create: async () => {
        throw new Error("not needed");
      },
    },
    completions: {
      create: async () => {
        throw new Error("not needed");
      },
    },
  };

  const out = await client.nextStep({
    systemPrompt: "system",
    task: "task",
    step: 2,
    snapshot: makeSnapshot(),
    history: [],
  });

  assert.equal(out.action.type, "wait");
  assert.match(out.action.reason, /model output was not valid JSON/);
  assert.match(out.thought, /not json/);
});
