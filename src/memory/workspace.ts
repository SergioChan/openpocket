import fs from "node:fs";
import path from "node:path";

import type { OpenPocketConfig } from "../types";
import { ensureDir, nowForFilename, nowIso, timeString, todayString } from "../utils/paths";

const BOOTSTRAP_FILES: Record<string, string> = {
  "AGENTS.md": "# AGENTS\n\nYou are OpenPocket, a local Android automation agent.\n",
  "SOUL.md": "# SOUL\n\nBe direct, reliable, and auditable.\n",
  "USER.md": "# USER\n\nUser preferences and constraints.\n",
  "IDENTITY.md": "# IDENTITY\n\nName: OpenPocket\n",
  "TOOLS.md": "# TOOLS\n\nList local tools and limits.\n",
  "HEARTBEAT.md": "# HEARTBEAT\n\n- Check gateway process\n- Check emulator online\n",
  "MEMORY.md": "# MEMORY\n\nLong-term memory summary.\n",
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
