import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { HumanAuthTunnelNgrokConfig } from "../types";
import { sleep } from "../utils/time";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class NgrokTunnel {
  private readonly config: HumanAuthTunnelNgrokConfig;
  private readonly targetUrl: string;
  private readonly log: (line: string) => void;
  private process: ChildProcessWithoutNullStreams | null = null;
  private publicUrl = "";
  private closed = false;

  constructor(
    config: HumanAuthTunnelNgrokConfig,
    targetUrl: string,
    log?: (line: string) => void,
  ) {
    this.config = config;
    this.targetUrl = targetUrl;
    this.log =
      log ??
      ((line: string) => {
        // eslint-disable-next-line no-console
        console.log(line);
      });
  }

  private resolveAuthtoken(): string {
    if (this.config.authtoken.trim()) {
      return this.config.authtoken.trim();
    }
    if (this.config.authtokenEnv.trim()) {
      return process.env[this.config.authtokenEnv]?.trim() ?? "";
    }
    return "";
  }

  private async readPublicUrlFromApi(): Promise<string> {
    const response = await fetch(`${this.config.apiBaseUrl}/api/tunnels`);
    if (!response.ok) {
      throw new Error(`ngrok api status=${response.status}`);
    }
    const parsed = (await response.json()) as unknown;
    if (!isObject(parsed) || !Array.isArray(parsed.tunnels)) {
      throw new Error("ngrok api returned invalid payload.");
    }
    const tunnels = parsed.tunnels
      .filter((item): item is Record<string, unknown> => isObject(item))
      .map((item) => ({
        publicUrl: String(item.public_url ?? ""),
        proto: String(item.proto ?? ""),
      }))
      .filter((item) => item.publicUrl.startsWith("https://"));
    if (tunnels.length === 0) {
      throw new Error("ngrok api has no https tunnel yet.");
    }
    return tunnels[0].publicUrl.replace(/\/+$/, "");
  }

  async start(): Promise<string> {
    if (this.process && !this.closed) {
      if (this.publicUrl) {
        return this.publicUrl;
      }
      throw new Error("ngrok tunnel is starting.");
    }

    const args = [
      "http",
      this.targetUrl,
      "--log",
      "stdout",
      "--log-format",
      "json",
    ];
    const authtoken = this.resolveAuthtoken();
    if (authtoken) {
      args.push("--authtoken", authtoken);
    }

    this.closed = false;
    const child = spawn(this.config.executable, args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process = child;

    const onChunk = (prefix: string, chunk: Buffer): void => {
      const text = chunk.toString("utf-8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        this.log(`[OpenPocket][human-auth][ngrok] ${prefix}${trimmed}`);
      }
    };
    child.stdout.on("data", (chunk) => onChunk("", chunk));
    child.stderr.on("data", (chunk) => onChunk("stderr: ", chunk));
    child.on("exit", (code, signal) => {
      this.closed = true;
      this.log(
        `[OpenPocket][human-auth][ngrok] process exited code=${code ?? "(null)"} signal=${signal ?? "(null)"}`,
      );
    });
    child.on("error", (error) => {
      this.log(`[OpenPocket][human-auth][ngrok] process error=${error.message}`);
    });

    const deadline = Date.now() + this.config.startupTimeoutSec * 1000;
    let lastError = "";
    while (Date.now() < deadline) {
      if (!this.process || this.closed) {
        throw new Error("ngrok process exited before tunnel became ready.");
      }
      try {
        const url = await this.readPublicUrlFromApi();
        this.publicUrl = url;
        return url;
      } catch (error) {
        lastError = stringifyError(error);
      }
      await sleep(500);
    }

    await this.stop();
    throw new Error(`Timed out waiting for ngrok tunnel url. ${lastError}`);
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }
    const current = this.process;
    this.process = null;
    if (current.killed || this.closed) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (!current.killed) {
          current.kill("SIGKILL");
        }
      }, 3000);

      current.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });

      current.kill("SIGTERM");
    });
  }
}
