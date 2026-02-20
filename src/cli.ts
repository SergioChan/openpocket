#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as readline from "node:readline";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { AgentRuntime } from "./agent/agent-runtime";
import { loadConfig, saveConfig } from "./config";
import { EmulatorManager } from "./device/emulator-manager";
import { TelegramGateway } from "./gateway/telegram-gateway";
import { runGatewayLoop } from "./gateway/run-loop";
import { HumanAuthRelayServer } from "./human-auth/relay-server";
import { SkillLoader } from "./skills/skill-loader";
import { ScriptExecutor } from "./tools/script-executor";
import { runSetupWizard } from "./onboarding/setup-wizard";
import { installCliShortcut } from "./install/cli-shortcut";
import { ensureAndroidPrerequisites } from "./environment/android-prerequisites";

const DEFAULT_PANEL_RELEASE_URL = "https://github.com/SergioChan/openpocket/releases/latest";

type GithubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`OpenPocket CLI (Node.js + TypeScript)\n
Usage:
  openpocket [--config <path>] install-cli
  openpocket [--config <path>] onboard
  openpocket [--config <path>] config-show
  openpocket [--config <path>] emulator status
  openpocket [--config <path>] emulator start
  openpocket [--config <path>] emulator stop
  openpocket [--config <path>] emulator hide
  openpocket [--config <path>] emulator show
  openpocket [--config <path>] emulator list-avds
  openpocket [--config <path>] emulator screenshot [--out <path>]
  openpocket [--config <path>] emulator tap --x <int> --y <int> [--device <id>]
  openpocket [--config <path>] emulator type --text <text> [--device <id>]
  openpocket [--config <path>] agent [--model <name>] <task>
  openpocket [--config <path>] skills list
  openpocket [--config <path>] script run [--file <path> | --text <script>] [--timeout <sec>]
  openpocket [--config <path>] telegram setup
  openpocket [--config <path>] gateway [start|telegram]
  openpocket [--config <path>] human-auth-relay start [--host <host>] [--port <port>] [--public-base-url <url>] [--api-key <key>] [--state-file <path>]
  openpocket panel start

Legacy aliases (deprecated):
  openpocket [--config <path>] init
  openpocket [--config <path>] setup

Examples:
  openpocket onboard
  openpocket emulator start
  openpocket emulator tap --x 120 --y 300
  openpocket agent --model gpt-5.2-codex "Open Chrome and search weather"
  openpocket skills list
  openpocket script run --text "echo hello"
  openpocket telegram setup
  openpocket gateway start
  openpocket human-auth-relay start --port 8787
  openpocket panel start
`);
}

function getPanelReleaseUrl(): string {
  const fromEnv = process.env.OPENPOCKET_PANEL_RELEASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const packageJsonPath = path.resolve(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
      homepage?: string;
      repository?: string | { url?: string };
    };
    if (pkg.homepage?.trim()) {
      return pkg.homepage.includes("/releases")
        ? pkg.homepage
        : `${pkg.homepage.replace(/\/$/, "")}/releases/latest`;
    }
    const repoUrlRaw =
      typeof pkg.repository === "string"
        ? pkg.repository
        : pkg.repository?.url;
    const repoUrl = repoUrlRaw?.replace(/^git\+/, "").replace(/\.git$/, "");
    if (repoUrl?.includes("github.com")) {
      const normalized = repoUrl.replace(/^git@github.com:/, "https://github.com/");
      return `${normalized.replace(/\/$/, "")}/releases/latest`;
    }
  } catch {
    // ignore and fallback
  }

  return DEFAULT_PANEL_RELEASE_URL;
}

function resolveInstalledPanelApp(): string | null {
  const home = process.env.HOME ?? "";
  const candidates = [
    "/Applications/OpenPocket Control Panel.app",
    path.join(home, "Applications", "OpenPocket Control Panel.app"),
    "/Applications/OpenPocketMenuBar.app",
    path.join(home, "Applications", "OpenPocketMenuBar.app"),
  ].filter(Boolean);

  for (const appPath of candidates) {
    if (fs.existsSync(appPath)) {
      return appPath;
    }
  }
  return null;
}

function installedPanelExecutable(appPath: string): string | null {
  const names = ["OpenPocketMenuBar", "OpenPocket Control Panel"];
  for (const name of names) {
    const candidate = path.join(appPath, "Contents", "MacOS", name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function panelProcessRunning(executablePath: string): boolean {
  const probe = spawnSync("/usr/bin/pgrep", ["-f", executablePath], { stdio: "ignore" });
  return (probe.status ?? 1) === 0;
}

function openPanelApp(appPath: string, launchArgs: string[] = []): boolean {
  const executable = installedPanelExecutable(appPath);
  if (executable && panelProcessRunning(executable)) {
    return true;
  }

  const openArgs = [appPath];
  if (launchArgs.length > 0) {
    openArgs.push("--args", ...launchArgs);
  }
  const result = spawnSync("/usr/bin/open", openArgs, { stdio: "ignore" });
  return (result.status ?? 1) === 0;
}

function openReleasePage(url: string): void {
  spawnSync("/usr/bin/open", [url], { stdio: "ignore" });
}

function parseGithubRepoFromReleaseUrl(releaseUrl: string): { owner: string; repo: string } | null {
  const match = releaseUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!match?.[1] || !match?.[2]) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/i, ""),
  };
}

