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

interface JavaRuntimeInfo {
  javaHome: string | null;
  javaBin: string;
  major: number;
  rawVersion: string;
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

function parseJavaMajor(rawOutput: string): number | null {
  const quoted = rawOutput.match(/version\s+"([^"]+)"/i)?.[1]?.trim();
  if (quoted) {
    const parts = quoted.split(/[._-]/).filter(Boolean);
    if (parts[0] === "1" && parts.length > 1) {
      const major = Number(parts[1]);
      return Number.isFinite(major) ? major : null;
    }
    const major = Number(parts[0]);
    return Number.isFinite(major) ? major : null;
  }

  const fallback = rawOutput.match(/\bopenjdk\s+(\d+)(?:[.\s]|$)/i)?.[1];
  if (fallback) {
    const major = Number(fallback);
    return Number.isFinite(major) ? major : null;
  }

  return null;
}

function inspectJavaBin(javaBin: string): JavaRuntimeInfo | null {
  const result = run(javaBin, ["-version"]);
  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (!output) {
    return null;
  }
  const major = parseJavaMajor(output);
  if (!major) {
    return null;
  }
  const javaHome = path.dirname(path.dirname(javaBin));
  return {
    javaHome,
    javaBin,
    major,
    rawVersion: output.split("\n")[0] ?? output,
  };
}

function detectBestJavaRuntime(): JavaRuntimeInfo | null {
  const homeCandidates: string[] = [];
  const envHome = process.env.JAVA_HOME?.trim();
  if (envHome) {
    homeCandidates.push(envHome);
  }

  const javaHomeDefault = run("/usr/libexec/java_home", []);
  if (javaHomeDefault.ok) {
    const resolved = javaHomeDefault.stdout.trim();
    if (resolved) {
      homeCandidates.push(resolved);
    }
  }

  const vmDir = "/Library/Java/JavaVirtualMachines";
  if (fs.existsSync(vmDir)) {
    for (const name of fs.readdirSync(vmDir)) {
      homeCandidates.push(path.join(vmDir, name, "Contents", "Home"));
    }
  }

  homeCandidates.push("/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home");
  homeCandidates.push("/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home");

  const infos: JavaRuntimeInfo[] = [];
  const seen = new Set<string>();

  for (const home of homeCandidates) {
    const resolved = path.resolve(home);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    const javaBin = path.join(resolved, "bin", "java");
    if (!fs.existsSync(javaBin) || !canExecute(javaBin)) {
      continue;
    }
    const info = inspectJavaBin(javaBin);
    if (info) {
      infos.push(info);
    }
  }

  const pathJava = findInPath("java");
  if (pathJava) {
    const resolved = path.resolve(pathJava);
    if (!seen.has(resolved)) {
      const info = inspectJavaBin(resolved);
      if (info) {
        infos.push(info);
      }
    }
  }

  if (infos.length === 0) {
    return null;
  }

  infos.sort((a, b) => b.major - a.major);
  return infos[0];
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

function brewEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOMEBREW_NO_AUTO_UPDATE: process.env.HOMEBREW_NO_AUTO_UPDATE ?? "1",
    HOMEBREW_NO_ENV_HINTS: process.env.HOMEBREW_NO_ENV_HINTS ?? "1",
  };
}

function installBrewCask(brew: string, cask: string, logger: (line: string) => void): boolean {
  const exists = run(brew, ["list", "--cask", cask], { env: brewEnv() });
  if (exists.ok) {
    logger(`brew cask '${cask}' already installed (skip).`);
    return false;
  }
  logger(`Installing brew cask '${cask}'...`);
  const installed = run(brew, ["install", "--cask", cask], { inherit: true, env: brewEnv() });
  if (!installed.ok) {
    throw new Error(`brew install --cask ${cask} failed.`);
  }
  return true;
}

function resolveAndroidToolEnv(sdkRoot: string, javaHome: string): NodeJS.ProcessEnv {
  const extraBins = [
    path.join(javaHome, "bin"),
    path.join(sdkRoot, "platform-tools"),
    path.join(sdkRoot, "emulator"),
  ];
  const basePath = process.env.PATH ?? "";
  const pathEntries = [...extraBins, ...basePath.split(path.delimiter)].filter(Boolean);
  return {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_SDK_ROOT: sdkRoot,
    ANDROID_HOME: sdkRoot,
    PATH: Array.from(new Set(pathEntries)).join(path.delimiter),
  };
}

function acceptSdkLicenses(
  sdkmanager: string,
  sdkRoot: string,
  logger: (line: string) => void,
  toolEnv: NodeJS.ProcessEnv,
): void {
  logger("Accepting Android SDK licenses...");
  const res = run(sdkmanager, [`--sdk_root=${sdkRoot}`, "--licenses"], {
    env: toolEnv,
    input: `${"y\n".repeat(200)}`,
  });
  if (!res.ok) {
    logger("SDK licenses command returned non-zero; continuing.");
  }
}

