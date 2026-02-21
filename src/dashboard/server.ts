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

  private credentialStatusMap(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [profileName, profile] of Object.entries(this.config.models)) {
      const configKey = profile.apiKey.trim();
      const envName = profile.apiKeyEnv;
      const envValue = (process.env[envName] ?? "").trim();

      if (configKey) {
        if (!envValue) {
          result[profileName] = `Credential source: config.json (detected, length ${configKey.length}). ${envName} is optional.`;
        } else {
          result[profileName] = `Credential source: config.json (detected, length ${configKey.length}). ${envName} also detected (length ${envValue.length}).`;
        }
        continue;
      }

      if (envValue) {
        result[profileName] = `Credential source: ${envName} env var (detected, length ${envValue.length}).`;
      } else {
        result[profileName] = `No API key found in config.json or ${envName}.`;
      }
    }
    return result;
  }

  private htmlShell(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenPocket Dashboard</title>
  <style>
    :root {
      --bg-0: #f6f2eb;
      --bg-1: #eef6ff;
      --ink-0: #111827;
      --ink-1: #3a4352;
      --brand: #0b8f6a;
      --brand-soft: #d7f5ea;
      --danger: #a92929;
      --card: rgba(255, 255, 255, 0.92);
      --line: #d7dee8;
      --shadow: 0 14px 40px rgba(15, 35, 60, 0.12);
      --mono: "SF Mono", "Menlo", "Consolas", monospace;
      --sans: "Avenir Next", "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--sans);
      color: var(--ink-0);
      background:
        radial-gradient(1200px 400px at 15% -5%, #f9e1c8 0%, transparent 55%),
        radial-gradient(900px 420px at 100% -10%, #cae8ff 0%, transparent 60%),
        linear-gradient(160deg, var(--bg-0), var(--bg-1));
    }
    .layout {
      max-width: 1280px;
      margin: 0 auto;
      padding: 20px 22px 30px;
      display: grid;
      gap: 14px;
    }
    .topbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: space-between;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: var(--shadow);
      padding: 14px 16px;
    }
    .title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .title h1 {
      margin: 0;
      font-size: 29px;
      letter-spacing: 0.2px;
    }
    .subtitle {
      margin: 0;
      color: var(--ink-1);
      font-size: 13px;
    }
    .badge-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .badge {
      border-radius: 999px;
      padding: 7px 11px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid var(--line);
      background: #fff;
      color: #2b3340;
    }
    .badge.ok {
      background: var(--brand-soft);
      color: #0f6f52;
      border-color: #bde7d7;
    }
    .tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tab-btn {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
      color: #1f2b3d;
      padding: 9px 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease;
    }
    .tab-btn:hover {
      transform: translateY(-1px);
      background: #f4f8fc;
    }
    .tab-btn.active {
      background: #e7f6ef;
      border-color: #b9e9d6;
      color: #0e6f51;
    }
    .status-line {
      font-size: 13px;
      color: var(--ink-1);
      padding: 0 3px;
      min-height: 20px;
    }
    .tab-panel {
      display: none;
      animation: rise 180ms ease-out;
    }
    .tab-panel.active {
      display: block;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .grid {
      display: grid;
      gap: 12px;
    }
    .grid.cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: var(--shadow);
      padding: 14px;
    }
    .card h3 {
      margin: 0 0 10px;
      font-size: 18px;
    }
    .hint {
      color: var(--ink-1);
      font-size: 13px;
      margin-top: 3px;
      margin-bottom: 10px;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .row.spread {
      justify-content: space-between;
    }
    .btn {
      border: 1px solid #bfd3e2;
      background: #fff;
      color: #172234;
      border-radius: 9px;
      cursor: pointer;
      font-weight: 700;
      padding: 8px 12px;
    }
    .btn.primary {
      border-color: #0f906a;
      background: #0f906a;
      color: #fff;
    }
    .btn.warn {
      border-color: #b73f3f;
      background: #b73f3f;
      color: #fff;
    }
    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    input[type="text"], input[type="password"], select, textarea {
      width: 100%;
      border: 1px solid #c7d4e2;
      border-radius: 9px;
      background: #fff;
      padding: 8px 10px;
      color: #122133;
      font-size: 14px;
      font-family: inherit;
    }
    textarea {
      min-height: 96px;
      resize: vertical;
    }
    .kv {
      font-size: 13px;
      color: var(--ink-1);
      margin-top: 8px;
      line-height: 1.5;
    }
    .kv code {
      font-family: var(--mono);
      font-size: 12px;
      color: #14365a;
      background: #edf4fb;
      border-radius: 6px;
      padding: 2px 5px;
    }
    .preview-wrap {
      position: relative;
      background: #0b1118;
      border-radius: 12px;
      min-height: 270px;
      overflow: hidden;
      border: 1px solid #0d1723;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #preview-image {
      max-width: 100%;
      max-height: 420px;
      display: none;
      cursor: crosshair;
      image-rendering: auto;
    }
    .preview-empty {
      color: #dbe7f4;
      font-size: 13px;
      text-align: center;
      padding: 14px;
    }
    .mono {
      font-family: var(--mono);
      font-size: 12px;
    }
    .placeholder {
      color: var(--ink-1);
      font-size: 14px;
      line-height: 1.7;
    }
    @media (max-width: 980px) {
      .grid.cols-2 {
        grid-template-columns: 1fr;
      }
      .layout {
        padding: 12px;
      }
      .title h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="layout">
    <header class="topbar">
      <div class="title">
        <h1>OpenPocket</h1>
        <p class="subtitle">Local Android agent control dashboard (Web)</p>
      </div>
      <div class="badge-row">
        <span class="badge" id="gateway-badge">Gateway: Unknown</span>
        <span class="badge" id="emulator-badge">Emulator: Unknown</span>
      </div>
    </header>

    <div class="tabs">
      <button class="tab-btn active" data-tab="runtime">Runtime</button>
      <button class="tab-btn" data-tab="onboarding">Onboarding</button>
      <button class="tab-btn" data-tab="permissions">Permissions</button>
      <button class="tab-btn" data-tab="prompts">Agent Prompts</button>
      <button class="tab-btn" data-tab="logs">Logs</button>
    </div>

    <div class="status-line" id="status-line"></div>

    <section class="tab-panel active" data-panel="runtime">
      <div class="grid cols-2">
        <div class="card">
          <h3>Gateway</h3>
          <p class="hint">Gateway is managed by CLI in integrated mode. Runtime status refreshes automatically.</p>
          <div class="row">
            <button class="btn" id="runtime-refresh-btn">Refresh Runtime</button>
          </div>
          <div class="kv" id="gateway-kv"></div>
        </div>

        <div class="card">
          <h3>Android Emulator</h3>
          <p class="hint">Control emulator lifecycle and visibility while tasks continue in background.</p>
          <div class="row">
            <button class="btn primary" data-emu-action="start">Start</button>
            <button class="btn warn" data-emu-action="stop">Stop</button>
            <button class="btn" data-emu-action="show">Show</button>
            <button class="btn" data-emu-action="hide">Hide</button>
            <button class="btn" id="emu-refresh-btn">Refresh Status</button>
          </div>
          <div class="kv" id="emulator-kv"></div>
        </div>
      </div>

      <div class="card">
        <h3>Emulator Screen Preview</h3>
        <div class="row">
          <button class="btn" id="preview-refresh-btn">Refresh Preview</button>
          <label class="row">
            <input type="checkbox" id="preview-auto" />
            <span>Auto refresh (2s)</span>
          </label>
          <span class="kv" id="preview-meta"></span>
        </div>
        <div class="row" style="margin-top:10px;">
          <input type="text" id="emulator-text-input" placeholder="Type text to active input field" />
          <button class="btn" id="emulator-text-send">Send Text</button>
        </div>
        <div class="preview-wrap" style="margin-top:10px;">
          <img id="preview-image" alt="Emulator preview" />
          <div class="preview-empty" id="preview-empty">Preview unavailable. Start emulator and click Refresh Preview.</div>
        </div>
        <div class="hint">Click on preview image to send tap. Coordinates are mapped to device pixels.</div>
      </div>

      <div class="card">
        <h3>Core Paths</h3>
        <div class="grid cols-2">
          <div>
            <label for="workspace-input">Workspace</label>
            <input type="text" id="workspace-input" />
          </div>
          <div>
            <label for="state-input">State</label>
            <input type="text" id="state-input" />
          </div>
        </div>
        <div class="row" style="margin-top:10px;">
          <button class="btn primary" id="save-core-paths-btn">Save Config</button>
        </div>
      </div>
    </section>

    <section class="tab-panel" data-panel="onboarding">
      <div class="grid cols-2">
        <div class="card">
          <h3>User Consent</h3>
          <p class="hint">Emulator artifacts are stored locally. Cloud model providers may receive task text/screenshots.</p>
          <label class="row">
            <input type="checkbox" id="onboard-consent" />
            <span>I accept local automation and data handling terms.</span>
          </label>
        </div>
        <div class="card">
          <h3>Play Store Login</h3>
          <p class="hint">Manually complete Gmail sign-in in emulator when needed.</p>
          <label class="row">
            <input type="checkbox" id="onboard-gmail-done" />
            <span>I finished Gmail sign-in and verified Play Store access.</span>
          </label>
          <div class="row" style="margin-top:10px;">
            <button class="btn" id="onboard-start-emu">Start Emulator</button>
            <button class="btn" id="onboard-show-emu">Show Emulator</button>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Model Selection</h3>
        <div class="row">
          <div style="min-width:320px;flex:1;">
            <label for="onboard-model-select">Default Model</label>
            <select id="onboard-model-select"></select>
          </div>
        </div>
        <div class="kv" id="onboard-model-meta"></div>
      </div>

      <div class="card">
        <h3>API Key Setup</h3>
        <label class="row">
          <input type="checkbox" id="onboard-use-env" checked />
          <span>Use environment variable for API key</span>
        </label>
        <div style="margin-top:10px;" id="onboard-api-key-wrap">
          <input type="password" id="onboard-api-key" placeholder="Paste API key when not using env variable" />
        </div>
      </div>

      <div class="card">
        <div class="row spread">
          <h3 style="margin:0;">Save Onboarding</h3>
          <button class="btn primary" id="onboard-save-btn">Save Onboarding to Config + State</button>
        </div>
      </div>
    </section>

    <section class="tab-panel" data-panel="permissions">
      <div class="card placeholder">
        Permissions tab UI will be completed in V3. Backend APIs are ready: <span class="mono">/api/control-settings</span>, <span class="mono">/api/permissions/files</span>, <span class="mono">/api/permissions/read-file</span>.
      </div>
    </section>

    <section class="tab-panel" data-panel="prompts">
      <div class="card placeholder">
        Agent Prompts tab UI will be completed in V3. Prompt files are already persisted via <span class="mono">control-panel.json</span>.
      </div>
    </section>

    <section class="tab-panel" data-panel="logs">
      <div class="card placeholder">
        Logs tab UI will be completed in V3. Current backend log endpoint: <span class="mono">/api/logs</span>.
      </div>
    </section>
  </div>
  <script>
    const state = {
      runtime: null,
      config: null,
      onboarding: null,
      preview: null,
      previewTimer: null,
      runtimeTimer: null,
      credentialStatus: {},
    };

    const $ = (selector) => document.querySelector(selector);

    function setStatus(text, tone = "normal") {
      const el = $("#status-line");
      el.textContent = text || "";
      if (tone === "error") {
        el.style.color = "#a92929";
      } else if (tone === "ok") {
        el.style.color = "#0f7c5a";
      } else {
        el.style.color = "";
      }
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        headers: {
          "content-type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || response.statusText || "Request failed");
      }
      return payload;
    }

    function activateTab(tab) {
      document.querySelectorAll(".tab-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === tab);
      });
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === tab);
      });
    }

    function updateBadges(runtime) {
      const gatewayBadge = $("#gateway-badge");
      const emulatorBadge = $("#emulator-badge");
      const gatewayRunning = Boolean(runtime?.gateway?.running);
      const emulatorRunning = (runtime?.emulator?.bootedDevices || []).length > 0;

      gatewayBadge.textContent = "Gateway: " + (gatewayRunning ? "Running" : "Stopped/Unknown");
      gatewayBadge.classList.toggle("ok", gatewayRunning);

      emulatorBadge.textContent = "Emulator: " + (runtime?.emulator?.statusText || "Unknown");
      emulatorBadge.classList.toggle("ok", emulatorRunning);
    }

    function renderRuntime(runtime) {
      updateBadges(runtime);
      $("#gateway-kv").innerHTML =
        "<div>Mode: <code>" + (runtime.mode || "unknown") + "</code></div>" +
        "<div>Gateway note: " + (runtime.gateway?.note || "n/a") + "</div>" +
        "<div>Dashboard: <code>" + (runtime.dashboard?.address || location.origin) + "</code></div>";

      $("#emulator-kv").innerHTML =
        "<div>AVD: <code>" + (runtime.emulator?.avdName || "unknown") + "</code></div>" +
        "<div>Devices: " + ((runtime.emulator?.devices || []).join(", ") || "(none)") + "</div>" +
        "<div>Booted: " + ((runtime.emulator?.bootedDevices || []).join(", ") || "(none)") + "</div>";

      if (!$("#workspace-input").value) {
        $("#workspace-input").value = runtime.config?.workspaceDir || "";
      }
      if (!$("#state-input").value) {
        $("#state-input").value = runtime.config?.stateDir || "";
      }
    }

    async function loadRuntime() {
      const payload = await api("/api/runtime");
      state.runtime = payload;
      renderRuntime(payload);
      return payload;
    }

    async function loadConfigAndOnboarding() {
      const [configPayload, onboardingPayload] = await Promise.all([
        api("/api/config"),
        api("/api/onboarding"),
      ]);
      state.config = configPayload.config;
      state.credentialStatus = configPayload.credentialStatus || {};
      state.onboarding = onboardingPayload.onboarding || {};
      renderOnboarding();
    }

    function renderOnboarding() {
      const config = state.config;
      const onboarding = state.onboarding || {};
      if (!config) {
        return;
      }

      const select = $("#onboard-model-select");
      const current = onboarding.modelProfile || config.defaultModel;
      select.innerHTML = "";
      Object.keys(config.models || {}).sort().forEach((key) => {
        const profile = config.models[key];
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key + " (" + (profile.providerLabel || profile.baseUrl || "provider") + ")";
        if (key === current) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      $("#onboard-consent").checked = Boolean(onboarding.consentAcceptedAt);
      $("#onboard-gmail-done").checked = Boolean(onboarding.gmailLoginConfirmedAt);
      $("#onboard-use-env").checked = (onboarding.apiKeySource || "env") !== "config";
      $("#onboard-api-key-wrap").style.display = $("#onboard-use-env").checked ? "none" : "block";

      const selected = select.value || config.defaultModel;
      const profile = config.models[selected];
      const provider = profile?.baseUrl ? profile.baseUrl : "unknown";
      const envName = profile?.apiKeyEnv || "N/A";
      const modelId = profile?.model || "unknown";
      const status = state.credentialStatus[selected] || "";

      $("#onboard-model-meta").innerHTML =
        "<div>Model ID: <code>" + modelId + "</code></div>" +
        "<div>Provider: <code>" + provider + "</code></div>" +
        "<div>Provider API env: <code>" + envName + "</code></div>" +
        "<div>" + status + "</div>";
    }

    async function refreshPreview() {
      setStatus("Refreshing emulator preview...");
      const preview = await api("/api/emulator/preview");
      state.preview = preview;
      const image = $("#preview-image");
      image.src = "data:image/png;base64," + preview.screenshotBase64;
      image.dataset.pixelWidth = String(preview.width || 0);
      image.dataset.pixelHeight = String(preview.height || 0);
      image.style.display = "block";
      $("#preview-empty").style.display = "none";
      $("#preview-meta").textContent =
        "App: " + (preview.currentApp || "unknown") +
        " | " + (preview.width || "?") + "x" + (preview.height || "?") +
        " | Updated: " + new Date(preview.capturedAt || Date.now()).toLocaleTimeString();
      setStatus("Preview updated.", "ok");
    }

    async function emulatorAction(action) {
      const payload = await api("/api/emulator/" + action, { method: "POST", body: "{}" });
      setStatus(payload.message || ("Emulator " + action + " done."), "ok");
      await loadRuntime();
    }

    async function sendTextInput() {
      const text = $("#emulator-text-input").value || "";
      if (!text.trim()) {
        setStatus("Input text is empty.", "error");
        return;
      }
      const payload = await api("/api/emulator/type", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setStatus(payload.message || "Text input sent.", "ok");
      await refreshPreview().catch(() => {});
    }

    async function saveCorePaths() {
      const workspaceDir = $("#workspace-input").value.trim();
      const stateDir = $("#state-input").value.trim();
      const payload = await api("/api/config", {
        method: "POST",
        body: JSON.stringify({ workspaceDir, stateDir }),
      });
      state.config = payload.config;
      setStatus("Config saved.", "ok");
      await loadRuntime();
      await loadConfigAndOnboarding();
    }

    async function saveOnboarding() {
      const selectedModelProfile = $("#onboard-model-select").value;
      const consentAccepted = $("#onboard-consent").checked;
      const gmailLoginDone = $("#onboard-gmail-done").checked;
      const useEnvKey = $("#onboard-use-env").checked;
      const apiKey = $("#onboard-api-key").value;

      await api("/api/onboarding/apply", {
        method: "POST",
        body: JSON.stringify({
          selectedModelProfile,
          consentAccepted,
          gmailLoginDone,
          useEnvKey,
          apiKey,
        }),
      });
      setStatus("Onboarding saved to config + state.", "ok");
      await loadConfigAndOnboarding();
      await loadRuntime();
    }

    async function sendPreviewTap(event) {
      const image = $("#preview-image");
      const width = Number(image.dataset.pixelWidth || "0");
      const height = Number(image.dataset.pixelHeight || "0");
      if (!width || !height) {
        return;
      }
      const rect = image.getBoundingClientRect();
      const localX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const localY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const targetX = Math.round((localX / rect.width) * width);
      const targetY = Math.round((localY / rect.height) * height);

      await api("/api/emulator/tap", {
        method: "POST",
        body: JSON.stringify({ x: targetX, y: targetY }),
      });
      setStatus("Tap sent at (" + targetX + ", " + targetY + ").", "ok");
      await refreshPreview().catch(() => {});
    }

    function bindEvents() {
      document.querySelectorAll(".tab-btn").forEach((button) => {
        button.addEventListener("click", () => activateTab(button.dataset.tab));
      });

      $("#runtime-refresh-btn").addEventListener("click", () => {
        loadRuntime().then(() => setStatus("Runtime refreshed.", "ok")).catch((error) => setStatus(error.message, "error"));
      });

      $("#emu-refresh-btn").addEventListener("click", () => {
        loadRuntime().then(() => setStatus("Emulator status refreshed.", "ok")).catch((error) => setStatus(error.message, "error"));
      });

      document.querySelectorAll("[data-emu-action]").forEach((button) => {
        button.addEventListener("click", () => {
          emulatorAction(button.dataset.emuAction).catch((error) => setStatus(error.message, "error"));
        });
      });

      $("#preview-refresh-btn").addEventListener("click", () => {
        refreshPreview().catch((error) => setStatus(error.message, "error"));
      });

      $("#preview-auto").addEventListener("change", (event) => {
        const enabled = event.target.checked;
        if (state.previewTimer) {
          clearInterval(state.previewTimer);
          state.previewTimer = null;
        }
        if (enabled) {
          state.previewTimer = setInterval(() => {
            refreshPreview().catch(() => {});
          }, 2000);
        }
      });

      $("#emulator-text-send").addEventListener("click", () => {
        sendTextInput().catch((error) => setStatus(error.message, "error"));
      });

      $("#save-core-paths-btn").addEventListener("click", () => {
        saveCorePaths().catch((error) => setStatus(error.message, "error"));
      });

      $("#onboard-use-env").addEventListener("change", (event) => {
        $("#onboard-api-key-wrap").style.display = event.target.checked ? "none" : "block";
      });

      $("#onboard-model-select").addEventListener("change", () => {
        renderOnboarding();
      });

      $("#onboard-save-btn").addEventListener("click", () => {
        saveOnboarding().catch((error) => setStatus(error.message, "error"));
      });

      $("#onboard-start-emu").addEventListener("click", () => {
        emulatorAction("start").catch((error) => setStatus(error.message, "error"));
      });

      $("#onboard-show-emu").addEventListener("click", () => {
        emulatorAction("show").catch((error) => setStatus(error.message, "error"));
      });

      $("#preview-image").addEventListener("click", (event) => {
        sendPreviewTap(event).catch((error) => setStatus(error.message, "error"));
      });
    }

    async function init() {
      bindEvents();
      try {
        await loadRuntime();
        await loadConfigAndOnboarding();
        setStatus("Dashboard ready.", "ok");
      } catch (error) {
        setStatus(error.message || "Initialization failed", "error");
      }
      state.runtimeTimer = setInterval(() => {
        loadRuntime().catch(() => {});
      }, 3000);
    }

    init();
  </script>
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
          credentialStatus: this.credentialStatusMap(),
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
