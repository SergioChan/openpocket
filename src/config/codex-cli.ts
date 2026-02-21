import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CODEX_AUTH_FILENAME = "auth.json";
const KEYCHAIN_SERVICE = "Codex Auth";
const KEYCHAIN_TOKEN_FRESHNESS_MS = 60 * 60 * 1000;

export const CODEX_CLI_BASE_URL = "https://chatgpt.com/backend-api/codex";

export type CodexCliCredential = {
  accessToken: string;
  refreshToken: string;
  accountId?: string;
  expiresAtMs: number;
  source: "keychain" | "auth.json";
};

type ReadCodexCliCredentialOptions = {
  codexHome?: string;
  platform?: NodeJS.Platform;
  execSyncImpl?: typeof execSync;
};

function resolveUserHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || "";
}

function resolveUserPath(input: string): string {
  if (!input.startsWith("~")) {
    return input;
  }
  const home = resolveUserHomeDir();
  if (!home) {
    return input;
  }
  if (input === "~") {
    return home;
  }
  if (input.startsWith("~/")) {
    return path.join(home, input.slice(2));
  }
  return input.replace(/^~(?=\/|\\)/, home);
}

function resolveCodexHomePath(codexHome?: string): string {
  const configured = codexHome ?? process.env.CODEX_HOME;
  const home = configured?.trim() ? resolveUserPath(configured.trim()) : resolveUserPath("~/.codex");
  try {
    return fs.realpathSync.native(home);
  } catch {
    return home;
  }
}

function computeCodexKeychainAccount(codexHome: string): string {
  const hash = createHash("sha256").update(codexHome).digest("hex");
  return `cli|${hash.slice(0, 16)}`;
}

function parseCodexCliPayload(raw: unknown): {
  accessToken: string;
  refreshToken: string;
  accountId?: string;
  lastRefreshMs?: number;
} | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const payload = raw as Record<string, unknown>;
  const tokens = payload.tokens as Record<string, unknown> | undefined;
  if (!tokens || typeof tokens !== "object") {
    return null;
  }

  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;
  if (typeof accessToken !== "string" || !accessToken) {
    return null;
  }
  if (typeof refreshToken !== "string" || !refreshToken) {
    return null;
  }

  const accountId = typeof tokens.account_id === "string" ? tokens.account_id : undefined;
  const lastRefresh = payload.last_refresh;
  const parsedLastRefresh =
    typeof lastRefresh === "string" || typeof lastRefresh === "number"
      ? new Date(lastRefresh).getTime()
      : undefined;
  const lastRefreshMs = Number.isFinite(parsedLastRefresh) ? parsedLastRefresh : undefined;

  return {
    accessToken,
    refreshToken,
    accountId,
    lastRefreshMs,
  };
}

function readCodexKeychainCredential(options?: ReadCodexCliCredentialOptions): CodexCliCredential | null {
  const platform = options?.platform ?? process.platform;
  if (platform !== "darwin") {
    return null;
  }

  const codexHome = resolveCodexHomePath(options?.codexHome);
  const account = computeCodexKeychainAccount(codexHome);
  const execSyncImpl = options?.execSyncImpl ?? execSync;

  try {
    const secret = execSyncImpl(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${account}" -w`,
      {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();
    const parsed = parseCodexCliPayload(JSON.parse(secret));
    if (!parsed) {
      return null;
    }
    const expiresAtMs = (parsed.lastRefreshMs ?? Date.now()) + KEYCHAIN_TOKEN_FRESHNESS_MS;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      accountId: parsed.accountId,
      expiresAtMs,
      source: "keychain",
    };
  } catch {
    return null;
  }
}

function readCodexAuthJsonCredential(authPath: string): CodexCliCredential | null {
  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const rawText = fs.readFileSync(authPath, "utf-8");
    const parsed = parseCodexCliPayload(JSON.parse(rawText));
    if (!parsed) {
      return null;
    }
    const expiresAtMs = (() => {
      try {
        return fs.statSync(authPath).mtimeMs + KEYCHAIN_TOKEN_FRESHNESS_MS;
      } catch {
        return Date.now() + KEYCHAIN_TOKEN_FRESHNESS_MS;
      }
    })();
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      accountId: parsed.accountId,
      expiresAtMs,
      source: "auth.json",
    };
  } catch {
    return null;
  }
}

export function readCodexCliCredential(
  options?: ReadCodexCliCredentialOptions,
): CodexCliCredential | null {
  const keychainCredential = readCodexKeychainCredential(options);
  if (keychainCredential) {
    return keychainCredential;
  }

  const codexHome = resolveCodexHomePath(options?.codexHome);
  const authPath = path.join(codexHome, CODEX_AUTH_FILENAME);
  return readCodexAuthJsonCredential(authPath);
}
