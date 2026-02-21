import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ensureWorkspaceBootstrap, WorkspaceStore } = require("../dist/memory/workspace.js");

test("ensureWorkspaceBootstrap creates required layout", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpocket-workspace-bootstrap-"));
  ensureWorkspaceBootstrap(workspaceDir);

  const required = [
    "AGENTS.md",
    "SOUL.md",
    "USER.md",
    "IDENTITY.md",
    "TOOLS.md",
    "HEARTBEAT.md",
    "MEMORY.md",
    "PROFILE_ONBOARDING.json",
    path.join("memory", "README.md"),
    path.join("skills", "README.md"),
    path.join("scripts", "README.md"),
    path.join("cron", "README.md"),
    path.join("cron", "jobs.json"),
  ];

  for (const rel of required) {
    assert.equal(fs.existsSync(path.join(workspaceDir, rel)), true, rel);
  }
});

test("WorkspaceStore writes session steps final and daily memory", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpocket-workspace-store-"));
  const store = new WorkspaceStore({ workspaceDir });

  const session = store.createSession("search weather", "gpt-5.2-codex", "gpt-5.2-codex");
  store.appendStep(
    session,
    1,
    "I should tap search input",
    JSON.stringify({ type: "tap", x: 10, y: 20 }),
    "Tapped at (10,20)",
  );
  store.finalizeSession(session, true, "Done");
  const memoryPath = store.appendDailyMemory("gpt-5.2-codex", "search weather", true, "Done");

  const sessionBody = fs.readFileSync(session.path, "utf-8");
  assert.match(sessionBody, /### Step 1/);
  assert.match(sessionBody, /status: SUCCESS/);
  assert.match(sessionBody, /search weather/);

  const memoryBody = fs.readFileSync(memoryPath, "utf-8");
  assert.match(memoryBody, /\[OK\]/);
  assert.match(memoryBody, /search weather/);
});
