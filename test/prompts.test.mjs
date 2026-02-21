import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildSystemPrompt, buildUserPrompt } = require("../dist/agent/prompts.js");

test("buildSystemPrompt includes planning rules and skills", () => {
  const prompt = buildSystemPrompt("- skill-a\n- skill-b");
  assert.match(prompt, /You are OpenPocket/);
  assert.match(prompt, /Planning:/);
  assert.match(prompt, /sub-goals/);
  assert.match(prompt, /calling tools/);
  assert.match(prompt, /Available skills/);
  assert.match(prompt, /Write thought and all text fields in English/);
  assert.match(prompt, /skill-a/);
});

test("buildUserPrompt keeps only recent 8 history items", () => {
  const history = Array.from({ length: 12 }, (_, i) => `step-history-${i + 1}`);
  const prompt = buildUserPrompt(
    "check weather",
    5,
    {
      deviceId: "emulator-5554",
      currentApp: "com.android.chrome",
      width: 1080,
      height: 2400,
      capturedAt: new Date().toISOString(),
      screenshotBase64: "abc",
      scaleX: 1,
      scaleY: 1,
      scaledWidth: 1080,
      scaledHeight: 2400,
    },
    history,
  );

  assert.match(prompt, /Task: check weather/);
  assert.match(prompt, /step-history-12/);
  assert.match(prompt, /step-history-5/);
  assert.doesNotMatch(prompt, /step-history-1(?!\d)/);
  assert.doesNotMatch(prompt, /step-history-4(?!\d)/);
});
