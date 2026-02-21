import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { ensureDir, nowIso } from "../utils/paths";

type RelayStatus = "pending" | "approved" | "rejected" | "timeout";

type RelayRecord = {
  requestId: string;
  chatId: number | null;
  task: string;
  sessionId: string;
  step: number;
  capability: string;
  instruction: string;
  reason: string;
  currentApp: string;
  screenshotPath: string | null;
  createdAt: string;
  expiresAt: string;
  status: RelayStatus;
  note: string;
  decidedAt: string | null;
  artifact: { mimeType: string; base64: string } | null;
  openTokenHash: string;
  pollTokenHash: string;
};

function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function nowMs(): number {
  return Date.now();
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTruthyBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

async function readJsonBody(req: http.IncomingMessage, maxBytes = 2_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error("Payload too large.");
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) {
    return {};
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(body);
}

function sendText(res: http.ServerResponse, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(body);
}

function sendHtml(res: http.ServerResponse, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(body);
}

export interface HumanAuthRelayServerOptions {
  host: string;
  port: number;
  publicBaseUrl: string;
  apiKey: string;
  apiKeyEnv: string;
  stateFile: string;
}

export class HumanAuthRelayServer {
  private readonly options: HumanAuthRelayServerOptions;
  private readonly records = new Map<string, RelayRecord>();
  private server: http.Server | null = null;

  constructor(options: HumanAuthRelayServerOptions) {
    this.options = options;
    this.loadState();
  }

  get address(): string {
    if (!this.server) {
      return "";
    }
    const addr = this.server.address();
    if (!addr || typeof addr === "string") {
      return "";
    }
    return `http://${addr.address === "::" ? "127.0.0.1" : addr.address}:${addr.port}`;
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }
    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.options.port, this.options.host, () => {
        this.server?.removeListener("error", reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const current = this.server;
    this.server = null;
    await new Promise<void>((resolve) => {
      current.close(() => resolve());
    });
  }

  private loadState(): void {
    if (!this.options.stateFile) {
      return;
    }
    if (!fs.existsSync(this.options.stateFile)) {
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.options.stateFile, "utf-8")) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }
      for (const item of parsed) {
        if (!isObject(item) || typeof item.requestId !== "string") {
          continue;
        }
        const record: RelayRecord = {
          requestId: String(item.requestId),
          chatId:
            item.chatId === null || item.chatId === undefined
              ? null
              : Number.isFinite(Number(item.chatId))
                ? Number(item.chatId)
                : null,
          task: String(item.task ?? ""),
          sessionId: String(item.sessionId ?? ""),
          step: Number(item.step ?? 0),
          capability: String(item.capability ?? "unknown"),
          instruction: String(item.instruction ?? ""),
          reason: String(item.reason ?? ""),
          currentApp: String(item.currentApp ?? "unknown"),
          screenshotPath: item.screenshotPath ? String(item.screenshotPath) : null,
          createdAt: String(item.createdAt ?? nowIso()),
          expiresAt: String(item.expiresAt ?? nowIso()),
          status:
            item.status === "approved" ||
            item.status === "rejected" ||
            item.status === "timeout"
              ? item.status
              : "pending",
          note: String(item.note ?? ""),
          decidedAt: item.decidedAt ? String(item.decidedAt) : null,
          artifact:
            isObject(item.artifact) &&
            typeof item.artifact.mimeType === "string" &&
            typeof item.artifact.base64 === "string"
              ? { mimeType: item.artifact.mimeType, base64: item.artifact.base64 }
              : null,
          openTokenHash: String(item.openTokenHash ?? ""),
          pollTokenHash: String(item.pollTokenHash ?? ""),
        };
        this.records.set(record.requestId, record);
      }
    } catch {
      // Ignore malformed state files.
    }
  }

  private persistState(): void {
    if (!this.options.stateFile) {
      return;
    }
    ensureDir(path.dirname(this.options.stateFile));
    fs.writeFileSync(
      this.options.stateFile,
      `${JSON.stringify([...this.records.values()], null, 2)}\n`,
      "utf-8",
    );
  }

  private relayApiKey(): string {
    if (this.options.apiKey.trim()) {
      return this.options.apiKey.trim();
    }
    if (this.options.apiKeyEnv.trim()) {
      return process.env[this.options.apiKeyEnv]?.trim() ?? "";
    }
    return "";
  }

  private isAuthorized(req: http.IncomingMessage): boolean {
    const apiKey = this.relayApiKey();
    if (!apiKey) {
      return true;
    }
    const authHeader = String(req.headers.authorization ?? "");
    if (!authHeader.startsWith("Bearer ")) {
      return false;
    }
    return authHeader.slice("Bearer ".length).trim() === apiKey;
  }

  private makePublicBaseUrl(req: http.IncomingMessage, bodyPublicBaseUrl: string): string {
    if (bodyPublicBaseUrl.trim()) {
      return bodyPublicBaseUrl.trim().replace(/\/+$/, "");
    }
    if (this.options.publicBaseUrl.trim()) {
      return this.options.publicBaseUrl.trim().replace(/\/+$/, "");
    }
    const host = String(req.headers.host ?? `${this.options.host}:${this.options.port}`);
    const proto = String(req.headers["x-forwarded-proto"] ?? "http");
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  private updateTimeoutStatus(record: RelayRecord): void {
    if (record.status !== "pending") {
      return;
    }
    const expireMs = new Date(record.expiresAt).getTime();
    if (Number.isFinite(expireMs) && nowMs() > expireMs) {
      record.status = "timeout";
      record.note = record.note || "Request timed out.";
      record.decidedAt = nowIso();
      this.persistState();
    }
  }

  private renderPortalPage(record: RelayRecord, token: string): string {
    const requestId = escapeHtml(record.requestId);
    const capability = escapeHtml(record.capability);
    const instruction = escapeHtml(record.instruction || "(no instruction)");
    const reason = escapeHtml(record.reason || "(no reason)");
    const task = escapeHtml(record.task || "(no task)");
    const currentApp = escapeHtml(record.currentApp || "unknown");
    const tokenEscaped = escapeHtml(token);

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenPocket Human Auth</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: "SF Pro Text", "Segoe UI", Arial, sans-serif; background: linear-gradient(120deg, #f4f1ea, #f7fbff); color: #0c1d2a; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffffd9; border: 1px solid #d6dfeb; border-radius: 14px; padding: 18px; box-shadow: 0 8px 24px rgba(20, 40, 64, 0.08); }
    h1 { font-size: 24px; margin: 0 0 12px; }
    .meta { display: grid; gap: 8px; margin: 14px 0; }
    .meta div { background: #eef4fb; border-radius: 8px; padding: 10px; font-size: 14px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    button { border: 0; border-radius: 10px; padding: 10px 14px; font-size: 15px; cursor: pointer; }
    #approve { background: #177245; color: #fff; }
    #reject { background: #93332a; color: #fff; }
    #startCam, #snapCam, #pickPhoto { background: #123d67; color: #fff; }
    textarea { width: 100%; min-height: 80px; border-radius: 8px; border: 1px solid #c5d2e4; padding: 10px; margin-top: 10px; box-sizing: border-box; }
    video, canvas { width: 100%; border-radius: 10px; margin-top: 10px; background: #0b1118; }
    #photoPreview { width: 100%; border-radius: 10px; margin-top: 10px; background: #0b1118; }
    .status { margin-top: 14px; font-weight: 600; }
    .muted { color: #4a6279; font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>OpenPocket Authorization Request</h1>
      <div class="muted">Request ID: ${requestId}</div>
      <div class="meta">
        <div><strong>Task</strong><br/>${task}</div>
        <div><strong>Capability</strong><br/>${capability}</div>
        <div><strong>Instruction</strong><br/>${instruction}</div>
        <div><strong>Reason</strong><br/>${reason}</div>
        <div><strong>Current App</strong><br/>${currentApp}</div>
      </div>

      <label for="note"><strong>Optional note</strong></label>
      <textarea id="note" placeholder="e.g., Face ID approved, code confirmed"></textarea>

      <div class="actions">
        <button id="startCam" type="button">Enable Camera</button>
        <button id="snapCam" type="button">Capture Snapshot</button>
        <button id="pickPhoto" type="button">Capture/Upload Photo</button>
      </div>
      <div class="muted">Camera attachment is optional. You can approve/reject without snapshot.</div>
      <video id="video" autoplay playsinline hidden></video>
      <canvas id="canvas" hidden></canvas>
      <img id="photoPreview" alt="Captured preview" hidden />
      <input id="photoInput" type="file" accept="image/*" capture="environment" hidden />

      <div class="actions">
        <button id="approve" type="button">Approve</button>
        <button id="reject" type="button">Reject</button>
      </div>
      <div class="status" id="status"></div>
    </div>
  </div>

  <script>
    const requestId = ${JSON.stringify(record.requestId)};
    const token = ${JSON.stringify(tokenEscaped)};
    const statusEl = document.getElementById("status");
    const noteEl = document.getElementById("note");
    const videoEl = document.getElementById("video");
    const canvasEl = document.getElementById("canvas");
    const photoInputEl = document.getElementById("photoInput");
    const photoPreviewEl = document.getElementById("photoPreview");
    let stream = null;
    let artifact = null;

    function humanErrorMessage(err) {
      const name = err && err.name ? String(err.name) : "";
      const message = err && err.message ? String(err.message) : String(err || "unknown error");
      const lowered = (name + " " + message).toLowerCase();
      if (lowered.includes("notallowed") || lowered.includes("permission denied")) {
        return "Camera permission denied by this browser context. In Telegram in-app browser this can happen even after Allow. Use Capture/Upload Photo or approve directly.";
      }
      if (lowered.includes("notfound") || lowered.includes("device not found")) {
        return "No camera device available. Use Capture/Upload Photo or approve directly.";
      }
      if (lowered.includes("notreadable") || lowered.includes("track start failed")) {
        return "Camera is busy or blocked by another app. Close other camera apps and retry, or use Capture/Upload Photo.";
      }
      return "Failed to open camera: " + message;
    }

    function fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    }

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        videoEl.srcObject = stream;
        videoEl.hidden = false;
        photoPreviewEl.hidden = true;
        statusEl.textContent = "Camera enabled. Capture if needed, then approve.";
      } catch (err) {
        statusEl.textContent = humanErrorMessage(err);
      }
    }

    function captureSnapshot() {
      if (!videoEl.videoWidth || !videoEl.videoHeight) {
        statusEl.textContent = "Camera is not ready yet.";
        return;
      }
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      const ctx = canvasEl.getContext("2d");
      ctx.drawImage(videoEl, 0, 0);
      const dataUrl = canvasEl.toDataURL("image/jpeg", 0.88);
      const base64 = dataUrl.split(",")[1] || "";
      artifact = { mimeType: "image/jpeg", base64 };
      canvasEl.hidden = false;
      photoPreviewEl.hidden = true;
      statusEl.textContent = "Snapshot captured and attached.";
    }

    async function pickPhoto() {
      photoInputEl.value = "";
      photoInputEl.click();
    }

    async function onPhotoChange() {
      const file = photoInputEl.files && photoInputEl.files[0];
      if (!file) {
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        const base64 = dataUrl.split(",")[1] || "";
        const mimeType = file.type || "image/jpeg";
        artifact = { mimeType, base64 };
        canvasEl.hidden = true;
        videoEl.hidden = true;
        photoPreviewEl.src = dataUrl;
        photoPreviewEl.hidden = false;
        statusEl.textContent = "Photo attached.";
      } catch (err) {
        statusEl.textContent = "Failed to attach photo: " + (err && err.message ? err.message : String(err));
      }
    }

    async function submitDecision(approved) {
      statusEl.textContent = "Submitting...";
      try {
        const response = await fetch("/v1/human-auth/requests/" + encodeURIComponent(requestId) + "/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            approved,
            note: noteEl.value || "",
            artifact
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          statusEl.textContent = "Failed: " + (body.error || response.statusText);
          return;
        }
        statusEl.textContent = approved ? "Approved. You can close this page." : "Rejected. You can close this page.";
        if (stream) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
        }
      } catch (err) {
        statusEl.textContent = "Request failed: " + (err && err.message ? err.message : String(err));
      }
    }

    document.getElementById("startCam").addEventListener("click", startCamera);
    document.getElementById("snapCam").addEventListener("click", captureSnapshot);
    document.getElementById("pickPhoto").addEventListener("click", pickPhoto);
    photoInputEl.addEventListener("change", onPhotoChange);
    document.getElementById("approve").addEventListener("click", () => submitDecision(true));
    document.getElementById("reject").addEventListener("click", () => submitDecision(false));
  </script>
</body>
</html>`;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = String(req.method ?? "GET").toUpperCase();
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const pathname = requestUrl.pathname;

    if (method === "GET" && pathname === "/healthz") {
      sendJson(res, 200, { ok: true, now: nowIso(), requests: this.records.size });
      return;
    }

    if (method === "POST" && pathname === "/v1/human-auth/requests") {
      if (!this.isAuthorized(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: (error as Error).message });
        return;
      }

      if (!isObject(body)) {
        sendJson(res, 400, { error: "Invalid body." });
        return;
      }

      const requestId = String(body.requestId ?? `auth-${nowMs()}-${crypto.randomBytes(4).toString("hex")}`);
      const timeoutSecRaw = Number(body.timeoutSec ?? 300);
      const timeoutSec = Math.max(30, Math.min(1800, Number.isFinite(timeoutSecRaw) ? timeoutSecRaw : 300));
      const openToken = randomToken();
      const pollToken = randomToken();
      const createdAt = nowIso();
      const expiresAt = new Date(nowMs() + timeoutSec * 1000).toISOString();

      const record: RelayRecord = {
        requestId,
        chatId:
          body.chatId === null || body.chatId === undefined
            ? null
            : Number.isFinite(Number(body.chatId))
              ? Number(body.chatId)
              : null,
        task: String(body.task ?? ""),
        sessionId: String(body.sessionId ?? ""),
        step: Number(body.step ?? 0),
        capability: String(body.capability ?? "unknown"),
        instruction: String(body.instruction ?? ""),
        reason: String(body.reason ?? ""),
        currentApp: String(body.currentApp ?? "unknown"),
        screenshotPath: body.screenshotPath ? String(body.screenshotPath) : null,
        createdAt,
        expiresAt,
        status: "pending",
        note: "",
        decidedAt: null,
        artifact: null,
        openTokenHash: hashToken(openToken),
        pollTokenHash: hashToken(pollToken),
      };

      this.records.set(requestId, record);
      this.persistState();

      const publicBaseUrl = this.makePublicBaseUrl(
        req,
        body.publicBaseUrl ? String(body.publicBaseUrl) : "",
      );
      const openUrl =
        `${publicBaseUrl}/human-auth/${encodeURIComponent(requestId)}` +
        `?token=${encodeURIComponent(openToken)}`;

      sendJson(res, 200, {
        requestId,
        openUrl,
        pollToken,
        expiresAt,
      });
      return;
    }

    const pollMatch = pathname.match(/^\/v1\/human-auth\/requests\/([^/]+)$/);
    if (method === "GET" && pollMatch) {
      const requestId = decodeURIComponent(pollMatch[1]);
      const record = this.records.get(requestId);
      if (!record) {
        sendJson(res, 404, { error: "Request not found." });
        return;
      }
      this.updateTimeoutStatus(record);
      const pollToken = String(requestUrl.searchParams.get("pollToken") ?? "");
      if (!pollToken || hashToken(pollToken) !== record.pollTokenHash) {
        sendJson(res, 403, { error: "Invalid poll token." });
        return;
      }

      sendJson(res, 200, {
        requestId: record.requestId,
        status: record.status,
        note: record.note || undefined,
        decidedAt: record.decidedAt || undefined,
        artifact: record.artifact,
      });
      return;
    }

    const resolveMatch = pathname.match(/^\/v1\/human-auth\/requests\/([^/]+)\/resolve$/);
    if (method === "POST" && resolveMatch) {
      const requestId = decodeURIComponent(resolveMatch[1]);
      const record = this.records.get(requestId);
      if (!record) {
        sendJson(res, 404, { error: "Request not found." });
        return;
      }
      this.updateTimeoutStatus(record);
      if (record.status !== "pending") {
        sendJson(res, 409, { error: `Request already ${record.status}.` });
        return;
      }

      let body: unknown;
      try {
        body = await readJsonBody(req, 7_000_000);
      } catch (error) {
        sendJson(res, 400, { error: (error as Error).message });
        return;
      }
      if (!isObject(body)) {
        sendJson(res, 400, { error: "Invalid body." });
        return;
      }

      const token = String(body.token ?? "");
      if (!token || hashToken(token) !== record.openTokenHash) {
        sendJson(res, 403, { error: "Invalid token." });
        return;
      }

      const approved = isTruthyBoolean(body.approved);
      record.status = approved ? "approved" : "rejected";
      record.note = String(body.note ?? "").slice(0, 2000);
      record.decidedAt = nowIso();
      record.openTokenHash = "";

      if (
        isObject(body.artifact) &&
        typeof body.artifact.mimeType === "string" &&
        typeof body.artifact.base64 === "string" &&
        body.artifact.base64.length <= 6_000_000
      ) {
        record.artifact = {
          mimeType: body.artifact.mimeType,
          base64: body.artifact.base64,
        };
      } else {
        record.artifact = null;
      }

      this.persistState();
      sendJson(res, 200, {
        requestId: record.requestId,
        status: record.status,
        decidedAt: record.decidedAt,
      });
      return;
    }

    const pageMatch = pathname.match(/^\/human-auth\/([^/]+)$/);
    if (method === "GET" && pageMatch) {
      const requestId = decodeURIComponent(pageMatch[1]);
      const record = this.records.get(requestId);
      if (!record) {
        sendText(res, 404, "Request not found.");
        return;
      }
      this.updateTimeoutStatus(record);
      if (record.status !== "pending") {
        sendText(res, 409, `Request already ${record.status}.`);
        return;
      }
      const token = String(requestUrl.searchParams.get("token") ?? "");
      if (!token || hashToken(token) !== record.openTokenHash) {
        sendText(res, 403, "Invalid or expired token.");
        return;
      }
      sendHtml(res, 200, this.renderPortalPage(record, token));
      return;
    }

    sendText(res, 404, "Not found.");
  }
}