function fetchLatestGithubReleaseAssets(releaseUrl: string): GithubReleaseAsset[] {
  const parsed = parseGithubRepoFromReleaseUrl(releaseUrl);
  if (!parsed) {
    throw new Error(`Cannot parse GitHub repo from URL: ${releaseUrl}`);
  }

  const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases/latest`;
  const response = spawnSync(
    "/usr/bin/curl",
    [
      "-fsSL",
      "-H",
      "Accept: application/vnd.github+json",
      "-H",
      "User-Agent: openpocket-cli",
      apiUrl,
    ],
    { encoding: "utf-8" },
  );
  if ((response.status ?? 1) !== 0) {
    throw new Error(`Failed to query GitHub releases API: ${response.stderr || "curl exited with error"}`);
  }

  const parsedJson = JSON.parse(response.stdout) as { assets?: unknown };
  if (!Array.isArray(parsedJson.assets)) {
    return [];
  }

  return parsedJson.assets
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const item = entry as { name?: unknown; browser_download_url?: unknown };
      const name = typeof item.name === "string" ? item.name : "";
      const browserDownloadUrl =
        typeof item.browser_download_url === "string" ? item.browser_download_url : "";
      if (!name || !browserDownloadUrl) {
        return null;
      }
      return {
        name,
        browser_download_url: browserDownloadUrl,
      } satisfies GithubReleaseAsset;
    })
    .filter((asset): asset is GithubReleaseAsset => Boolean(asset));
}

function pickPanelReleaseAsset(assets: GithubReleaseAsset[]): GithubReleaseAsset | null {
  const scored = assets
    .filter((asset) => asset.name.toLowerCase().endsWith(".zip"))
    .map((asset) => {
      const lower = asset.name.toLowerCase();
      let score = 0;
      if (lower.includes("panel") || lower.includes("menubar")) {
        score += 8;
      }
      if (lower.includes("mac") || lower.includes("darwin") || lower.includes("osx")) {
        score += 5;
      }
      if (lower.includes("control")) {
        score += 2;
      }
      if (lower.includes("linux") || lower.includes("windows") || lower.includes("win")) {
        score -= 10;
      }
      return {
        asset,
        score,
        hasPanelName: lower.includes("panel") || lower.includes("menubar"),
        hasMacHint: lower.includes("mac") || lower.includes("darwin") || lower.includes("osx"),
      };
    })
    .filter((item) => item.hasPanelName && item.hasMacHint)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.asset ?? null;
}

function findAppBundle(rootDir: string): string | null {
  if (!fs.existsSync(rootDir)) {
    return null;
  }
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const absolute = path.join(current, entry.name);
      if (entry.name.endsWith(".app")) {
        return absolute;
      }
      stack.push(absolute);
    }
  }
  return null;
}

function installPanelFromRelease(
  releaseUrl: string,
  log?: (line: string) => void,
): string {
  if (process.platform !== "darwin") {
    throw new Error("Panel auto-install is supported on macOS only.");
  }

  log?.("1/4 Pull panel package from GitHub release");
  const assets = fetchLatestGithubReleaseAssets(releaseUrl);
  const picked = pickPanelReleaseAsset(assets);
  if (!picked) {
    throw new Error("No macOS .zip panel asset found in latest release.");
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpocket-panel-install-"));
  try {
    const zipPath = path.join(tmpDir, picked.name);
    const download = spawnSync("/usr/bin/curl", ["-fL", picked.browser_download_url, "-o", zipPath], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    if ((download.status ?? 1) !== 0) {
      throw new Error(`Failed to download ${picked.name}: ${download.stderr || "curl exited with error"}`);
    }

    log?.("2/4 Unpack panel ZIP");
    const unpackDir = path.join(tmpDir, "unpacked");
    fs.mkdirSync(unpackDir, { recursive: true });
    const unpack = spawnSync("/usr/bin/ditto", ["-x", "-k", zipPath, unpackDir], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    if ((unpack.status ?? 1) !== 0) {
      throw new Error(`Failed to unpack ${picked.name}: ${unpack.stderr || "ditto exited with error"}`);
    }

    const appBundle = findAppBundle(unpackDir);
    if (!appBundle) {
      throw new Error(`No .app bundle found in ${picked.name}`);
    }

    const home = process.env.HOME?.trim();
    if (!home) {
      throw new Error("HOME is not set; cannot install panel app.");
    }
    log?.("3/4 Install panel app bundle");
    const appsDir = path.join(home, "Applications");
    fs.mkdirSync(appsDir, { recursive: true });
    const targetApp = path.join(appsDir, path.basename(appBundle));
    fs.rmSync(targetApp, { recursive: true, force: true });
    const copy = spawnSync("/usr/bin/ditto", [appBundle, targetApp], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    if ((copy.status ?? 1) !== 0) {
      throw new Error(`Failed to install app bundle: ${copy.stderr || "ditto exited with error"}`);
    }

    spawnSync("/usr/bin/xattr", ["-dr", "com.apple.quarantine", targetApp], { stdio: "ignore" });
    log?.("4/4 Verify panel installation");
    if (!fs.existsSync(targetApp)) {
      throw new Error(`Panel install verification failed: ${targetApp} not found.`);
    }
    const installed = resolveInstalledPanelApp();
    if (!installed) {
      throw new Error("Panel install verification failed: app bundle is not discoverable.");
    }
    return installed;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function takeOption(args: string[], name: string): { value: string | null; rest: string[] } {
  const out: string[] = [];
  let value: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name) {
      if (i + 1 >= args.length) {
        throw new Error(`Option ${name} requires a value.`);
      }
      value = args[i + 1];
      i += 1;
      continue;
    }
    out.push(args[i]);
  }

  return { value, rest: out };
}

async function runEmulatorCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const cfg = loadConfig(configPath);
  const emulator = new EmulatorManager(cfg);
  const sub = args[0];

  if (!sub) {
    throw new Error("Missing emulator subcommand.");
  }

  if (sub === "status") {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(emulator.status(), null, 2));
    return 0;
  }
  if (sub === "start") {
    // eslint-disable-next-line no-console
    console.log(await emulator.start());
    return 0;
  }
  if (sub === "stop") {
    // eslint-disable-next-line no-console
    console.log(emulator.stop());
    return 0;
  }
  if (sub === "hide") {
    // eslint-disable-next-line no-console
    console.log(emulator.hideWindow());
    return 0;
  }
  if (sub === "show") {
    // eslint-disable-next-line no-console
    console.log(emulator.showWindow());
    return 0;
  }
  if (sub === "list-avds") {
    for (const avd of emulator.listAvds()) {
      // eslint-disable-next-line no-console
      console.log(avd);
    }
    return 0;
  }
  if (sub === "screenshot") {
    const { value: outPath, rest: afterOut } = takeOption(args.slice(1), "--out");
    const { value: deviceId, rest } = takeOption(afterOut, "--device");
    if (rest.length > 0) {
      throw new Error(`Unexpected arguments: ${rest.join(" ")}`);
    }
    // eslint-disable-next-line no-console
    console.log(emulator.captureScreenshot(outPath ?? undefined, deviceId ?? undefined));
    return 0;
  }
  if (sub === "tap") {
    const { value: xRaw, rest: afterX } = takeOption(args.slice(1), "--x");
    const { value: yRaw, rest: afterY } = takeOption(afterX, "--y");
    const { value: deviceId, rest } = takeOption(afterY, "--device");
    if (rest.length > 0) {
      throw new Error(`Unexpected arguments: ${rest.join(" ")}`);
    }
    if (xRaw === null || yRaw === null) {
      throw new Error("Usage: openpocket emulator tap --x <int> --y <int> [--device <id>]");
    }
    const x = Number(xRaw);
    const y = Number(yRaw);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("Tap coordinates must be numbers.");
    }
    // eslint-disable-next-line no-console
    console.log(emulator.tap(Math.round(x), Math.round(y), deviceId ?? undefined));
    return 0;
  }
  if (sub === "type") {
    const { value: text, rest: afterText } = takeOption(args.slice(1), "--text");
    const { value: deviceId, rest } = takeOption(afterText, "--device");
    if (rest.length > 0) {
      throw new Error(`Unexpected arguments: ${rest.join(" ")}`);
    }
    if (text === null) {
      throw new Error("Usage: openpocket emulator type --text <text> [--device <id>]");
    }
    // eslint-disable-next-line no-console
    console.log(emulator.typeText(text, deviceId ?? undefined));
    return 0;
  }

  throw new Error(`Unknown emulator subcommand: ${sub}`);
}

async function runAgentCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const { value: model, rest } = takeOption(args, "--model");
  const task = rest.join(" ").trim();
  if (!task) {
    throw new Error("Missing task. Usage: openpocket agent [--model <name>] <task>");
  }

  const cfg = loadConfig(configPath);
  const agent = new AgentRuntime(cfg);
  const result = await agent.runTask(task, model ?? undefined);
  // eslint-disable-next-line no-console
  console.log(result.message);
  // eslint-disable-next-line no-console
  console.log(`Session: ${result.sessionPath}`);
  return result.ok ? 0 : 1;
}

async function runGatewayCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const sub = (args[0] ?? "start").trim();
  if (sub !== "start" && sub !== "telegram") {
    throw new Error(`Unknown gateway subcommand: ${sub}. Use: gateway start`);
  }

  const printStartupHeader = (cfg: ReturnType<typeof loadConfig>): void => {
    const envName = cfg.telegram.botTokenEnv?.trim() || "TELEGRAM_BOT_TOKEN";
    const hasConfigToken = cfg.telegram.botToken.trim().length > 0;
    const hasEnvToken = Boolean(process.env[envName]?.trim());
    const tokenSource = hasConfigToken
      ? "config.json"
      : hasEnvToken
        ? `env:${envName}`
        : `missing (${envName})`;

    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log("[OpenPocket] Gateway startup");
    // eslint-disable-next-line no-console
    console.log(`  config: ${cfg.configPath}`);
    // eslint-disable-next-line no-console
    console.log(`  project: ${cfg.projectName}`);
    // eslint-disable-next-line no-console
    console.log(`  model: ${cfg.defaultModel}`);
    // eslint-disable-next-line no-console
    console.log(`  telegram token: ${tokenSource}`);
    // eslint-disable-next-line no-console
    console.log(`  human auth: ${cfg.humanAuth.enabled ? "enabled" : "disabled"}`);
    // eslint-disable-next-line no-console
    console.log("");
  };

  const printStartupStep = (step: number, total: number, title: string, detail: string): void => {
    // eslint-disable-next-line no-console
    console.log(`[OpenPocket][gateway-start] [${step}/${total}] ${title}: ${detail}`);
  };

  await runGatewayLoop({
    start: async () => {
      const cfg = loadConfig(configPath);
      const shortcut = installCliShortcut();
      const envName = cfg.telegram.botTokenEnv?.trim() || "TELEGRAM_BOT_TOKEN";
      const hasToken = Boolean(cfg.telegram.botToken.trim() || process.env[envName]?.trim());
      const totalSteps = 6;

      printStartupHeader(cfg);
      printStartupStep(1, totalSteps, "Load config", "ok");
      if (shortcut.shellRcUpdated.length > 0 || !shortcut.binDirAlreadyInPath) {
        // eslint-disable-next-line no-console
        console.log(`[OpenPocket][gateway-start] CLI launcher ensured: ${shortcut.commandPath}`);
        if (shortcut.preferredPathCommandPath) {
          // eslint-disable-next-line no-console
          console.log(`[OpenPocket][gateway-start] Current-shell launcher: ${shortcut.preferredPathCommandPath}`);
        }
        if (shortcut.shellRcUpdated.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`[OpenPocket][gateway-start] Updated shell rc: ${shortcut.shellRcUpdated.join(", ")}`);
        }
        // eslint-disable-next-line no-console
        console.log(
          "[OpenPocket][gateway-start] Reload shell profile (or open a new terminal) before using `openpocket` without `./`.",
        );
      }
      if (!hasToken) {
        printStartupStep(2, totalSteps, "Validate Telegram token", "failed");
        throw new Error(
          `Telegram bot token is empty. Set config.telegram.botToken or env ${envName}.`,
        );
      }
      printStartupStep(2, totalSteps, "Validate Telegram token", "ok");

      const emulator = new EmulatorManager(cfg);
      const emulatorStatus = emulator.status();
      if (emulatorStatus.bootedDevices.length > 0) {
        let detail = `ok (${emulatorStatus.bootedDevices.join(", ")})`;
        if (process.platform === "darwin") {
          detail = `${detail}; ${emulator.hideWindow()}`;
        }
        printStartupStep(
          3,
          totalSteps,
          "Ensure emulator is running",
          detail,
        );
      } else {
        printStartupStep(3, totalSteps, "Ensure emulator is running", "starting");
        const startMessage = await emulator.start(true);
        printStartupStep(3, totalSteps, "Ensure emulator is running", startMessage);
      }
      const readyStatus = emulator.status();
      if (readyStatus.bootedDevices.length === 0) {
        throw new Error(
          "Emulator is online but not boot-complete yet. Retry after boot or increase emulator.bootTimeoutSec.",
        );
      }

      if (process.platform === "darwin") {
        printStartupStep(4, totalSteps, "Ensure panel is running", "starting");
        await runPanelCommand(configPath, ["start"]);
        printStartupStep(4, totalSteps, "Ensure panel is running", "ok");
      } else {
        printStartupStep(4, totalSteps, "Ensure panel is running", "skipped (macOS only)");
      }

      printStartupStep(5, totalSteps, "Initialize gateway runtime", "starting");
      const gateway = new TelegramGateway(cfg);
      printStartupStep(5, totalSteps, "Initialize gateway runtime", "ok");
      printStartupStep(6, totalSteps, "Start services", "starting");
      await gateway.start();
      printStartupStep(6, totalSteps, "Start services", "ok");
      // eslint-disable-next-line no-console
      console.log("[OpenPocket][gateway-start] Gateway is running. Press Ctrl+C to stop.");
      return {
        stop: async (reason?: string) => {
          // eslint-disable-next-line no-console
          console.log(`[OpenPocket][gateway-start] Stopping gateway (${reason ?? "run-loop-stop"})`);
          await gateway.stop(reason ?? "run-loop-stop");
        },
      };
    },
  });
  return 0;
}

async function runBootstrapCommand(configPath: string | undefined): Promise<ReturnType<typeof loadConfig>> {
  const cfg = loadConfig(configPath);
  await ensureAndroidPrerequisites(cfg, {
    autoInstall: true,
    logger: (line) => {
      // eslint-disable-next-line no-console
      console.log(`[OpenPocket][env] ${line}`);
    },
  });
  saveConfig(cfg);
  return cfg;
}

function shortcutMarkerPath(cfg: ReturnType<typeof loadConfig>): string {
  return path.join(cfg.stateDir, "cli-shortcut.json");
}

function installCliShortcutOnFirstOnboard(cfg: ReturnType<typeof loadConfig>): void {
  const markerPath = shortcutMarkerPath(cfg);
  if (fs.existsSync(markerPath)) {
    return;
  }

  const shortcut = installCliShortcut();
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify(
      {
        installedAt: new Date().toISOString(),
        commandPath: shortcut.commandPath,
        binDir: shortcut.binDir,
        shellRcUpdated: shortcut.shellRcUpdated,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );

  // eslint-disable-next-line no-console
  console.log(`[OpenPocket][onboard] CLI launcher installed: ${shortcut.commandPath}`);
  if (shortcut.preferredPathCommandPath) {
    // eslint-disable-next-line no-console
    console.log(`[OpenPocket][onboard] Current-shell launcher: ${shortcut.preferredPathCommandPath}`);
  }
  if (shortcut.shellRcUpdated.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[OpenPocket][onboard] Updated shell rc: ${shortcut.shellRcUpdated.join(", ")}`);
  }
  if (!shortcut.binDirAlreadyInPath || shortcut.shellRcUpdated.length > 0) {
    // eslint-disable-next-line no-console
    console.log("[OpenPocket][onboard] Reload shell profile (or open a new terminal) to use `openpocket` directly.");
  }
}

