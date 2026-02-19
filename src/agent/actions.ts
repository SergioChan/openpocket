import type { AgentAction, HumanAuthCapability } from "../types";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const HUMAN_AUTH_CAPABILITIES = new Set([
  "camera",
  "sms",
  "2fa",
  "location",
  "biometric",
  "notification",
  "contacts",
  "calendar",
  "files",
  "oauth",
  "payment",
  "permission",
  "unknown",
]);

export function normalizeAction(input: unknown): AgentAction {
  if (!isObject(input)) {
    return { type: "wait", durationMs: 1000, reason: "invalid action payload" };
  }

  const type = String(input.type ?? "").trim();

  if (type === "tap") {
    return {
      type,
      x: toNumber(input.x, 0),
      y: toNumber(input.y, 0),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  if (type === "swipe") {
    return {
      type,
      x1: toNumber(input.x1, 0),
      y1: toNumber(input.y1, 0),
      x2: toNumber(input.x2, 0),
      y2: toNumber(input.y2, 0),
      durationMs: toNumber(input.durationMs, 300),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  if (type === "type") {
    return {
      type,
      text: String(input.text ?? ""),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  if (type === "keyevent") {
    return {
      type,
      keycode: String(input.keycode ?? "KEYCODE_ENTER"),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  if (type === "launch_app") {
    return {
      type,
      packageName: String(input.packageName ?? ""),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  if (type === "shell") {
    return {
      type,
      command: String(input.command ?? ""),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  if (type === "run_script") {
    return {
      type,
      script: String(input.script ?? ""),
      timeoutSec: toNumber(input.timeoutSec, 60),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  if (type === "request_human_auth") {
    const capabilityRaw = String(input.capability ?? "unknown").trim().toLowerCase();
    return {
      type,
      capability: HUMAN_AUTH_CAPABILITIES.has(capabilityRaw)
        ? (capabilityRaw as HumanAuthCapability)
        : "unknown",
      instruction: String(
        input.instruction ?? input.reason ?? "Human authorization is required to continue.",
      ),
      timeoutSec: toNumber(input.timeoutSec, 300),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  if (type === "finish") {
    return {
      type,
      message: String(input.message ?? "Task finished."),
    };
  }

  if (type === "wait") {
    return {
      type,
      durationMs: toNumber(input.durationMs, 1000),
      reason: input.reason ? String(input.reason) : undefined,
    };
  }

  return {
    type: "wait",
    durationMs: 1000,
    reason: `unknown action type '${type}'`,
  };
}
