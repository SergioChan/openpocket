import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildSystemPrompt, buildUserPrompt } = require("../dist/agent/prompts.js");

test("buildSystemPrompt includes planning rules and skills", () => {
  const prompt = buildSystemPrompt("- skill-a\n- skill-b");
  assert.match(prompt, /You are OpenPocket, an Android phone-use agent/);
  assert.match(prompt, /Planning Loop/);
  assert.match(prompt, /deterministic action/);
  assert.match(prompt, /Human Authorization Policy/);
  assert.match(prompt, /Available Skills/);
  assert.match(prompt, /Write thought and all text fields in English/);
  assert.match(prompt, /skill-a/);
});

test("buildSystemPrompt includes workspace context when provided", () => {
  const prompt = buildSystemPrompt("- skill-a", "### AGENTS.md\nrule A");
  assert.match(prompt, /Workspace Prompt Context/);
  assert.match(prompt, /AGENTS\.md/);
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
  assert.match(prompt, /Decision checklist/);
  assert.match(prompt, /Call exactly one tool now/);
  assert.doesNotMatch(prompt, /step-history-1(?!\d)/);
  assert.doesNotMatch(prompt, /step-history-4(?!\d)/);
});
