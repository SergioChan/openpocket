import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";

import type { EmulatorStatus, OpenPocketConfig } from "../types";
import { ensureDir, nowForFilename } from "../utils/paths";
import { sleep } from "../utils/time";

export class EmulatorManager {
  private readonly config: OpenPocketConfig;
  private readonly stateDir: string;
  private readonly logFile: string;

  constructor(config: OpenPocketConfig) {
    this.config = config;
    this.stateDir = ensureDir(config.stateDir);
    this.logFile = path.join(this.stateDir, "emulator.log");
  }

  private sdkRoot(): string | null {
    if (this.config.emulator.androidSdkRoot.trim()) {
      return path.resolve(this.config.emulator.androidSdkRoot.trim());
    }
    if (process.env.ANDROID_SDK_ROOT?.trim()) {
      return path.resolve(process.env.ANDROID_SDK_ROOT);
    }
    if (process.env.ANDROID_HOME?.trim()) {
      return path.resolve(process.env.ANDROID_HOME);
    }
    return null;
  }

  emulatorBinary(): string {
    const sdkRoot = this.sdkRoot();
    if (sdkRoot) {
      const candidate = path.join(sdkRoot, "emulator", "emulator");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const fallback = [
      path.join(os.homedir(), "Library", "Android", "sdk", "emulator", "emulator"),
      "/opt/homebrew/share/android-commandlinetools/emulator/emulator",
      "/usr/local/share/android-commandlinetools/emulator/emulator",
    ];

    for (const candidate of fallback) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const fromPath = process.env.PATH?.split(path.delimiter)
      .map((p) => path.join(p, "emulator"))
      .find((p) => fs.existsSync(p));
    if (fromPath) {
      return fromPath;
    }

    throw new Error("Android emulator binary not found. Install Android SDK emulator first.");
  }

  adbBinary(): string {
    const sdkRoot = this.sdkRoot();
    if (sdkRoot) {
      const candidate = path.join(sdkRoot, "platform-tools", "adb");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const fromPath = process.env.PATH?.split(path.delimiter)
      .map((p) => path.join(p, "adb"))
      .find((p) => fs.existsSync(p));
    if (fromPath) {
      return fromPath;
    }

    throw new Error("adb not found. Install Android platform-tools first.");
  }

  listAvds(): string[] {
    const output = execFileSync(this.emulatorBinary(), ["-list-avds"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
    });
    return output
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private adb(args: string[], timeoutMs = 15000): string {
    const output = execFileSync(this.adbBinary(), args, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    return output;
  }

  emulatorDevices(): string[] {
    const output = this.adb(["devices"]);
    return output
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("emulator-") && line.includes("\tdevice"))
      .map((line) => line.split("\t", 1)[0]);
  }

  isBooted(deviceId: string): boolean {
    try {
      const output = this.adb(["-s", deviceId, "shell", "getprop", "sys.boot_completed"]);
      return output.trim() === "1";
    } catch {
      return false;
    }
  }

  status(): EmulatorStatus {
    const devices = this.emulatorDevices();
    const bootedDevices = devices.filter((d) => this.isBooted(d));
    return {
      avdName: this.config.emulator.avdName,
      devices,
      bootedDevices,
    };
  }

  private async waitForBoot(timeoutMs: number): Promise<EmulatorStatus> {
    const startAt = Date.now();
    let latest = this.status();
    while (Date.now() - startAt < timeoutMs) {
      latest = this.status();
      if (latest.bootedDevices.length > 0) {
        return latest;
      }
      await sleep(2000);
    }
    return this.status();
  }

  private async waitForShutdown(timeoutMs: number): Promise<boolean> {
    const startAt = Date.now();
    while (Date.now() - startAt < timeoutMs) {
      if (this.emulatorDevices().length === 0) {
        return true;
      }
      await sleep(500);
    }
    return this.emulatorDevices().length === 0;
  }

  async start(headless?: boolean): Promise<string> {
    const timeoutMs = Math.max(20, this.config.emulator.bootTimeoutSec) * 1000;
    const status = this.status();
    if (status.devices.length > 0) {
      if (status.bootedDevices.length > 0) {
        return `Emulator already running: ${status.bootedDevices.join(", ")}`;
      }

      const waited = await this.waitForBoot(timeoutMs);
      if (waited.bootedDevices.length > 0) {
        return `Emulator booted: ${waited.bootedDevices.join(", ")}`;
      }
      return `Emulator already running (${status.devices.join(", ")}), but boot is still in progress.`;
    }

    const avds = this.listAvds();
    if (avds.length === 0) {
      throw new Error("No AVD found. Create one with avdmanager first.");
    }

    let avdName = this.config.emulator.avdName;
    let fallback = false;
    if (!avds.includes(avdName)) {
      avdName = avds[0];
      fallback = true;
    }

    const useHeadless = headless ?? this.config.emulator.headless;
    const args = ["-avd", avdName, "-gpu", "auto"];
    if (useHeadless) {
      args.push("-no-window");
    }
    if (Array.isArray(this.config.emulator.extraArgs)) {
      args.push(
        ...this.config.emulator.extraArgs
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0),
      );
    }

    ensureDir(path.dirname(this.logFile));
    const marker = `\n=== ${nowForFilename()} start ${this.emulatorBinary()} ${args.join(" ")} ===\n`;
    fs.appendFileSync(this.logFile, marker, "utf-8");

    const fd = fs.openSync(this.logFile, "a");
    try {
      const child = spawn(this.emulatorBinary(), args, {
        detached: true,
        stdio: ["ignore", fd, fd],
      });
      child.unref();
    } finally {
      fs.closeSync(fd);
    }

    const waited = await this.waitForBoot(timeoutMs);
    if (waited.bootedDevices.length > 0) {
      const prefix = fallback
        ? `Configured AVD '${this.config.emulator.avdName}' not found; used '${avdName}'. `
        : "";
      return `${prefix}Emulator booted: ${waited.bootedDevices.join(", ")}`;
    }

    return "Emulator process started, but boot is still in progress.";
  }

  stop(): string {
    const devices = this.emulatorDevices();
    if (devices.length === 0) {
      return "No running emulator found.";
    }
    for (const device of devices) {
      try {
        this.adb(["-s", device, "emu", "kill"]);
      } catch {
        // Keep trying to stop other devices.
      }
    }
    return `Stop signal sent to: ${devices.join(", ")}`;
  }

  hideWindow(): string {
    if (process.platform !== "darwin") {
      return "hide-window currently supports macOS only.";
    }
    spawnSync("osascript", ["-e", 'tell application "Android Emulator" to hide'], {
      stdio: "ignore",
    });
    return "Android Emulator window hidden.";
  }

  showWindow(): string {
    if (process.platform !== "darwin") {
      return "show-window currently supports macOS only.";
    }
    spawnSync("osascript", ["-e", 'tell application "Android Emulator" to activate'], {
      stdio: "ignore",
    });
    return "Android Emulator window activated.";
  }

  private hasVisibleWindowMac(): boolean {
    if (process.platform !== "darwin") {
      return false;
    }
    try {
      const output = spawnSync(
        "osascript",
        ["-e", 'tell application "Android Emulator" to get count of windows'],
        {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      if (output.status !== 0) {
        return false;
      }
      const count = Number.parseInt(String(output.stdout ?? "").trim(), 10);
      return Number.isFinite(count) && count > 0;
    } catch {
      return false;
    }
  }

  private async waitForVisibleWindowMac(timeoutMs: number): Promise<boolean> {
    const startAt = Date.now();
    while (Date.now() - startAt < timeoutMs) {
      if (this.hasVisibleWindowMac()) {
        return true;
      }
      await sleep(200);
    }
    return this.hasVisibleWindowMac();
  }

  /**
   * Ensures the emulator is interactable in a desktop window.
   * If the process is currently headless (-no-window), it is restarted in windowed mode.
   */
  async ensureWindowVisible(): Promise<string> {
    if (process.platform !== "darwin") {
      return this.showWindow();
    }

    const status = this.status();
    if (status.devices.length === 0) {
      const startMessage = await this.start(false);
      const showMessage = this.showWindow();
      return `${startMessage}; ${showMessage}`;
    }

    const showMessage = this.showWindow();
    const becameVisible = await this.waitForVisibleWindowMac(1500);
    if (becameVisible) {
      return showMessage;
    }

    const stopMessage = this.stop();
    await this.waitForShutdown(15000);
    const startMessage = await this.start(false);
    const showAfterRestart = this.showWindow();
    return [
      "Emulator was running in headless mode; restarted in windowed mode.",
      stopMessage,
      startMessage,
      showAfterRestart,
    ].join(" ");
  }

  captureScreenshot(outputPath?: string, preferredDeviceId?: string): string {
    const deviceId = this.resolveOnlineDevice(preferredDeviceId);

    const targetPath = outputPath
      ? path.resolve(outputPath)
      : path.join(this.stateDir, `screenshot-${deviceId}-${nowForFilename()}.png`);
    ensureDir(path.dirname(targetPath));

    const data = this.captureScreenshotPngBuffer(deviceId);

    fs.writeFileSync(targetPath, data);
    return targetPath;
  }

  captureScreenshotBuffer(preferredDeviceId?: string): { deviceId: string; data: Buffer } {
    const deviceId = this.resolveOnlineDevice(preferredDeviceId);

    const data = this.captureScreenshotPngBuffer(deviceId);

    return { deviceId, data };
  }

  tap(x: number, y: number, preferredDeviceId?: string): string {
    const deviceId = this.resolveOnlineDevice(preferredDeviceId);
    const tx = Math.max(0, Math.round(x));
    const ty = Math.max(0, Math.round(y));
    this.adb(["-s", deviceId, "shell", "input", "tap", String(tx), String(ty)]);
    return `Tap sent to ${deviceId} at (${tx}, ${ty}).`;
  }

  typeText(text: string, preferredDeviceId?: string): string {
    const deviceId = this.resolveOnlineDevice(preferredDeviceId);
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!normalized.trim()) {
      throw new Error("Text input is empty.");
    }

    const lines = normalized.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.length > 0) {
        if (this.hasNonAscii(line)) {
          this.inputByClipboardPaste(deviceId, line);
        } else {
          const encoded = this.encodeAdbInputText(line);
          try {
            this.adb(["-s", deviceId, "shell", "input", "text", encoded]);
          } catch {
            this.inputByClipboardPaste(deviceId, line);
          }
        }
      }
      if (i < lines.length - 1) {
        this.adb(["-s", deviceId, "shell", "input", "keyevent", "KEYCODE_ENTER"]);
      }
    }

    return `Text input sent to ${deviceId}.`;
  }

  private hasNonAscii(text: string): boolean {
    return /[^\x00-\x7F]/.test(text);
  }

  private inputByClipboardPaste(deviceId: string, text: string): void {
    this.adb(["-s", deviceId, "shell", "cmd", "clipboard", "set", "text", text]);
    this.adb(["-s", deviceId, "shell", "input", "keyevent", "KEYCODE_PASTE"]);
  }

  private resolveOnlineDevice(preferredDeviceId?: string): string {
    const devices = this.emulatorDevices();
    if (devices.length === 0) {
      throw new Error("No running emulator found.");
    }
    const deviceId = preferredDeviceId ?? devices[0];
    if (!devices.includes(deviceId)) {
      throw new Error(`Device '${deviceId}' is not online. Online devices: ${devices.join(", ")}`);
    }
    return deviceId;
  }

  private encodeAdbInputText(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/ /g, "%s")
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/&/g, "\\&")
      .replace(/\|/g, "\\|")
      .replace(/</g, "\\<")
      .replace(/>/g, "\\>")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/;/g, "\\;");
  }

  private captureScreenshotPngBuffer(deviceId: string): Buffer {
    try {
      return execFileSync(this.adbBinary(), ["-s", deviceId, "exec-out", "screencap", "-p"], {
        encoding: "buffer",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 128 * 1024 * 1024,
        timeout: 15000,
      });
    } catch {
      const remote = `/sdcard/openpocket-screen-${nowForFilename()}.png`;
      const local = path.join(this.stateDir, `tmp-${deviceId}-${nowForFilename()}.png`);
      execFileSync(this.adbBinary(), ["-s", deviceId, "shell", "screencap", "-p", remote], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 8 * 1024 * 1024,
        timeout: 20000,
      });
      execFileSync(this.adbBinary(), ["-s", deviceId, "pull", remote, local], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 8 * 1024 * 1024,
        timeout: 20000,
      });
      try {
        execFileSync(this.adbBinary(), ["-s", deviceId, "shell", "rm", remote], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 4 * 1024 * 1024,
          timeout: 10000,
        });
      } catch {
        // Ignore cleanup failure.
      }
      const data = fs.readFileSync(local);
      fs.unlinkSync(local);
      return data;
    }
  }

  runAdb(args: string[], timeoutMs = 20000): string {
    return this.adb(args, timeoutMs);
  }
}
