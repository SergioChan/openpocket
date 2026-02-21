import fs from "node:fs";
import path from "node:path";

import type { OpenPocketConfig } from "../types";
import { ensureDir, nowForFilename, nowIso, timeString, todayString } from "../utils/paths";

function doc(text: string): string {
  return `${text.trim()}\n`;
}

function jsonDoc(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
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
  "PROFILE_ONBOARDING.json": jsonDoc({
    version: 1,
    locales: {
      zh: {
        questions: {
          step1: "先做个简短初始化：我该怎么称呼你？如果你愿意，也可以一次告诉我你希望我叫什么和什么人设。",
          step2: "收到。那你希望我叫什么名字？",
          step3: [
            "最后一步：设定我的人设/语气。",
            "你可以直接描述，也可以选编号：",
            "1) 专业可靠：清晰、稳健、少废话",
            "2) 高效直给：结果导向、节奏快",
            "3) 温和陪伴：耐心解释、语气柔和",
            "4) 幽默轻松：轻松自然，但不影响执行",
            "回复示例：`2` 或 `专业可靠，简洁，必要时幽默`",
          ].join("\n"),
        },
        emptyAnswer: "请用一句话回答，我会帮你写入 profile。",
        onboardingSaved:
          "好，我已经写入 USER.md 和 IDENTITY.md。后续我会称呼你为“{userPreferredAddress}”，我的名字是“{assistantName}”，人设是“{assistantPersona}”。",
        noChange: "这些设定已经是当前值了，不需要改动。",
        updated: "已更新。{changes}。",
        changeJoiner: "；",
        changeTemplates: {
          userPreferredAddress: "我会称呼你为“{value}”",
          assistantName: "我的名字改为“{value}”",
          assistantPersona: "人设改为“{value}”",
        },
        fallbacks: {
          user: "用户",
          assistant: "OpenPocket",
          persona: "务实、冷静、可靠",
        },
        personaPresets: [
          {
            value: "专业可靠：清晰、稳健、少废话",
            aliases: ["1", "a", "选1", "方案1"],
          },
          {
            value: "高效直给：结果导向、节奏快",
            aliases: ["2", "b", "选2", "方案2"],
          },
          {
            value: "温和陪伴：耐心解释、语气柔和",
            aliases: ["3", "c", "选3", "方案3"],
          },
          {
            value: "幽默轻松：轻松自然，但不影响执行",
            aliases: ["4", "d", "选4", "方案4"],
          },
        ],
      },
      en: {
        questions: {
          step1:
            "Quick setup before we continue: how would you like me to address you? You can also tell me my name and persona in one message.",
          step2: "Great. What name would you like to call me?",
          step3: [
            "Final step: choose my persona/tone.",
            "You can describe it freely, or pick one preset:",
            "1) Professional & reliable: clear, stable, minimal fluff",
            "2) Fast & direct: action-oriented, concise, high tempo",
            "3) Warm & supportive: patient guidance, softer tone",
            "4) Light & humorous: relaxed tone while staying task-focused",
            "Reply example: `2` or `professional, concise, lightly humorous`",
          ].join("\n"),
        },
        emptyAnswer: "Please answer in one short sentence so I can save your profile.",
        onboardingSaved:
          "Done. I saved your profile to USER.md and IDENTITY.md. I will address you as \"{userPreferredAddress}\", and use \"{assistantName}\" with persona \"{assistantPersona}\".",
        noChange: "These profile settings are already up to date.",
        updated: "Updated. {changes}.",
        changeJoiner: "; ",
        changeTemplates: {
          userPreferredAddress: "I will address you as \"{value}\"",
          assistantName: "my name is now \"{value}\"",
          assistantPersona: "persona updated to \"{value}\"",
        },
        fallbacks: {
          user: "User",
          assistant: "OpenPocket",
          persona: "pragmatic, calm, and reliable",
        },
        personaPresets: [
          {
            value: "professional and reliable: clear, stable, minimal fluff",
            aliases: ["1", "a", "option1"],
          },
          {
            value: "fast and direct: action-oriented, concise, high tempo",
            aliases: ["2", "b", "option2"],
          },
          {
            value: "warm and supportive: patient guidance, softer tone",
            aliases: ["3", "c", "option3"],
          },
          {
            value: "light and humorous: relaxed tone while staying task-focused",
            aliases: ["4", "d", "option4"],
          },
        ],
      },
    },
  }),
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
