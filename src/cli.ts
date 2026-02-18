#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { AgentRuntime } from "./agent/agent-runtime";
import { loadConfig, saveConfig } from "./config";
import { EmulatorManager } from "./device/emulator-manager";
import { TelegramGateway } from "./gateway/telegram-gateway";
import { runGatewayLoop } from "./gateway/run-loop";
import { SkillLoader } from "./skills/skill-loader";
import { ScriptExecutor } from "./tools/script-executor";
import { runSetupWizard } from "./onboarding/setup-wizard";
import { installCliShortcut } from "./install/cli-shortcut";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`OpenPocket CLI (Node.js + TypeScript)\n
Usage:
  openpocket [--config <path>] init
  openpocket [--config <path>] install-cli
  openpocket [--config <path>] setup
  openpocket [--config <path>] onboard
  openpocket [--config <path>] config-show
  openpocket [--config <path>] emulator status
  openpocket [--config <path>] emulator start
  openpocket [--config <path>] emulator stop
  openpocket [--config <path>] emulator hide
  openpocket [--config <path>] emulator show
  openpocket [--config <path>] emulator list-avds
  openpocket [--config <path>] emulator screenshot [--out <path>]
  openpocket [--config <path>] agent [--model <name>] <task>
  openpocket [--config <path>] skills list
  openpocket [--config <path>] script run [--file <path> | --text <script>] [--timeout <sec>]
  openpocket [--config <path>] gateway [start|telegram]
  openpocket panel start

Examples:
  openpocket init
  openpocket install-cli
  openpocket setup
  openpocket emulator start
  openpocket agent --model gpt-5.2-codex "Open Chrome and search weather"
  openpocket skills list
  openpocket script run --text "echo hello"
  openpocket gateway start
  openpocket panel start
`);
}

function takeOption(args: string[], name: string): { value: string | null; rest: string[] } {
  const out: string[] = [];
  let value: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name) {
      if (i + 1 >= args.length) {
        throw new Error(`Option ${name} requires a value.`);
      }
      value = args[i + 1];
      i += 1;
      continue;
    }
    out.push(args[i]);
  }

  return { value, rest: out };
}

async function runEmulatorCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const cfg = loadConfig(configPath);
  const emulator = new EmulatorManager(cfg);
  const sub = args[0];

  if (!sub) {
    throw new Error("Missing emulator subcommand.");
  }

  if (sub === "status") {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(emulator.status(), null, 2));
    return 0;
  }
  if (sub === "start") {
    // eslint-disable-next-line no-console
    console.log(await emulator.start());
    return 0;
  }
  if (sub === "stop") {
    // eslint-disable-next-line no-console
    console.log(emulator.stop());
    return 0;
  }
  if (sub === "hide") {
    // eslint-disable-next-line no-console
    console.log(emulator.hideWindow());
    return 0;
  }
  if (sub === "show") {
    // eslint-disable-next-line no-console
    console.log(emulator.showWindow());
    return 0;
  }
  if (sub === "list-avds") {
    for (const avd of emulator.listAvds()) {
      // eslint-disable-next-line no-console
      console.log(avd);
    }
    return 0;
  }
  if (sub === "screenshot") {
    const { value: outPath } = takeOption(args.slice(1), "--out");
    // eslint-disable-next-line no-console
    console.log(emulator.captureScreenshot(outPath ?? undefined));
    return 0;
  }

  throw new Error(`Unknown emulator subcommand: ${sub}`);
}

async function runAgentCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const { value: model, rest } = takeOption(args, "--model");
  const task = rest.join(" ").trim();
  if (!task) {
    throw new Error("Missing task. Usage: openpocket agent [--model <name>] <task>");
  }

  const cfg = loadConfig(configPath);
  const agent = new AgentRuntime(cfg);
  const result = await agent.runTask(task, model ?? undefined);
  // eslint-disable-next-line no-console
  console.log(result.message);
  // eslint-disable-next-line no-console
  console.log(`Session: ${result.sessionPath}`);
  return result.ok ? 0 : 1;
}

async function runGatewayCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const sub = (args[0] ?? "start").trim();
  if (sub !== "start" && sub !== "telegram") {
    throw new Error(`Unknown gateway subcommand: ${sub}. Use: gateway start`);
  }

  await runGatewayLoop({
    start: async () => {
      const cfg = loadConfig(configPath);
      const gateway = new TelegramGateway(cfg);
      await gateway.start();
      return {
        stop: async (reason?: string) => {
          await gateway.stop(reason ?? "run-loop-stop");
        },
      };
    },
  });
  return 0;
}

async function runSetupCommand(configPath: string | undefined): Promise<number> {
  const cfg = loadConfig(configPath);
  saveConfig(cfg);
  await runSetupWizard(cfg);
  return 0;
}

