import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { loadConfig, saveConfig } from "../config";
import { AdbRuntime } from "../device/adb-runtime";
import { EmulatorManager } from "../device/emulator-manager";
import type { OpenPocketConfig } from "../types";
import { nowIso, resolvePath } from "../utils/paths";
import {
  defaultControlSettings,
  loadControlSettings,
  loadOnboardingState,
  providerLabel,
  saveControlSettings,
  saveOnboardingState,
  type MenuBarControlSettings,
  type OnboardingStateFile,
} from "./control-store";

export interface DashboardGatewayStatus {
  running: boolean;
  managed: boolean;
  note: string;
}

export interface DashboardServerOptions {
  config: OpenPocketConfig;
  mode: "standalone" | "integrated";
  host?: string;
  port?: number;
  getGatewayStatus?: () => DashboardGatewayStatus;
  onLogLine?: (line: string) => void;
}

interface PreviewSnapshot {
  deviceId: string;
  currentApp: string;
  width: number;
  height: number;
  screenshotBase64: string;
  capturedAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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

function safeBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === false) {
    return value;
  }
  return fallback;
}

function sanitizeLogLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function nowHmss(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export class DashboardServer {
  private config: OpenPocketConfig;
  private readonly mode: "standalone" | "integrated";
  private readonly host: string;
  private readonly port: number;
  private readonly getGatewayStatusFn: (() => DashboardGatewayStatus) | null;
  private readonly onLogLine: ((line: string) => void) | null;

  private emulator: EmulatorManager;
  private adb: AdbRuntime;
  private server: http.Server | null = null;
  private previewCache: PreviewSnapshot | null = null;
  private readonly logs: string[] = [];

  constructor(options: DashboardServerOptions) {
    this.config = options.config;
    this.mode = options.mode;
    this.host = options.host?.trim() || options.config.dashboard.host;
    this.port = options.port ?? options.config.dashboard.port;
    this.getGatewayStatusFn = options.getGatewayStatus ?? null;
    this.onLogLine = options.onLogLine ?? null;

    this.emulator = new EmulatorManager(this.config);
    this.adb = new AdbRuntime(this.config, this.emulator);
  }

  get address(): string {
    if (!this.server) {
      return "";
    }
    const addr = this.server.address();
    if (!addr || typeof addr === "string") {
      return "";
    }
    const host = addr.address === "::" ? "127.0.0.1" : addr.address;
    return `http://${host}:${addr.port}`;
  }

  private log(line: string): void {
    const text = sanitizeLogLine(line);
    if (!text) {
      return;
    }
    const withPrefix = `[dashboard] ${nowHmss()} ${text}`;
    this.logs.push(withPrefix);
    if (this.logs.length > 2000) {
      this.logs.splice(0, this.logs.length - 2000);
    }
    this.onLogLine?.(withPrefix);
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
      this.server?.listen(this.port, this.host, () => {
        this.server?.removeListener("error", reject);
        resolve();
      });
    });

    this.log(`server started mode=${this.mode} addr=${this.address}`);
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
    this.log("server stopped");
  }

  listLogs(limit = 500): string[] {
    const n = Math.max(1, Math.min(5000, Math.round(limit)));
    if (this.logs.length <= n) {
      return [...this.logs];
    }
    return this.logs.slice(this.logs.length - n);
  }

  clearLogs(): void {
    this.logs.splice(0, this.logs.length);
  }

  private gatewayStatus(): DashboardGatewayStatus {
    if (this.getGatewayStatusFn) {
      try {
        return this.getGatewayStatusFn();
      } catch {
        return {
          running: false,
          managed: this.mode === "integrated",
          note: "gateway status callback failed",
        };
      }
    }
    return {
      running: this.mode === "integrated",
      managed: this.mode === "integrated",
      note:
        this.mode === "integrated"
          ? "managed by current gateway process"
          : "status unavailable in standalone mode",
    };
  }

  private runtimePayload(): Record<string, unknown> {
    const emulator = this.emulator.status();
    return {
      mode: this.mode,
      gateway: this.gatewayStatus(),
      emulator: {
        avdName: emulator.avdName,
        devices: emulator.devices,
        bootedDevices: emulator.bootedDevices,
        statusText:
          emulator.bootedDevices.length > 0
            ? `Running (${emulator.bootedDevices.join(", ")})`
            : emulator.devices.length > 0
              ? `Starting (${emulator.devices.join(", ")})`
              : "Stopped",
      },
      dashboard: {
        address: this.address,
      },
      config: {
        configPath: this.config.configPath,
        stateDir: this.config.stateDir,
        workspaceDir: this.config.workspaceDir,
        defaultModel: this.config.defaultModel,
        projectName: this.config.projectName,
      },
      preview: this.previewCache,
      now: nowIso(),
    };
  }

  private applyConfigPatch(input: unknown): OpenPocketConfig {
    if (!isObject(input)) {
      throw new Error("Invalid config patch payload.");
    }

    const next: OpenPocketConfig = {
      ...this.config,
      emulator: { ...this.config.emulator },
      agent: { ...this.config.agent },
      dashboard: { ...this.config.dashboard },
    };

    if (typeof input.projectName === "string" && input.projectName.trim()) {
      next.projectName = input.projectName.trim();
    }
    if (typeof input.workspaceDir === "string" && input.workspaceDir.trim()) {
      next.workspaceDir = resolvePath(input.workspaceDir.trim());
    }
    if (typeof input.stateDir === "string" && input.stateDir.trim()) {
      next.stateDir = resolvePath(input.stateDir.trim());
    }
    if (typeof input.defaultModel === "string" && input.defaultModel.trim()) {
      const candidate = input.defaultModel.trim();
      if (!next.models[candidate]) {
        throw new Error(`Unknown default model: ${candidate}`);
      }
      next.defaultModel = candidate;
    }

    if (isObject(input.emulator)) {
      if (typeof input.emulator.avdName === "string" && input.emulator.avdName.trim()) {
        next.emulator.avdName = input.emulator.avdName.trim();
      }
      if (
        typeof input.emulator.androidSdkRoot === "string" &&
        input.emulator.androidSdkRoot.trim()
      ) {
        next.emulator.androidSdkRoot = resolvePath(input.emulator.androidSdkRoot.trim());
      }
      if (typeof input.emulator.bootTimeoutSec === "number" && Number.isFinite(input.emulator.bootTimeoutSec)) {
        next.emulator.bootTimeoutSec = Math.max(20, Math.round(input.emulator.bootTimeoutSec));
      }
      if (typeof input.emulator.headless === "boolean") {
        next.emulator.headless = input.emulator.headless;
      }
    }

    if (isObject(input.agent)) {
      if (typeof input.agent.deviceId === "string" && input.agent.deviceId.trim()) {
        next.agent.deviceId = input.agent.deviceId.trim();
      } else if (input.agent.deviceId === null || input.agent.deviceId === "") {
        next.agent.deviceId = null;
      }
    }

    if (isObject(input.dashboard)) {
      if (typeof input.dashboard.host === "string" && input.dashboard.host.trim()) {
        next.dashboard.host = input.dashboard.host.trim();
      }
      if (typeof input.dashboard.port === "number" && Number.isFinite(input.dashboard.port)) {
        next.dashboard.port = Math.max(1, Math.min(65535, Math.round(input.dashboard.port)));
      }
      if (typeof input.dashboard.enabled === "boolean") {
        next.dashboard.enabled = input.dashboard.enabled;
      }
      if (typeof input.dashboard.autoOpenBrowser === "boolean") {
        next.dashboard.autoOpenBrowser = input.dashboard.autoOpenBrowser;
      }
    }

    saveConfig(next);
    this.config = loadConfig(this.config.configPath);
    this.emulator = new EmulatorManager(this.config);
    this.adb = new AdbRuntime(this.config, this.emulator);
    this.log("config patched and reloaded");
    return this.config;
  }

  private readScopedFiles(control: MenuBarControlSettings): string[] {
    const permission = control.permission;
    if (!permission.allowLocalStorageView) {
      return [];
    }

    const root = resolvePath(permission.storageDirectoryPath || this.config.workspaceDir);
    if (!fs.existsSync(root)) {
      return [];
    }

    const allowedSubpaths = permission.allowedSubpaths.length > 0 ? permission.allowedSubpaths : [""];
    const allowedPrefixes = allowedSubpaths
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => path.resolve(root, segment));
    if (allowedPrefixes.length === 0) {
      allowedPrefixes.push(root);
    }

    const allowedExt = new Set(permission.allowedExtensions.map((ext) => ext.toLowerCase()));
    const output: string[] = [];

    const stack = [root];
    while (stack.length > 0 && output.length < 2000) {
      const current = stack.pop() as string;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.name.startsWith(".")) {
          continue;
        }
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }

        const ext = path.extname(fullPath).replace(/^\./, "").toLowerCase();
        if (allowedExt.size > 0 && !allowedExt.has(ext)) {
          continue;
        }

        if (!allowedPrefixes.some((prefix) => fullPath.startsWith(prefix))) {
          continue;
        }

        output.push(fullPath);
        if (output.length >= 2000) {
          break;
        }
      }
    }

    output.sort((a, b) => a.localeCompare(b));
    return output;
  }

  private readScopedFile(control: MenuBarControlSettings, filePath: string): string {
    const permission = control.permission;
    if (!permission.allowLocalStorageView) {
      throw new Error("Local storage file view permission is disabled.");
    }
    const resolved = resolvePath(filePath);
    const root = resolvePath(permission.storageDirectoryPath || this.config.workspaceDir);
    if (!resolved.startsWith(root)) {
      throw new Error("Selected file is outside storage root.");
    }

    const allowedSubpaths = permission.allowedSubpaths.length > 0 ? permission.allowedSubpaths : [""];
    const allowedPrefixes = allowedSubpaths
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => path.resolve(root, segment));
    if (allowedPrefixes.length === 0) {
      allowedPrefixes.push(root);
    }

    if (!allowedPrefixes.some((prefix) => resolved.startsWith(prefix))) {
      throw new Error("Selected file is outside allowed scope.");
    }

    const stat = fs.statSync(resolved);
    if (stat.size > 2_000_000) {
      throw new Error(`File too large (${stat.size} bytes).`);
    }

    const content = fs.readFileSync(resolved);
    return content.toString("utf-8");
  }

  private applyOnboarding(input: unknown): { onboarding: OnboardingStateFile; config: OpenPocketConfig } {
    if (!isObject(input)) {
      throw new Error("Invalid onboarding payload.");
    }

    const consentAccepted = safeBoolean(input.consentAccepted, false);
    const selectedModelProfile = String(input.selectedModelProfile ?? "").trim();
    const useEnvKey = safeBoolean(input.useEnvKey, true);
    const rawApiKey = String(input.apiKey ?? "").trim();
    const gmailLoginDone = safeBoolean(input.gmailLoginDone, false);

    if (!consentAccepted) {
      throw new Error("Consent is required before onboarding can be saved.");
    }
    if (!selectedModelProfile || !this.config.models[selectedModelProfile]) {
      throw new Error("Selected model profile is invalid.");
    }

    const nextConfig: OpenPocketConfig = {
      ...this.config,
      models: { ...this.config.models },
      defaultModel: selectedModelProfile,
    };

    if (!useEnvKey) {
      if (!rawApiKey) {
        throw new Error("API key cannot be empty when not using env variable.");
      }
      const selected = nextConfig.models[selectedModelProfile];
      const providerHost = (() => {
        try {
          return new URL(selected.baseUrl).host.toLowerCase();
        } catch {
          return selected.baseUrl.toLowerCase();
        }
      })();

      for (const [modelName, profile] of Object.entries(nextConfig.models)) {
        const currentHost = (() => {
          try {
            return new URL(profile.baseUrl).host.toLowerCase();
          } catch {
            return profile.baseUrl.toLowerCase();
          }
        })();
        if (currentHost === providerHost || profile.apiKeyEnv === selected.apiKeyEnv) {
          nextConfig.models[modelName] = {
            ...profile,
            apiKey: rawApiKey,
            apiKeyEnv: selected.apiKeyEnv,
          };
        }
      }
    }

    saveConfig(nextConfig);
    this.config = loadConfig(this.config.configPath);
    this.emulator = new EmulatorManager(this.config);
    this.adb = new AdbRuntime(this.config, this.emulator);

    const now = nowIso();
    const onboarding: OnboardingStateFile = {
      ...loadOnboardingState(this.config),
      updatedAt: now,
      consentAcceptedAt: loadOnboardingState(this.config).consentAcceptedAt ?? now,
      modelProfile: selectedModelProfile,
      modelProvider: providerLabel(this.config.models[selectedModelProfile].baseUrl),
      modelConfiguredAt: now,
      apiKeyEnv: this.config.models[selectedModelProfile].apiKeyEnv,
      apiKeySource: useEnvKey ? "env" : "config",
      apiKeyConfiguredAt: now,
      gmailLoginConfirmedAt: gmailLoginDone ? now : null,
    };
    saveOnboardingState(this.config, onboarding);

    this.log(`onboarding applied model=${selectedModelProfile} source=${onboarding.apiKeySource}`);

    return {
      onboarding,
      config: this.config,
    };
  }

  private htmlShell(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenPocket Dashboard</title>
  <style>
    body { margin: 0; font-family: "SF Pro Text", "Segoe UI", Arial, sans-serif; background: #111827; color: #f8fafc; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 28px; }
    .card { background: #1f2937; border: 1px solid #334155; border-radius: 12px; padding: 16px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    code { background: #0f172a; color: #93c5fd; padding: 2px 6px; border-radius: 6px; }
    .muted { color: #9ca3af; }
    ul { line-height: 1.8; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>OpenPocket Local Dashboard (V1)</h1>
    <p class="muted">Backend API is online. Web UI tabs will be completed in V2/V3.</p>
    <div class="card">
      <p>Quick API checks:</p>
      <ul>
        <li><code>/api/health</code></li>
        <li><code>/api/runtime</code></li>
        <li><code>/api/emulator/status</code></li>
        <li><code>/api/emulator/preview</code></li>
        <li><code>/api/config</code></li>
        <li><code>/api/onboarding</code></li>
        <li><code>/api/control-settings</code></li>
      </ul>
    </div>
  </div>
</body>
</html>`;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = (req.method ?? "GET").toUpperCase();
    const url = new URL(req.url ?? "/", `http://${req.headers.host || "127.0.0.1"}`);

    try {
      if (method === "GET" && url.pathname === "/") {
        sendHtml(res, 200, this.htmlShell());
        return;
      }

      if (method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, {
          ok: true,
          mode: this.mode,
          address: this.address,
          now: nowIso(),
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/runtime") {
        sendJson(res, 200, this.runtimePayload());
        return;
      }

      if (method === "GET" && url.pathname === "/api/logs") {
        const limitRaw = Number(url.searchParams.get("limit") ?? "200");
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, Math.round(limitRaw))) : 200;
        sendJson(res, 200, {
          lines: this.listLogs(limit),
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/logs/clear") {
        this.clearLogs();
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "GET" && url.pathname === "/api/config") {
        sendJson(res, 200, {
          config: this.config,
          modelProfiles: Object.keys(this.config.models).sort(),
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/config") {
        const body = await readJsonBody(req);
        const updated = this.applyConfigPatch(body);
        sendJson(res, 200, {
          ok: true,
          config: updated,
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/onboarding") {
        sendJson(res, 200, {
          onboarding: loadOnboardingState(this.config),
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/onboarding") {
        const body = await readJsonBody(req);
        if (!isObject(body)) {
          throw new Error("Invalid onboarding state payload.");
        }
        const merged: OnboardingStateFile = {
          ...loadOnboardingState(this.config),
          ...body,
          updatedAt: nowIso(),
        };
        saveOnboardingState(this.config, merged);
        sendJson(res, 200, {
          ok: true,
          onboarding: merged,
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/onboarding/apply") {
        const body = await readJsonBody(req);
        const applied = this.applyOnboarding(body);
        sendJson(res, 200, {
          ok: true,
          onboarding: applied.onboarding,
          config: applied.config,
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/control-settings") {
        const current = loadControlSettings(this.config);
        sendJson(res, 200, {
          controlSettings: current,
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/control-settings") {
        const body = await readJsonBody(req);
        if (!isObject(body)) {
          throw new Error("Invalid control settings payload.");
        }
        const merged: MenuBarControlSettings = {
          ...defaultControlSettings(this.config),
          ...loadControlSettings(this.config),
          ...body,
          updatedAt: nowIso(),
        };
        saveControlSettings(this.config, merged);
        sendJson(res, 200, {
          ok: true,
          controlSettings: merged,
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/permissions/files") {
        const control = loadControlSettings(this.config);
        sendJson(res, 200, {
          files: this.readScopedFiles(control),
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/permissions/read-file") {
        const body = await readJsonBody(req);
        if (!isObject(body)) {
          throw new Error("Invalid read-file payload.");
        }
        const filePath = String(body.path ?? "").trim();
        if (!filePath) {
          throw new Error("Missing file path.");
        }
        const control = loadControlSettings(this.config);
        const content = this.readScopedFile(control, filePath);
        sendJson(res, 200, {
          path: filePath,
          content,
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/emulator/status") {
        const status = this.emulator.status();
        sendJson(res, 200, {
          status,
          statusText:
            status.bootedDevices.length > 0
              ? `Running (${status.bootedDevices.join(", ")})`
              : status.devices.length > 0
                ? `Starting (${status.devices.join(", ")})`
                : "Stopped",
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/emulator/start") {
        const message = await this.emulator.start(true);
        this.log(`emulator start ${message}`);
        sendJson(res, 200, { ok: true, message });
        return;
      }

      if (method === "POST" && url.pathname === "/api/emulator/stop") {
        const message = this.emulator.stop();
        this.log(`emulator stop ${message}`);
        sendJson(res, 200, { ok: true, message });
        return;
      }

      if (method === "POST" && url.pathname === "/api/emulator/show") {
        const message = this.emulator.showWindow();
        this.log(`emulator show ${message}`);
        sendJson(res, 200, { ok: true, message });
        return;
      }

      if (method === "POST" && url.pathname === "/api/emulator/hide") {
        const message = this.emulator.hideWindow();
        this.log(`emulator hide ${message}`);
        sendJson(res, 200, { ok: true, message });
        return;
      }

      if (method === "GET" && url.pathname === "/api/emulator/preview") {
        const snapshot = this.adb.captureScreenSnapshot(this.config.agent.deviceId);
        this.previewCache = snapshot;
        sendJson(res, 200, snapshot);
        return;
      }

      if (method === "POST" && url.pathname === "/api/emulator/tap") {
        const body = await readJsonBody(req);
        if (!isObject(body)) {
          throw new Error("Invalid tap payload.");
        }
        const x = Number(body.x);
        const y = Number(body.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new Error("Tap coordinates must be numbers.");
        }
        const message = this.emulator.tap(Math.round(x), Math.round(y), this.config.agent.deviceId ?? undefined);
        this.log(`emulator tap x=${Math.round(x)} y=${Math.round(y)}`);
        sendJson(res, 200, { ok: true, message });
        return;
      }

      if (method === "POST" && url.pathname === "/api/emulator/type") {
        const body = await readJsonBody(req);
        if (!isObject(body)) {
          throw new Error("Invalid text payload.");
        }
        const text = String(body.text ?? "");
        if (!text.trim()) {
          throw new Error("Text input is empty.");
        }
        const message = this.emulator.typeText(text, this.config.agent.deviceId ?? undefined);
        this.log(`emulator type length=${text.length}`);
        sendJson(res, 200, { ok: true, message });
        return;
      }

      sendText(res, 404, "Not found");
    } catch (error) {
      const message = (error as Error).message || "Unknown error";
      this.log(`request failed method=${method} path=${url.pathname} error=${message}`);
      sendJson(res, 400, {
        ok: false,
        error: message,
      });
    }
  }
}