async function runOnboardCommand(configPath: string | undefined): Promise<number> {
  const cfg = await runBootstrapCommand(configPath);
  installCliShortcutOnFirstOnboard(cfg);
  await runSetupWizard(cfg);
  return 0;
}

async function runInstallCliCommand(): Promise<number> {
  const shortcut = installCliShortcut();
  // eslint-disable-next-line no-console
  console.log(`CLI launcher installed: ${shortcut.commandPath}`);
  if (shortcut.preferredPathCommandPath) {
    // eslint-disable-next-line no-console
    console.log(`Current-shell launcher: ${shortcut.preferredPathCommandPath}`);
  }
  if (shortcut.shellRcUpdated.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Updated shell rc: ${shortcut.shellRcUpdated.join(", ")}`);
  }
  if (!shortcut.binDirAlreadyInPath || shortcut.shellRcUpdated.length > 0) {
    // eslint-disable-next-line no-console
    console.log("Reload shell profile (or open a new terminal) to use `openpocket` directly.");
  }
  return 0;
}

async function runSkillsCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const sub = args[0];
  if (sub !== "list") {
    throw new Error(`Unknown skills subcommand: ${sub ?? "(missing)"}`);
  }

  const cfg = loadConfig(configPath);
  const loader = new SkillLoader(cfg);
  const skills = loader.loadAll();
  if (skills.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No skills loaded.");
    return 0;
  }

  for (const skill of skills) {
    // eslint-disable-next-line no-console
    console.log(`[${skill.source}] ${skill.name} (${skill.id})`);
    // eslint-disable-next-line no-console
    console.log(`  ${skill.description}`);
    // eslint-disable-next-line no-console
    console.log(`  ${skill.path}`);
  }
  return 0;
}

async function runScriptCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const sub = args[0];
  if (sub !== "run") {
    throw new Error(`Unknown script subcommand: ${sub ?? "(missing)"}`);
  }

  const cfg = loadConfig(configPath);
  const { value: filePath, rest: afterFile } = takeOption(args.slice(1), "--file");
  const { value: textScript, rest: afterText } = takeOption(afterFile, "--text");
  const { value: timeout, rest } = takeOption(afterText, "--timeout");
  if (rest.length > 0) {
    throw new Error(`Unexpected arguments: ${rest.join(" ")}`);
  }

  let script = "";
  if (filePath) {
    script = fs.readFileSync(filePath, "utf-8");
  } else if (textScript) {
    script = textScript;
  } else {
    throw new Error("Missing script input. Use --file <path> or --text <script>.");
  }

  const executor = new ScriptExecutor(cfg);
  const result = await executor.execute(
    script,
    timeout && Number.isFinite(Number(timeout)) ? Number(timeout) : undefined,
  );

  // eslint-disable-next-line no-console
  console.log(`ok=${result.ok} exitCode=${result.exitCode} timedOut=${result.timedOut}`);
  // eslint-disable-next-line no-console
  console.log(`runDir=${result.runDir}`);
  if (result.stdout.trim()) {
    // eslint-disable-next-line no-console
    console.log(`stdout:\n${result.stdout}`);
  }
  if (result.stderr.trim()) {
    // eslint-disable-next-line no-console
    console.log(`stderr:\n${result.stderr}`);
  }
  return result.ok ? 0 : 1;
}

function parseAllowedChatIds(raw: string): number[] {
  const parts = raw
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  const values = parts.map((item) => Number(item));
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Allowed chat IDs must be numbers.");
  }
  return values.map((value) => Math.trunc(value));
}

const ENV_VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function normalizeEnvVarName(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  if (!ENV_VAR_NAME_RE.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function truncateForTerminal(text: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }
  if (text.length <= maxChars) {
    return text;
  }
  if (maxChars <= 3) {
    return ".".repeat(maxChars);
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

type CliSelectOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

async function selectByArrowKeys<T extends string>(
  rl: Interface,
  message: string,
  options: CliSelectOption<T>[],
  initialValue?: T,
): Promise<T> {
  if (options.length === 0) {
    throw new Error("Select prompt requires at least one option.");
  }
  const initialIndex =
    initialValue !== undefined ? Math.max(0, options.findIndex((opt) => opt.value === initialValue)) : 0;
  let index = initialIndex >= 0 && initialIndex < options.length ? initialIndex : 0;

  if (!input.isTTY || !output.isTTY) {
    return options[index].value;
  }

  rl.pause();
  readline.emitKeypressEvents(input);

  const previousRaw = Boolean((input as NodeJS.ReadStream).isRaw);
  if (input.setRawMode) {
    input.setRawMode(true);
  }
  input.resume();

  let renderedLines = 0;
  const columns = Math.max(60, output.columns ?? 120);
  const render = () => {
    if (renderedLines > 0) {
      readline.moveCursor(output, 0, -renderedLines);
      readline.clearScreenDown(output);
    }
    const lines: string[] = [];
    lines.push("");
    lines.push(truncateForTerminal(message, columns - 1));
    for (let i = 0; i < options.length; i += 1) {
      const option = options[i];
      const prefix = i === index ? ">" : " ";
      const hint = option.hint ? ` (${option.hint})` : "";
      const rawLine = `  ${prefix} ${option.label}${hint}`;
      lines.push(truncateForTerminal(rawLine, columns - 1));
    }
    lines.push(truncateForTerminal("Use Up/Down arrows and Enter to select.", columns - 1));
    output.write(`${lines.join("\n")}\n`);
    renderedLines = lines.length;
  };

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      input.removeListener("keypress", onKeypress);
      if (input.setRawMode) {
        try {
          input.setRawMode(previousRaw);
        } catch {
          // Ignore raw mode restore errors.
        }
      }
      rl.resume();
    };

    const onKeypress = (_char: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        output.write("\n");
        reject(new Error("Setup cancelled by user."));
        return;
      }
      if (key.name === "up") {
        index = (index - 1 + options.length) % options.length;
        render();
        return;
      }
      if (key.name === "down") {
        index = (index + 1) % options.length;
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        output.write("\n");
        resolve(options[index].value);
      }
    };

    input.on("keypress", onKeypress);
    render();
  });
}

async function runTelegramSetupCommand(
  configPath: string | undefined,
  args: string[],
): Promise<number> {
  const sub = (args[0] ?? "setup").trim();
  if (sub !== "setup") {
    throw new Error(`Unknown telegram subcommand: ${sub}. Use: telegram setup`);
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("`telegram setup` requires an interactive terminal (TTY).");
  }

  const cfg = loadConfig(configPath);
  const rl = createInterface({ input, output });
  try {
    // eslint-disable-next-line no-console
    console.log("[OpenPocket] Telegram setup");
    // eslint-disable-next-line no-console
    console.log("Create your bot in Telegram with @BotFather before continuing.");

    const fallbackEnv = "TELEGRAM_BOT_TOKEN";
    const configuredEnv = cfg.telegram.botTokenEnv || fallbackEnv;
    const currentEnv = normalizeEnvVarName(configuredEnv, fallbackEnv);
    if (currentEnv !== configuredEnv) {
      cfg.telegram.botTokenEnv = currentEnv;
      // eslint-disable-next-line no-console
      console.log(
        `[OpenPocket] Invalid botTokenEnv value detected (${configuredEnv}). Reset to ${currentEnv}.`,
      );
    }
    const envToken = process.env[currentEnv]?.trim() ?? "";
    const tokenChoice = await selectByArrowKeys(
      rl,
      "Telegram bot token source",
      [
        {
          value: "env",
          label: `Use environment variable (${currentEnv})`,
          hint: envToken ? `detected, length ${envToken.length}` : "not detected",
        },
        {
          value: "config",
          label: "Save token in local config.json",
        },
        {
          value: "keep",
          label: "Keep current token settings",
          hint: cfg.telegram.botToken.trim() ? "config token exists" : "no config token",
        },
      ],
      "env",
    );

    if (tokenChoice === "env") {
      const envNameRaw = await rl.question(
        `Environment variable name for Telegram token [${currentEnv}]: `,
      );
      const envName = envNameRaw.trim() || currentEnv;
      cfg.telegram.botTokenEnv = envName;
      cfg.telegram.botToken = "";
      const selectedEnvToken = process.env[envName]?.trim() ?? "";
      if (!selectedEnvToken) {
        // eslint-disable-next-line no-console
        console.log(
          `[OpenPocket] Warning: ${envName} is not set in this shell. Gateway start will fail until you export it.`,
        );
      }
    } else if (tokenChoice === "config") {
      const token = (await rl.question("Enter Telegram bot token: ")).trim();
      if (!token) {
        throw new Error("Telegram bot token cannot be empty.");
      }
      cfg.telegram.botToken = token;
    }

    const currentAllow =
      cfg.telegram.allowedChatIds.length > 0
        ? cfg.telegram.allowedChatIds.join(", ")
        : "empty (all chats allowed)";
    const allowChoice = await selectByArrowKeys(
      rl,
      "Telegram chat allowlist policy",
      [
        {
          value: "keep",
          label: "Keep current allowlist",
          hint: currentAllow,
        },
        {
          value: "open",
          label: "Allow all chats (clear allowlist)",
        },
        {
          value: "set",
          label: "Set allowlist manually (chat IDs)",
        },
      ],
      "keep",
    );

    if (allowChoice === "open") {
      cfg.telegram.allowedChatIds = [];
    } else if (allowChoice === "set") {
      const allowedInput = await rl.question(
        "Enter allowed chat IDs (comma or space separated): ",
      );
      cfg.telegram.allowedChatIds = parseAllowedChatIds(allowedInput);
    }

    saveConfig(cfg);
    // eslint-disable-next-line no-console
    console.log("\nTelegram setup saved.");
    // eslint-disable-next-line no-console
    console.log("Next: run `openpocket gateway start`.");
    return 0;
  } finally {
    if (input.setRawMode) {
      try {
        input.setRawMode(false);
      } catch {
        // Ignore raw mode reset errors.
      }
    }
    input.pause();
    rl.close();
  }
}

async function runPanelCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const sub = (args[0] ?? "start").trim();
  if (sub !== "start") {
    throw new Error(`Unknown panel subcommand: ${sub}. Use: panel start`);
  }

  if (process.platform !== "darwin") {
    throw new Error("OpenPocket menu bar panel is supported on macOS only.");
  }

  const launchArgs: string[] = [];
  const resolvedConfigPath = configPath?.trim() ? path.resolve(configPath.trim()) : "";
  if (resolvedConfigPath) {
    launchArgs.push("--config-path", resolvedConfigPath);
  }
  const repoRoot = path.resolve(__dirname, "..");
  launchArgs.push("--repo-root", repoRoot);
  const localLauncher = path.join(repoRoot, "openpocket");
  if (fs.existsSync(localLauncher)) {
    launchArgs.push("--cli-path", localLauncher);
  }

  const installedApp = resolveInstalledPanelApp();
  if (installedApp) {
    if (openPanelApp(installedApp, launchArgs)) {
      // eslint-disable-next-line no-console
      console.log(`OpenPocket Control Panel opened: ${installedApp}`);
      return 0;
    }
    // eslint-disable-next-line no-console
    console.log(`[OpenPocket][panel] Installed app could not be opened. Reinstalling: ${installedApp}`);
  }

  const releaseUrl = getPanelReleaseUrl();
  // eslint-disable-next-line no-console
  console.log("OpenPocket panel is required and not installed. Installing from GitHub Release...");
  const installedFromRelease = installPanelFromRelease(releaseUrl, (line) => {
    // eslint-disable-next-line no-console
    console.log(`[OpenPocket][panel-install] ${line}`);
  });
  if (!openPanelApp(installedFromRelease, launchArgs)) {
    throw new Error(`Panel installed but failed to open: ${installedFromRelease}`);
  }
  // eslint-disable-next-line no-console
  console.log(`OpenPocket Control Panel installed and opened: ${installedFromRelease}`);
  return 0;
}

async function runHumanAuthRelayCommand(
  configPath: string | undefined,
  args: string[],
): Promise<number> {
  const sub = (args[0] ?? "start").trim();
  if (sub !== "start") {
    throw new Error(`Unknown human-auth-relay subcommand: ${sub}. Use: human-auth-relay start`);
  }

  const { value: host, rest: afterHost } = takeOption(args.slice(1), "--host");
  const { value: portRaw, rest: afterPort } = takeOption(afterHost, "--port");
  const { value: publicBaseUrl, rest: afterPublicBaseUrl } = takeOption(
    afterPort,
    "--public-base-url",
  );
  const { value: apiKey, rest: afterApiKey } = takeOption(afterPublicBaseUrl, "--api-key");
  const { value: stateFile, rest } = takeOption(afterApiKey, "--state-file");

  if (rest.length > 0) {
    throw new Error(`Unexpected arguments: ${rest.join(" ")}`);
  }

  const cfg = loadConfig(configPath);
  const parsedPort = Number(portRaw ?? String(cfg.humanAuth.localRelayPort));
  const defaultPort = cfg.humanAuth.localRelayPort;
  const port = Number.isFinite(parsedPort)
    ? Math.max(1, Math.min(65535, Math.round(parsedPort)))
    : defaultPort;

  const relay = new HumanAuthRelayServer({
    host: (host ?? cfg.humanAuth.localRelayHost ?? "0.0.0.0").trim(),
    port,
    publicBaseUrl: (publicBaseUrl ?? cfg.humanAuth.publicBaseUrl ?? "").trim(),
    apiKey: (apiKey ?? cfg.humanAuth.apiKey ?? "").trim(),
    apiKeyEnv: cfg.humanAuth.apiKeyEnv,
    stateFile:
      stateFile?.trim() ||
      cfg.humanAuth.localRelayStateFile,
  });

  await relay.start();
  // eslint-disable-next-line no-console
  console.log(`[OpenPocket][human-auth-relay] started at ${relay.address || `http://${host ?? "0.0.0.0"}:${port}`}`);
  // eslint-disable-next-line no-console
  console.log("[OpenPocket][human-auth-relay] press Ctrl+C to stop");

  await new Promise<void>((resolve) => {
    const onSignal = (): void => {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      resolve();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });

  await relay.stop();
  return 0;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { value: configPath, rest } = takeOption(argv, "--config");

  if (rest.length === 0 || rest[0] === "-h" || rest[0] === "--help") {
    printHelp();
    return 0;
  }

  const command = rest[0];

  if (command === "init") {
    // eslint-disable-next-line no-console
    console.log("[OpenPocket] `init` is deprecated. Use `openpocket onboard`.");
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (interactive) {
      return runOnboardCommand(configPath ?? undefined);
    }
    const cfg = await runBootstrapCommand(configPath ?? undefined);
    // eslint-disable-next-line no-console
    console.log(`OpenPocket bootstrap completed.\nConfig: ${cfg.configPath}`);
    // eslint-disable-next-line no-console
    console.log("Run `openpocket onboard` in an interactive terminal to complete consent/model/API key onboarding.");
    return 0;
  }

  if (command === "install-cli") {
    return runInstallCliCommand();
  }

  if (command === "config-show") {
    const cfg = loadConfig(configPath ?? undefined);
    // eslint-disable-next-line no-console
    console.log(fs.readFileSync(cfg.configPath, "utf-8").trim());
    return 0;
  }

  if (command === "emulator") {
    return runEmulatorCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "agent") {
    return runAgentCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "gateway") {
    return runGatewayCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "telegram") {
    return runTelegramSetupCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "panel") {
    return runPanelCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "human-auth-relay") {
    return runHumanAuthRelayCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "skills") {
    return runSkillsCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "script") {
    return runScriptCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "setup") {
    // eslint-disable-next-line no-console
    console.log("[OpenPocket] `setup` is deprecated. Use `openpocket onboard`.");
    return runOnboardCommand(configPath ?? undefined);
  }

  if (command === "onboard") {
    return runOnboardCommand(configPath ?? undefined);
  }

  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`OpenPocket error: ${(error as Error).message}`);
      process.exitCode = 1;
    });
}
