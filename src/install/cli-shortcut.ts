import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface InstallCliShortcutOptions {
  cliPath?: string;
  homeDir?: string;
  shellRcPaths?: string[];
  commandName?: string;
}

export interface InstallCliShortcutResult {
  commandPath: string;
  binDir: string;
  cliPath: string;
  shellRcUpdated: string[];
  binDirAlreadyInPath: boolean;
}

function shellSingleQuote(input: string): string {
  return `'${input.replace(/'/g, `'\"'\"'`)}'`;
}

function ensurePathLine(shellRcPath: string, exportLine: string): boolean {
  const marker = "# OpenPocket CLI";
  const lineExists = (body: string) =>
    body.includes(exportLine) || body.includes(`${marker}\n${exportLine}`);

  if (!fs.existsSync(shellRcPath)) {
    fs.writeFileSync(shellRcPath, "", "utf-8");
  }
  const body = fs.readFileSync(shellRcPath, "utf-8");
  if (lineExists(body)) {
    return false;
  }

  const suffix = body.endsWith("\n") || body.length === 0 ? "" : "\n";
  fs.appendFileSync(shellRcPath, `${suffix}${marker}\n${exportLine}\n`, "utf-8");
  return true;
}

function defaultCliPath(): string {
  // dist/install/cli-shortcut.js -> dist/cli.js
  return path.resolve(__dirname, "..", "cli.js");
}

export function installCliShortcut(
  options: InstallCliShortcutOptions = {},
): InstallCliShortcutResult {
  const homeDir = path.resolve(options.homeDir ?? os.homedir());
  const commandName = options.commandName ?? "openpocket";
  const cliPath = path.resolve(options.cliPath ?? defaultCliPath());
  const binDir = path.join(homeDir, ".local", "bin");
  const commandPath = path.join(binDir, commandName);
  fs.mkdirSync(binDir, { recursive: true });

  const launcher = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `exec node ${shellSingleQuote(cliPath)} "$@"`,
    "",
  ].join("\n");
  fs.writeFileSync(commandPath, launcher, { encoding: "utf-8", mode: 0o755 });
  fs.chmodSync(commandPath, 0o755);

  const exportLine = 'export PATH="$HOME/.local/bin:$PATH"';
  const shellRcPaths =
    options.shellRcPaths ?? [path.join(homeDir, ".zshrc"), path.join(homeDir, ".bashrc")];
  const shellRcUpdated: string[] = [];
  for (const rcPath of shellRcPaths) {
    try {
      if (ensurePathLine(rcPath, exportLine)) {
        shellRcUpdated.push(rcPath);
      }
    } catch {
      // Best effort only; launcher still works if PATH is already configured.
    }
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
  const binDirAlreadyInPath = pathEntries.includes(path.resolve(binDir));

  return {
    commandPath,
    binDir,
    cliPath,
    shellRcUpdated,
    binDirAlreadyInPath,
  };
}
