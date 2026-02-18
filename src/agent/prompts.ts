import type { ScreenSnapshot } from "../types";

export function buildSystemPrompt(skillsSummary = "(no skills loaded)"): string {
  return [
    "You are OpenPocket, an Android automation agent.",
    "Output must be one JSON object only, no markdown or prose outside JSON.",
    "JSON schema:",
    '{"thought":"...","action":{"type":"...", ...}}',
    "Allowed action.type values:",
    "tap, swipe, type, keyevent, launch_app, shell, run_script, wait, finish",
    "Rules:",
    "1) Coordinates must stay within screen bounds.",
    "2) Before typing, ensure focus is on the intended input field.",
    "3) If uncertain, prefer a small safe step or wait.",
    "4) Emit finish when the user task is done.",
    "5) Keep actions practical and deterministic.",
    "6) Use run_script only as fallback with a short deterministic script.",
    "7) Write thought and all action text fields in English.",
    "",
    "Available skills:",
    skillsSummary,
  ].join("\n");
}

export function buildUserPrompt(
  task: string,
  step: number,
  snapshot: ScreenSnapshot,
  history: string[],
): string {
  const recentHistory = history.slice(-8);
  return [
    `Task: ${task}`,
    `Step: ${step}`,
    "",
    "Screen:",
    JSON.stringify(
      {
        currentApp: snapshot.currentApp,
        width: snapshot.width,
        height: snapshot.height,
        deviceId: snapshot.deviceId,
        capturedAt: snapshot.capturedAt,
      },
      null,
      2,
    ),
    "",
    "Recent execution history:",
    recentHistory.length > 0 ? recentHistory.join("\n") : "(none)",
    "",
    "Return one JSON object with thought and action.",
  ].join("\n");
}
