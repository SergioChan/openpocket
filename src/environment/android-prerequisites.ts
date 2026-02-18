import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { OpenPocketConfig } from "../types";
import { ensureDir } from "../utils/paths";

type ToolName = "adb" | "emulator" | "sdkmanager" | "avdmanager";

type ToolPaths = Record<ToolName, string | null>;

export interface EnsureAndroidPrerequisitesOptions {
  autoInstall?: boolean;
  logger?: (line: string) => void;
}

export interface EnsureAndroidPrerequisitesResult {
  skipped: boolean;
  configUpdated: boolean;
  sdkRoot: string;
  toolPaths: ToolPaths;
  installedSteps: string[];
  avdCreated: boolean;
}

interface RunResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
  error: string | null;
}

function run(
  cmd: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    input?: string;
    inherit?: boolean;
  } = {},
): RunResult {
  const result = spawnSync(cmd, args, {
    encoding: "utf-8",
    env: options.env,
    input: options.input,
    stdio: options.inherit ? "inherit" : ["pipe", "pipe", "pipe"],
  });
  const status = result.status ?? 1;
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  return {
    ok: status === 0 && !result.error,
    status,
    stdout,
    stderr,
    error: result.error ? String(result.error.message || result.error) : null,
  };
}

function canExecute(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function firstExecutable(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved) && canExecute(resolved)) {
      return resolved;
    }
  }
  return null;
}

function findInPath(binName: string): string | null {
  const entries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((v) => v.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const candidate = path.join(entry, binName);
    if (fs.existsSync(candidate) && canExecute(candidate)) {
      return candidate;
    }
  }
  return null;
}

function collectSdkRoot(config: OpenPocketConfig): { sdkRoot: string; configUpdated: boolean } {
  const configured = config.emulator.androidSdkRoot.trim();
  if (configured) {
    return { sdkRoot: path.resolve(configured), configUpdated: false };
  }

  const envRoot = process.env.ANDROID_SDK_ROOT?.trim() || process.env.ANDROID_HOME?.trim() || "";
  const sdkRoot = envRoot ? path.resolve(envRoot) : path.join(os.homedir(), "Library", "Android", "sdk");
  config.emulator.androidSdkRoot = sdkRoot;
  return { sdkRoot, configUpdated: true };
}

function detectTools(sdkRoot: string): ToolPaths {
  const fallbackSdk = path.join(os.homedir(), "Library", "Android", "sdk");
  const sdkRoots = Array.from(new Set([sdkRoot, fallbackSdk]));

  const adbCandidates = sdkRoots
    .map((root) => path.join(root, "platform-tools", "adb"))
    .concat(["/opt/homebrew/bin/adb", "/usr/local/bin/adb"]);
  const emulatorCandidates = sdkRoots
    .map((root) => path.join(root, "emulator", "emulator"))
    .concat([
      "/opt/homebrew/share/android-commandlinetools/emulator/emulator",
      "/usr/local/share/android-commandlinetools/emulator/emulator",
    ]);
  const sdkManagerCandidates = sdkRoots
    .map((root) => path.join(root, "cmdline-tools", "latest", "bin", "sdkmanager"))
    .concat([
      "/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager",
      "/usr/local/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager",
    ]);
  const avdManagerCandidates = sdkRoots
    .map((root) => path.join(root, "cmdline-tools", "latest", "bin", "avdmanager"))
    .concat([
      "/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/avdmanager",
      "/usr/local/share/android-commandlinetools/cmdline-tools/latest/bin/avdmanager",
    ]);

  return {
    adb: firstExecutable(adbCandidates) ?? findInPath("adb"),
    emulator: firstExecutable(emulatorCandidates) ?? findInPath("emulator"),
    sdkmanager: firstExecutable(sdkManagerCandidates) ?? findInPath("sdkmanager"),
    avdmanager: firstExecutable(avdManagerCandidates) ?? findInPath("avdmanager"),
  };
}

