import fs from "node:fs";
import path from "node:path";

import type { OpenPocketConfig } from "../types";
import { ensureDir, nowForFilename, nowIso, timeString, todayString } from "../utils/paths";

function doc(text: string): string {
  return `${text.trim()}\n`;
}

const BOOTSTRAP_FILES: Record<string, string> = {
  "AGENTS.md": doc(`
# AGENTS

This workspace defines how OpenPocket should behave.

## Session Start Checklist

Before executing tasks, read:

1. SOUL.md (behavior and tone)
2. USER.md (user-specific preferences)
3. IDENTITY.md (agent identity)
4. TOOLS.md (local environment notes)
5. HEARTBEAT.md (background checklist)
6. MEMORY.md (long-term memory)
7. memory/YYYY-MM-DD.md for today and yesterday if present

## Task Execution Contract

For each step:

1. Identify the active sub-goal.
2. Choose one deterministic next action.
3. Validate progress from screenshot + history.
4. If the last 2 attempts did not progress, switch strategy.
5. Finish only when the user goal is fully complete.

When information gathering is required, keep running notes in thought and include complete findings in finish.

## Human Authorization

Use request_human_auth when blocked by sensitive checkpoints, including:
camera, qr, microphone, voice, nfc, sms, 2fa, location, biometric, payment, oauth, permission dialogs.

Human instructions must be explicit and directly executable.

## Safety Boundaries

- Do not perform destructive actions unless the user clearly asked.
- Prefer reversible actions when possible.
- Do not expose private data outside the current task scope.
- If uncertain, ask or take a minimal safe step.

## Memory Discipline

- Record important outcomes in memory/YYYY-MM-DD.md.
- Keep MEMORY.md concise and durable (preferences, recurring constraints, stable facts).
- Update memory files after meaningful tasks, not every trivial action.

## Working Style

- Be concise, accurate, and auditable.
- Avoid repetitive loops.
- Prefer practical progress over speculative actions.
`),
  "SOUL.md": doc(`
# SOUL

## Core Principles

- Be useful, direct, and calm.
- Be honest about uncertainty.
- Favor evidence over assumptions.
- Respect user intent and boundaries.

## Collaboration Style

- Keep explanations short unless detail is needed.
- Surface risks before irreversible actions.
- Escalate blockers clearly.

## Quality Bar

- Do not pretend success; verify.
- Do not hide failures; report and recover.
- Do not drift from the task; stay goal-focused.
`),
  "USER.md": doc(`
# USER

Record user-specific preferences and constraints.

## Profile

- Name:
- Preferred form of address:
- Timezone:
- Language preference:

## Interaction Preferences

- Verbosity:
- Risk tolerance:
- Confirmation preference for external actions:

## Task Preferences

- Preferred apps/services:
- Avoided apps/services:
- Recurring goals:

## Notes

- Add durable preferences here.
- Keep sensitive details minimal.
`),
  "IDENTITY.md": doc(`
# IDENTITY

## Agent Identity

- Name: OpenPocket
- Role: Android phone-use automation agent
- Primary objective: execute user tasks safely and efficiently

## Behavioral Defaults

- Language for model thought/action text: English
- Planning style: sub-goal driven, one deterministic step at a time
- Escalation trigger: request_human_auth when real-device authorization is required
`),
  "TOOLS.md": doc(`
# TOOLS

Environment-specific notes for this workspace.

## Device and Runtime

- Preferred device id:
- Common screen resolution:
- Stable network assumptions:

## App Notes

- Frequently used package names:
- Login/account caveats:
- Known flaky screens or flows:

## Automation Notes

- Safe keyevents:
- Preferred fallback commands/scripts:
- Known anti-patterns to avoid:
`),
  "HEARTBEAT.md": doc(`
# HEARTBEAT

Background checks to run periodically when heartbeat is enabled.

## Cadence

- Run light checks first.
- Skip noisy checks if there is no signal of change.

## Checklist

- Gateway process healthy
- Emulator/device online
- Recent task failures requiring attention
- Queue/backlog requiring user notification

## Reporting Rule

- If no action is needed, report HEARTBEAT_OK.
- If action is needed, report only the actionable summary.
`),
  "MEMORY.md": doc(`
# MEMORY

Long-term, curated memory for durable context.

## Store Here

- Stable user preferences
- Reusable constraints and policies
- Repeated failure patterns and fixes
- Important environment facts

## Do Not Store Here

- Ephemeral step-by-step logs
- Large raw dumps
- Secrets unless explicitly requested

## Maintenance

- Keep entries concise and timestamped when relevant.
- Remove stale or contradicted items.
- Sync with daily memory files when new durable facts appear.
`),
};

