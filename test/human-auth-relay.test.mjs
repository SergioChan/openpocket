import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { HumanAuthRelayServer } = require("../dist/human-auth/relay-server.js");

test("HumanAuthRelayServer create, resolve, and poll lifecycle", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "openpocket-auth-relay-"));
  const stateFile = path.join(temp, "relay-state.json");
  const apiKey = "relay-test-key";

  const relay = new HumanAuthRelayServer({
    host: "127.0.0.1",
    port: 0,
    publicBaseUrl: "",
    apiKey,
    apiKeyEnv: "OPENPOCKET_HUMAN_AUTH_KEY",
    stateFile,
  });

  await relay.start();
  const base = relay.address;
  assert.equal(base.startsWith("http://"), true);

  try {
    const createResponse = await fetch(`${base}/v1/human-auth/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        requestId: "req-test-1",
        task: "camera unblock",
        sessionId: "session-1",
        step: 2,
        capability: "camera",
        instruction: "Take a photo",
        reason: "Need real camera",
        timeoutSec: 90,
      }),
    });
    assert.equal(createResponse.status, 200);
    const created = await createResponse.json();

    assert.equal(created.requestId, "req-test-1");
    assert.match(created.openUrl, /\/human-auth\/req-test-1\?token=/);
    assert.equal(typeof created.pollToken, "string");

    const openUrl = new URL(created.openUrl);
    const openToken = openUrl.searchParams.get("token");
    assert.equal(Boolean(openToken), true);

    const pollPending = await fetch(
      `${base}/v1/human-auth/requests/req-test-1?pollToken=${encodeURIComponent(created.pollToken)}`,
    );
    assert.equal(pollPending.status, 200);
    const pendingBody = await pollPending.json();
    assert.equal(pendingBody.status, "pending");

    const resolveResponse = await fetch(`${base}/v1/human-auth/requests/req-test-1/resolve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: openToken,
        approved: true,
        note: "Approved from test",
        artifact: {
          mimeType: "image/jpeg",
          base64: Buffer.from("ok").toString("base64"),
        },
      }),
    });
    assert.equal(resolveResponse.status, 200);
    const resolvedBody = await resolveResponse.json();
    assert.equal(resolvedBody.status, "approved");

    const pollApproved = await fetch(
      `${base}/v1/human-auth/requests/req-test-1?pollToken=${encodeURIComponent(created.pollToken)}`,
    );
    assert.equal(pollApproved.status, 200);
    const approvedBody = await pollApproved.json();
    assert.equal(approvedBody.status, "approved");
    assert.equal(approvedBody.note, "Approved from test");
    assert.equal(approvedBody.artifact.mimeType, "image/jpeg");

    assert.equal(fs.existsSync(stateFile), true);
  } finally {
    await relay.stop();
  }
});