function installSdkPackages(
  sdkmanager: string,
  sdkRoot: string,
  logger: (line: string) => void,
  toolEnv: NodeJS.ProcessEnv,
): void {
  logger("Installing Android SDK packages: platform-tools, emulator, platforms;android-34 ...");
  const result = run(
    sdkmanager,
    [`--sdk_root=${sdkRoot}`, "platform-tools", "emulator", "platforms;android-34"],
    { inherit: true, env: toolEnv },
  );
  if (!result.ok) {
    throw new Error(
      [
        "Failed to install required Android SDK packages.",
        "This usually means Java runtime is below 17 or JAVA_HOME points to an old JDK.",
      ].join(" "),
    );
  }
}

function installOneSystemImage(
  sdkmanager: string,
  sdkRoot: string,
  logger: (line: string) => void,
  toolEnv: NodeJS.ProcessEnv,
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
    const res = run(sdkmanager, [`--sdk_root=${sdkRoot}`, pkg], { inherit: true, env: toolEnv });
    if (res.ok) {
      logger(`System image ready: ${pkg}`);
      return pkg;
    }
  }

  logger("Could not install a system image automatically.");
  return null;
}

function listAvdNames(avdmanager: string, toolEnv: NodeJS.ProcessEnv): string[] {
  const result = run(avdmanager, ["list", "avd"], { env: toolEnv });
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
  avdName: string,
  imagePackage: string,
  logger: (line: string) => void,
  toolEnv: NodeJS.ProcessEnv,
): boolean {
  logger(`Creating AVD '${avdName}' with image '${imagePackage}'...`);
  const result = run(
    avdmanager,
    ["create", "avd", "--force", "-n", avdName, "-k", imagePackage],
    { env: toolEnv, input: "no\n" },
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

  const collected = collectSdkRoot(config);
  const sdkRoot = collected.sdkRoot;
  let configUpdated = collected.configUpdated;
  ensureDir(sdkRoot);

  let tools = detectTools(sdkRoot);
  const missingBeforeInstall = missingTools(tools);
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

  let javaRuntime = detectBestJavaRuntime();
  if (!javaRuntime || javaRuntime.major < 17) {
    if (!autoInstall) {
      throw new Error("Java 17+ is required for Android command line tools, but was not detected.");
    }
    if (process.platform !== "darwin") {
      throw new Error("Java 17+ is required for Android command line tools.");
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

    if (installBrewCask(brew, "temurin", logger)) {
      installedSteps.push("brew:temurin");
    }
    javaRuntime = detectBestJavaRuntime();
  }

  if (!javaRuntime || javaRuntime.major < 17 || !javaRuntime.javaHome) {
    throw new Error(
      [
        "Java 17+ is required for Android command line tools but is still unavailable.",
        "Please ensure a JDK 17+ is installed and retry onboarding.",
      ].join(" "),
    );
  }

  logger(`Using Java ${javaRuntime.major} for Android SDK tools: ${javaRuntime.javaHome}`);
  const toolEnv = resolveAndroidToolEnv(sdkRoot, javaRuntime.javaHome);
  const currentAvdsBefore = listAvdNames(avdmanager, toolEnv);
  const hasConfiguredAvd = currentAvdsBefore.includes(config.emulator.avdName);
  const hasAnyAvd = currentAvdsBefore.length > 0;
  const needsHeavySdkSetup = missingBeforeInstall.length > 0 || !hasAnyAvd;

  if (!needsHeavySdkSetup && hasConfiguredAvd) {
    logger("Android runtime already ready (tools + configured AVD found). Skipping heavy SDK install.");
  } else {
    acceptSdkLicenses(sdkmanager, sdkRoot, logger, toolEnv);
    installSdkPackages(sdkmanager, sdkRoot, logger, toolEnv);
    installedSteps.push("sdk:platform-tools,emulator,platforms;android-34");
  }

  let currentAvds = listAvdNames(avdmanager, toolEnv);
  if (!currentAvds.includes(config.emulator.avdName) && currentAvds.length > 0) {
    const fallback = currentAvds[0];
    logger(`Configured AVD '${config.emulator.avdName}' not found. Reusing existing AVD '${fallback}'.`);
    config.emulator.avdName = fallback;
    configUpdated = true;
  }

  if (currentAvds.length === 0) {
    const image = installOneSystemImage(sdkmanager, sdkRoot, logger, toolEnv);
    if (image) {
      installedSteps.push(`sdk:${image}`);
      avdCreated = createAvd(avdmanager, config.emulator.avdName, image, logger, toolEnv);
      if (!avdCreated) {
        throw new Error(`Failed to create AVD '${config.emulator.avdName}'.`);
      }
      installedSteps.push(`avd:${config.emulator.avdName}`);
      currentAvds = listAvdNames(avdmanager, toolEnv);
    } else {
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
