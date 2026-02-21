import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";

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

function normalizeHost(host: string): string {
  const value = host.trim().toLowerCase();
  if (!value || value === "::" || value === "0.0.0.0") {
    return "127.0.0.1";
  }
  if (value === "localhost") {
    return "127.0.0.1";
  }
  return value;
}

function toHostPort(value: string): string {
  let url = value.trim();
  if (!url) {
    return "";
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  try {
    const parsed = new URL(url);
    const host = normalizeHost(parsed.hostname);
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    return `${host}:${port}`;
  } catch {
    return "";
  }
}

export class NgrokTunnel {
  private readonly config: HumanAuthTunnelNgrokConfig;
  private readonly targetUrl: string;
  private readonly log: (line: string) => void;
  private process: ChildProcessWithoutNullStreams | null = null;
  private publicUrl = "";
  private closed = false;
  private apiBaseUrl = "";

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

  private async reserveApiWebAddress(): Promise<{ webAddr: string; apiBaseUrl: string }> {
    const fallbackApiBase = "http://127.0.0.1:4040";
    let parsed: URL;
    try {
      parsed = new URL(this.config.apiBaseUrl || fallbackApiBase);
    } catch {
      parsed = new URL(fallbackApiBase);
    }
    const host = normalizeHost(parsed.hostname || "127.0.0.1");
    const basePortRaw = Number(parsed.port || "4040");
    const basePort = Number.isFinite(basePortRaw) ? Math.max(1024, Math.trunc(basePortRaw)) : 4040;

    const tryPort = (port: number): Promise<boolean> =>
      new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.listen(port, host, () => {
          server.close(() => resolve(true));
        });
      });

    for (let offset = 0; offset < 25; offset += 1) {
      const port = basePort + offset;
      // eslint-disable-next-line no-await-in-loop
      if (await tryPort(port)) {
        return {
          webAddr: `${host}:${port}`,
          apiBaseUrl: `http://${host}:${port}`,
        };
      }
    }

    throw new Error(`Unable to reserve ngrok API web address from ${host}:${basePort}..${host}:${basePort + 24}`);
  }

  private async readPublicUrlFromApi(): Promise<string> {
    const apiBaseUrl = this.apiBaseUrl || this.config.apiBaseUrl;
    const response = await fetch(`${apiBaseUrl}/api/tunnels`);
    if (!response.ok) {
      throw new Error(`ngrok api status=${response.status}`);
    }
    const parsed = (await response.json()) as unknown;
    if (!isObject(parsed) || !Array.isArray(parsed.tunnels)) {
      throw new Error("ngrok api returned invalid payload.");
    }
    const targetKey = toHostPort(this.targetUrl);
    const tunnels = parsed.tunnels
      .filter((item): item is Record<string, unknown> => isObject(item))
      .map((item) => ({
        publicUrl: String(item.public_url ?? ""),
        proto: String(item.proto ?? ""),
        addr: isObject(item.config) ? String(item.config.addr ?? "") : String(item.addr ?? ""),
      }))
      .filter((item) => item.publicUrl.startsWith("https://"));
    if (tunnels.length === 0) {
      throw new Error("ngrok api has no https tunnel yet.");
    }
    const matched = tunnels.find((item) => toHostPort(item.addr) === targetKey);
    if (matched) {
      return matched.publicUrl.replace(/\/+$/, "");
    }
    if (tunnels.length === 1) {
      return tunnels[0].publicUrl.replace(/\/+$/, "");
    }
    throw new Error(`ngrok api has no tunnel for target ${this.targetUrl}`);
  }

  async start(): Promise<string> {
    if (this.process && !this.closed) {
      if (this.publicUrl) {
        return this.publicUrl;
      }
      throw new Error("ngrok tunnel is starting.");
    }

    const reserved = await this.reserveApiWebAddress();
    this.apiBaseUrl = reserved.apiBaseUrl;

    const args = [
      "http",
      this.targetUrl,
      "--web-addr",
      reserved.webAddr,
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
