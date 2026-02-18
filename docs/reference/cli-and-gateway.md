# CLI and Gateway Reference

## CLI Command Surface

```text
openpocket [--config <path>] init
openpocket [--config <path>] install-cli
openpocket [--config <path>] setup
openpocket [--config <path>] onboard
openpocket [--config <path>] config-show
openpocket [--config <path>] emulator status|start|stop|hide|show|list-avds|screenshot [--out <path>]
openpocket [--config <path>] agent [--model <name>] <task>
openpocket [--config <path>] skills list
openpocket [--config <path>] script run [--file <path> | --text <script>] [--timeout <sec>]
openpocket [--config <path>] gateway [start|telegram]
openpocket panel start
```

Local clone launcher:

```text
./openpocket <command>
```

## `panel start` (macOS)

- launches native menu bar control panel app (`apps/openpocket-menubar`)
- builds if needed, then starts app in background and returns control to terminal
- menu bar only (no Dock icon)
- includes UI onboarding, runtime controls, permissions, storage scope, and prompt management

## `init`

- loads/creates config
- saves normalized config
- ensures workspace bootstrap files and directories
- does not modify shell PATH automatically

## `install-cli`

- explicitly (re)installs local CLI launcher at `~/.local/bin/openpocket`
- adds `~/.local/bin` export line to `~/.zshrc` and `~/.bashrc` when missing

## `setup` / `onboard`

Interactive onboarding wizard (OpenClaw-style CLI flow):

- prints setup banner/logo
- presents required user consent (local runtime + cloud model boundary)
- selects default model profile (GPT, Claude, AutoGLM, etc.)
- configures provider-specific API key (env or local config.json)
- option prompts use Up/Down arrows + Enter (no numeric menu input)
- can start/show emulator and guide manual Gmail login for Play Store
- writes onboarding state to `state/onboarding.json`

## `agent`

- runs one task synchronously
- returns message and session path
- exit code `0` on success, `1` on failure

## `script run`

- executes script via `ScriptExecutor`
- prints status, run directory, and stdout/stderr
- exit code follows `result.ok`

## Telegram Commands

Supported commands:

- `/help`
- `/status`
- `/model [name]`
- `/startvm`
- `/stopvm`
- `/hidevm`
- `/showvm`
- `/screen`
- `/skills`
- `/clear`
- `/stop`
- `/cronrun <job-id>`
- `/run <task>`

Plain text behavior:

- auto-routed as task or chat
- task path starts `AgentRuntime`
- chat path replies conversationally

Gateway runtime behavior:

- long-running process loop with signal-aware shutdown/restart
- `SIGUSR1` restarts gateway in-process
- heartbeat runner logs health snapshots on interval
- cron service executes due jobs from `workspace/cron/jobs.json`

## Telegram Output Sanitization

Before sending model/task content back to chat:

- remove internal lines (`Session:`, `Auto skill:`, `Auto script:`)
- redact local screenshot and run directory paths
- collapse whitespace and truncate

This keeps user-facing chat concise and avoids exposing local filesystem details.