function missingTools(toolPaths: ToolPaths): ToolName[] {
  const required: ToolName[] = ["adb", "emulator", "sdkmanager", "avdmanager"];
  return required.filter((name) => !toolPaths[name]);
}

function resolveBrewBinary(): string | null {
  return firstExecutable(["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]) ?? findInPath("brew");
}

function extendProcessPathForBrew(): void {
  const extra = ["/opt/homebrew/bin", "/usr/local/bin"];
  const entries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  for (const candidate of extra) {
    if (!entries.includes(candidate) && fs.existsSync(candidate)) {
      entries.unshift(candidate);
    }
  }
  process.env.PATH = entries.join(path.delimiter);
}

function installHomebrew(logger: (line: string) => void): void {
  logger("Homebrew not found. Installing Homebrew...");
  const result = run("/usr/bin/env", [
    "bash",
    "-lc",
    "NONINTERACTIVE=1 /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"",
  ], { inherit: true });
  if (!result.ok) {
    throw new Error("Failed to install Homebrew automatically.");
  }
  extendProcessPathForBrew();
}

function installBrewCask(brew: string, cask: string, logger: (line: string) => void): boolean {
  const exists = run(brew, ["list", "--cask", cask]);
  if (exists.ok) {
    logger(`brew cask '${cask}' already installed (skip).`);
    return false;
  }
  logger(`Installing brew cask '${cask}'...`);
  const installed = run(brew, ["install", "--cask", cask], { inherit: true });
  if (!installed.ok) {
    throw new Error(`brew install --cask ${cask} failed.`);
  }
  return true;
}

function acceptSdkLicenses(sdkmanager: string, sdkRoot: string, logger: (line: string) => void): void {
  logger("Accepting Android SDK licenses...");
  const res = run(sdkmanager, [`--sdk_root=${sdkRoot}`, "--licenses"], {
    input: `${"y\n".repeat(200)}`,
  });
  if (!res.ok) {
    logger("SDK licenses command returned non-zero; continuing.");
  }
}

function installSdkPackages(sdkmanager: string, sdkRoot: string, logger: (line: string) => void): void {
  logger("Installing Android SDK packages: platform-tools, emulator, platforms;android-34 ...");
  const result = run(
    sdkmanager,
    [`--sdk_root=${sdkRoot}`, "platform-tools", "emulator", "platforms;android-34"],
    { inherit: true },
  );
  if (!result.ok) {
    throw new Error("Failed to install required Android SDK packages.");
  }
}

function installOneSystemImage(
  sdkmanager: string,
  sdkRoot: string,
  logger: (line: string) => void,
): string | null {
  const archTag = process.arch === "arm64" ? "arm64-v8a" : "x86_64";
  const candidates = Array.from(
    new Set([
      `system-images;android-34;google_apis_playstore;${archTag}`,
      "system-images;android-34;google_apis_playstore;x86_64",
      "system-images;android-34;google_apis_playstore;arm64-v8a",
      "system-images;android-34;google_apis;x86_64",
      "system-images;android-34;google_apis;arm64-v8a",
    ]),
  );

  for (const pkg of candidates) {
    logger(`Trying system image: ${pkg}`);
    const res = run(sdkmanager, [`--sdk_root=${sdkRoot}`, pkg], { inherit: true });
    if (res.ok) {
      logger(`System image ready: ${pkg}`);
      return pkg;
    }
  }

  logger("Could not install a system image automatically.");
  return null;
}

function listAvdNames(avdmanager: string, sdkRoot: string): string[] {
  const env = {
    ...process.env,
    ANDROID_SDK_ROOT: sdkRoot,
    ANDROID_HOME: sdkRoot,
  };
  const result = run(avdmanager, ["list", "avd"], { env });
  if (!result.ok) {
    return [];
  }
  const names: string[] = [];
  const regex = /^Name:\s*(.+)$/gm;
  let match: RegExpExecArray | null = regex.exec(result.stdout);
  while (match) {
    names.push(match[1].trim());
    match = regex.exec(result.stdout);
  }
  return names;
}

function createAvd(
  avdmanager: string,
  sdkRoot: string,
  avdName: string,
  imagePackage: string,
  logger: (line: string) => void,
): boolean {
  logger(`Creating AVD '${avdName}' with image '${imagePackage}'...`);
  const env = {
    ...process.env,
    ANDROID_SDK_ROOT: sdkRoot,
    ANDROID_HOME: sdkRoot,
  };
  const result = run(
    avdmanager,
    ["create", "avd", "--force", "-n", avdName, "-k", imagePackage],
    { env, input: "no\n" },
  );
  if (!result.ok) {
    logger("Failed to create AVD automatically.");
    return false;
  }
  return true;
}

export async function ensureAndroidPrerequisites(
  config: OpenPocketConfig,
  options: EnsureAndroidPrerequisitesOptions = {},
): Promise<EnsureAndroidPrerequisitesResult> {
  const logger = options.logger ?? (() => {});
  const autoInstall = options.autoInstall !== false;

  if (process.env.OPENPOCKET_SKIP_ENV_SETUP === "1") {
    const { sdkRoot, configUpdated } = collectSdkRoot(config);
    return {
      skipped: true,
      configUpdated,
      sdkRoot,
      toolPaths: detectTools(sdkRoot),
      installedSteps: [],
      avdCreated: false,
    };
  }

  const { sdkRoot, configUpdated } = collectSdkRoot(config);
  ensureDir(sdkRoot);

  let tools = detectTools(sdkRoot);
  let missing = missingTools(tools);
  const installedSteps: string[] = [];
  let avdCreated = false;

  if (missing.length > 0) {
    if (!autoInstall) {
      throw new Error(`Missing Android prerequisites: ${missing.join(", ")}`);
    }
    if (process.platform !== "darwin") {
      throw new Error(
        `Missing Android prerequisites on ${process.platform}: ${missing.join(", ")}. Auto-install currently supports macOS only.`,
      );
    }

    let brew = resolveBrewBinary();
    if (!brew) {
      installHomebrew(logger);
      installedSteps.push("homebrew");
      brew = resolveBrewBinary();
    }
    if (!brew) {
      throw new Error("Homebrew was not found after installation attempt.");
    }

    if (installBrewCask(brew, "android-platform-tools", logger)) {
      installedSteps.push("brew:android-platform-tools");
    }
    if (installBrewCask(brew, "android-commandlinetools", logger)) {
      installedSteps.push("brew:android-commandlinetools");
    }

    tools = detectTools(sdkRoot);
    missing = missingTools(tools);
  }

  if (missing.length > 0) {
    throw new Error(`Missing Android prerequisites after installation: ${missing.join(", ")}`);
  }

  const sdkmanager = tools.sdkmanager;
  const avdmanager = tools.avdmanager;
  if (!sdkmanager || !avdmanager) {
    throw new Error("sdkmanager or avdmanager is not available.");
  }

  acceptSdkLicenses(sdkmanager, sdkRoot, logger);
  installSdkPackages(sdkmanager, sdkRoot, logger);
  installedSteps.push("sdk:platform-tools,emulator,platforms;android-34");

  const currentAvds = listAvdNames(avdmanager, sdkRoot);
  if (!currentAvds.includes(config.emulator.avdName)) {
    const image = installOneSystemImage(sdkmanager, sdkRoot, logger);
    if (image) {
      installedSteps.push(`sdk:${image}`);
      avdCreated = createAvd(avdmanager, sdkRoot, config.emulator.avdName, image, logger);
      if (!avdCreated) {
        throw new Error(`Failed to create AVD '${config.emulator.avdName}'.`);
      }
      installedSteps.push(`avd:${config.emulator.avdName}`);
    } else if (currentAvds.length === 0) {
      throw new Error("No AVD exists and no installable system image was found.");
    }
  }

  tools = detectTools(sdkRoot);

  return {
    skipped: false,
    configUpdated,
    sdkRoot,
    toolPaths: tools,
    installedSteps,
    avdCreated,
  };
}
