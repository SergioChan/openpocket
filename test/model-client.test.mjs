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
    scaleX: 1,
    scaleY: 1,
    scaledWidth: 1080,
    scaledHeight: 2400,
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
        output: [
          {
            type: "function_call",
            name: "finish",
            arguments: '{"thought":"done","message":"ok"}',
          },
        ],
      }),
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

test("ModelClient parses chat tool call correctly", async () => {
  const client = new ModelClient(makeProfile(), "dummy");
  client.client = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "tap",
                      arguments: '{"thought":"tapping button","x":540,"y":1200}',
                    },
                  },
                ],
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
  };

  const out = await client.nextStep({
    systemPrompt: "system",
    task: "task",
    step: 2,
    snapshot: makeSnapshot(),
    history: [],
  });

  assert.equal(out.action.type, "tap");
  assert.equal(out.action.x, 540);
  assert.equal(out.action.y, 1200);
  assert.equal(out.thought, "tapping button");
});

test("ModelClient fails when no tool call is returned", async () => {
  const client = new ModelClient(makeProfile(), "dummy");
  client.client = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: "no tool call here" } }],
        }),
      },
    },
    responses: {
      create: async () => ({
        output: [{ type: "text", text: "no tool call here either" }],
      }),
    },
  };

  await assert.rejects(
    () =>
      client.nextStep({
        systemPrompt: "system",
        task: "task",
        step: 2,
        snapshot: makeSnapshot(),
        history: [],
      }),
    /All model endpoints failed/,
  );
});