async function runInstallCliCommand(): Promise<number> {
  const shortcut = installCliShortcut();
  // eslint-disable-next-line no-console
  console.log(`CLI launcher installed: ${shortcut.commandPath}`);
  if (shortcut.shellRcUpdated.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Updated shell rc: ${shortcut.shellRcUpdated.join(", ")}`);
  }
  if (!shortcut.binDirAlreadyInPath || shortcut.shellRcUpdated.length > 0) {
    // eslint-disable-next-line no-console
    console.log("Restart shell (or `source ~/.zshrc` / `source ~/.bashrc`) to use `openpocket` directly.");
  }
  return 0;
}

async function runSkillsCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const sub = args[0];
  if (sub !== "list") {
    throw new Error(`Unknown skills subcommand: ${sub ?? "(missing)"}`);
  }

  const cfg = loadConfig(configPath);
  const loader = new SkillLoader(cfg);
  const skills = loader.loadAll();
  if (skills.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No skills loaded.");
    return 0;
  }

  for (const skill of skills) {
    // eslint-disable-next-line no-console
    console.log(`[${skill.source}] ${skill.name} (${skill.id})`);
    // eslint-disable-next-line no-console
    console.log(`  ${skill.description}`);
    // eslint-disable-next-line no-console
    console.log(`  ${skill.path}`);
  }
  return 0;
}

async function runScriptCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const sub = args[0];
  if (sub !== "run") {
    throw new Error(`Unknown script subcommand: ${sub ?? "(missing)"}`);
  }

  const cfg = loadConfig(configPath);
  const { value: filePath, rest: afterFile } = takeOption(args.slice(1), "--file");
  const { value: textScript, rest: afterText } = takeOption(afterFile, "--text");
  const { value: timeout, rest } = takeOption(afterText, "--timeout");
  if (rest.length > 0) {
    throw new Error(`Unexpected arguments: ${rest.join(" ")}`);
  }

  let script = "";
  if (filePath) {
    script = fs.readFileSync(filePath, "utf-8");
  } else if (textScript) {
    script = textScript;
  } else {
    throw new Error("Missing script input. Use --file <path> or --text <script>.");
  }

  const executor = new ScriptExecutor(cfg);
  const result = await executor.execute(
    script,
    timeout && Number.isFinite(Number(timeout)) ? Number(timeout) : undefined,
  );

  // eslint-disable-next-line no-console
  console.log(`ok=${result.ok} exitCode=${result.exitCode} timedOut=${result.timedOut}`);
  // eslint-disable-next-line no-console
  console.log(`runDir=${result.runDir}`);
  if (result.stdout.trim()) {
    // eslint-disable-next-line no-console
    console.log(`stdout:\n${result.stdout}`);
  }
  if (result.stderr.trim()) {
    // eslint-disable-next-line no-console
    console.log(`stderr:\n${result.stderr}`);
  }
  return result.ok ? 0 : 1;
}

async function runPanelCommand(configPath: string | undefined, args: string[]): Promise<number> {
  const sub = (args[0] ?? "start").trim();
  if (sub !== "start") {
    throw new Error(`Unknown panel subcommand: ${sub}. Use: panel start`);
  }

  if (process.platform !== "darwin") {
    throw new Error("OpenPocket menu bar panel is supported on macOS only.");
  }

  const panelDir = path.resolve(__dirname, "..", "apps", "openpocket-menubar");
  const buildScript = path.join(panelDir, "scripts", "build.sh");
  const runScript = path.join(panelDir, "scripts", "run.sh");
  if (!fs.existsSync(runScript) || !fs.existsSync(buildScript)) {
    throw new Error(`Menu bar app launcher not found: ${runScript}`);
  }

  const buildResult = spawnSync("/usr/bin/env", ["bash", buildScript], {
    stdio: "inherit",
    cwd: panelDir,
  });
  if (buildResult.error) {
    throw buildResult.error;
  }
  if ((buildResult.status ?? 1) !== 0) {
    return buildResult.status ?? 1;
  }

  const appBinary = path.join(panelDir, ".build", "debug", "OpenPocketMenuBar");
  if (!fs.existsSync(appBinary)) {
    throw new Error(`Built menu bar app not found: ${appBinary}`);
  }

  const env = { ...process.env };
  if (configPath?.trim()) {
    env.OPENPOCKET_CONFIG_PATH = path.resolve(configPath.trim());
  }

  const child = spawn(appBinary, [], {
    cwd: panelDir,
    detached: true,
    stdio: "ignore",
    env,
  });
  child.unref();
  // eslint-disable-next-line no-console
  console.log(`OpenPocket Control Panel started (pid=${child.pid ?? "unknown"}).`);
  return 0;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { value: configPath, rest } = takeOption(argv, "--config");

  if (rest.length === 0 || rest[0] === "-h" || rest[0] === "--help") {
    printHelp();
    return 0;
  }

  const command = rest[0];

  if (command === "init") {
    const cfg = loadConfig(configPath ?? undefined);
    saveConfig(cfg);
    // eslint-disable-next-line no-console
    console.log(`OpenPocket initialized.\nConfig: ${cfg.configPath}`);
    return 0;
  }

  if (command === "install-cli") {
    return runInstallCliCommand();
  }

  if (command === "config-show") {
    const cfg = loadConfig(configPath ?? undefined);
    // eslint-disable-next-line no-console
    console.log(fs.readFileSync(cfg.configPath, "utf-8").trim());
    return 0;
  }

  if (command === "emulator") {
    return runEmulatorCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "agent") {
    return runAgentCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "gateway") {
    return runGatewayCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "panel") {
    return runPanelCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "skills") {
    return runSkillsCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "script") {
    return runScriptCommand(configPath ?? undefined, rest.slice(1));
  }

  if (command === "setup" || command === "onboard") {
    return runSetupCommand(configPath ?? undefined);
  }

  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`OpenPocket error: ${(error as Error).message}`);
      process.exitCode = 1;
    });
}