export function ensureWorkspaceBootstrap(workspaceDir: string): void {
  ensureDir(workspaceDir);
  ensureDir(path.join(workspaceDir, "memory"));
  ensureDir(path.join(workspaceDir, "sessions"));
  ensureDir(path.join(workspaceDir, "skills"));
  ensureDir(path.join(workspaceDir, "scripts"));
  ensureDir(path.join(workspaceDir, "scripts", "runs"));
  ensureDir(path.join(workspaceDir, "cron"));

  for (const [name, content] of Object.entries(BOOTSTRAP_FILES)) {
    const filePath = path.join(workspaceDir, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, "utf-8");
    }
  }

  const memoryReadme = path.join(workspaceDir, "memory", "README.md");
  if (!fs.existsSync(memoryReadme)) {
    fs.writeFileSync(memoryReadme, "# Daily Memory\n\nOne file per date.\n", "utf-8");
  }

  const skillsReadme = path.join(workspaceDir, "skills", "README.md");
  if (!fs.existsSync(skillsReadme)) {
    fs.writeFileSync(
      skillsReadme,
      "# Skills\n\nDrop skill markdown files (*.md) here. Workspace skills take highest priority.\n",
      "utf-8",
    );
  }

  const scriptsReadme = path.join(workspaceDir, "scripts", "README.md");
  if (!fs.existsSync(scriptsReadme)) {
    fs.writeFileSync(
      scriptsReadme,
      "# Scripts\n\nStore automation helper scripts here. Runtime execution logs are under scripts/runs/.\n",
      "utf-8",
    );
  }

  const cronReadme = path.join(workspaceDir, "cron", "README.md");
  if (!fs.existsSync(cronReadme)) {
    fs.writeFileSync(
      cronReadme,
      [
        "# Cron Jobs",
        "",
        "Edit `jobs.json` to configure scheduled tasks.",
        "",
        "Schema:",
        "- id: unique job id",
        "- name: display name",
        "- enabled: true/false",
        "- everySec: interval in seconds",
        "- task: natural-language task text",
        "- chatId: Telegram chat id (optional, nullable)",
        "- model: model profile id (optional, nullable)",
        "- runOnStartup: run immediately when gateway starts",
      ].join("\n"),
      "utf-8",
    );
  }

  const cronJobs = path.join(workspaceDir, "cron", "jobs.json");
  if (!fs.existsSync(cronJobs)) {
    fs.writeFileSync(
      cronJobs,
      `${JSON.stringify(
        {
          jobs: [
            {
              id: "heartbeat-status",
              name: "Hourly Status Check",
              enabled: false,
              everySec: 3600,
              task: "Open Settings and verify network connectivity status.",
              chatId: null,
              model: null,
              runOnStartup: false,
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
  }
}

export interface SessionHandle {
  id: string;
  path: string;
}

export class WorkspaceStore {
  private readonly workspaceDir: string;

  constructor(config: OpenPocketConfig) {
    this.workspaceDir = config.workspaceDir;
    ensureWorkspaceBootstrap(this.workspaceDir);
  }

  createSession(task: string, modelProfile: string, modelName: string): SessionHandle {
    const id = nowForFilename();
    const sessionPath = path.join(this.workspaceDir, "sessions", `session-${id}.md`);

    const body = [
      "# OpenPocket Session",
      "",
      `- id: ${id}`,
      `- started_at: ${nowIso()}`,
      `- model_profile: ${modelProfile}`,
      `- model_name: ${modelName}`,
      "",
      "## Task",
      "",
      task,
      "",
      "## Steps",
      "",
    ].join("\n");

    fs.writeFileSync(sessionPath, `${body}\n`, "utf-8");
    return { id, path: sessionPath };
  }

  appendStep(session: SessionHandle, stepNo: number, thought: string, actionJson: string, result: string): void {
    const block = [
      `### Step ${stepNo}`,
      "",
      `- at: ${nowIso()}`,
      "- thought:",
      "```text",
      thought || "(empty)",
      "```",
      "- action:",
      "```json",
      actionJson,
      "```",
      "- execution_result:",
      "```text",
      result,
      "```",
      "",
    ].join("\n");

    fs.appendFileSync(session.path, block, "utf-8");
  }

  finalizeSession(session: SessionHandle, ok: boolean, message: string): void {
    const status = ok ? "SUCCESS" : "FAILED";
    const block = [
      "## Final",
      "",
      `- status: ${status}`,
      `- ended_at: ${nowIso()}`,
      "",
      "### Message",
      "",
      message,
      "",
    ].join("\n");

    fs.appendFileSync(session.path, block, "utf-8");
  }

  appendDailyMemory(modelProfile: string, task: string, ok: boolean, message: string): string {
    const date = todayString();
    const filePath = path.join(this.workspaceDir, "memory", `${date}.md`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `# Memory ${date}\n\n`, "utf-8");
    }

    const status = ok ? "OK" : "FAIL";
    const compact = message.trim().replace(/\s+/g, " ").slice(0, 400);
    fs.appendFileSync(
      filePath,
      `- [${timeString()}] [${status}] [${modelProfile}] task: ${task} | result: ${compact}\n`,
      "utf-8",
    );
    return filePath;
  }
}
