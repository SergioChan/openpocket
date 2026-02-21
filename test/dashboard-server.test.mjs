import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadConfig } = require("../dist/config/index.js");
const { DashboardServer } = require("../dist/dashboard/server.js");

function withTempHome(prefix, fn) {
  const prevHome = process.env.OPENPOCKET_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.OPENPOCKET_HOME = home;
  try {
    return fn(home);
  } finally {
    if (prevHome === undefined) {
      delete process.env.OPENPOCKET_HOME;
    } else {
      process.env.OPENPOCKET_HOME = prevHome;
    }
  }
}

async function requestJson(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `${response.status}`);
  }
  return payload;
}

test("dashboard server exposes health/config and prompt CRUD APIs", async () => {
  await withTempHome("openpocket-dashboard-server-", async () => {
    const cfg = loadConfig();
    const server = new DashboardServer({
      config: cfg,
      mode: "standalone",
      host: "127.0.0.1",
      port: 0,
    });

    await server.start();
    const base = server.address;
    assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);

    try {
      const health = await requestJson(base, "/api/health");
      assert.equal(health.ok, true);

      const configPayload = await requestJson(base, "/api/config");
      assert.equal(typeof configPayload.config.projectName, "string");
      assert.equal(typeof configPayload.credentialStatus, "object");

      const promptFile = path.join(cfg.workspaceDir, "TEST_PROMPT.md");

      const added = await requestJson(base, "/api/prompts/add", {
        method: "POST",
        body: JSON.stringify({ title: "TEST", path: promptFile }),
      });
      assert.equal(Array.isArray(added.promptFiles), true);
      const target = added.promptFiles.find((item) => item.path === promptFile);
      assert.equal(Boolean(target), true);

      await requestJson(base, "/api/prompts/save", {
        method: "POST",
        body: JSON.stringify({ id: target.id, content: "hello prompt" }),
      });

      const read = await requestJson(base, "/api/prompts/read", {
        method: "POST",
        body: JSON.stringify({ id: target.id }),
      });
      assert.equal(read.content, "hello prompt");
      assert.equal(fs.existsSync(promptFile), true);

      const removed = await requestJson(base, "/api/prompts/remove", {
        method: "POST",
        body: JSON.stringify({ id: target.id }),
      });
      const stillExists = removed.promptFiles.some((item) => item.id === target.id);
      assert.equal(stillExists, false);
    } finally {
      await server.stop();
    }
  });
});
