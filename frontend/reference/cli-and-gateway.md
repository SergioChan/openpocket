# CLI and Gateway Reference

## CLI Commands

```text
openpocket [--config <path>] install-cli
openpocket [--config <path>] onboard
openpocket [--config <path>] config-show
openpocket [--config <path>] emulator status|start|stop|hide|show|list-avds|screenshot [--out <path>] [--device <id>]
openpocket [--config <path>] emulator tap --x <int> --y <int> [--device <id>]
openpocket [--config <path>] emulator type --text <text> [--device <id>]
openpocket [--config <path>] agent [--model <name>] <task>
openpocket [--config <path>] skills list
openpocket [--config <path>] script run [--file <path> | --text <script>] [--timeout <sec>]
openpocket [--config <path>] telegram setup|whoami
openpocket [--config <path>] gateway [start|telegram]
openpocket [--config <path>] dashboard start [--host <host>] [--port <port>]
openpocket [--config <path>] test permission-app [deploy|install|launch|reset|uninstall|task|run|cases] [--device <id>] [--clean] [--case <id>] [--send] [--chat <id>] [--model <name>]
openpocket [--config <path>] human-auth-relay start [--host <host>] [--port <port>] [--public-base-url <url>] [--api-key <key>] [--state-file <path>]
```

Deprecated aliases:

```text
openpocket [--config <path>] init
openpocket [--config <path>] setup
```

Local clone launcher:

```text
./openpocket <command>
```

## `onboard`

- loads or creates config
- writes normalized config
- ensures workspace bootstrap files and directories
- runs Android dependency doctor (auto-install on macOS when tools are missing)
- ensures Java 17+ for Android command line tools
- reuses existing local AVD when available
- installs CLI launcher on first onboard (`~/.local/bin/openpocket`)
- runs interactive onboarding wizard (consent/model/API key/Telegram/human-auth mode)

Interactive onboarding wizard flow:

- setup banner and consent
- default model profile and API key source
- Telegram token source and chat allowlist policy
- emulator wake-up and optional Play Store login guidance
- human-auth bridge mode (`disabled` / `LAN relay` / `local relay + ngrok`)
- writes onboarding state to `state/onboarding.json`

## `install-cli`

- explicitly (re)installs local CLI launcher at `~/.local/bin/openpocket`
- adds `~/.local/bin` export line to `~/.zshrc` and `~/.bashrc` when missing

## `dashboard start`

- starts local Web dashboard server
- default host/port from `config.dashboard`
- optional `--host` and `--port` override
- can auto-open browser when `dashboard.autoOpenBrowser=true`
- standalone mode only reports detected gateway process status

## `gateway start`

Startup behavior includes preflight sequence:

1. load config
2. validate Telegram token source (`config.telegram.botToken` or env)
3. ensure emulator is booted
4. ensure local dashboard is running
5. initialize gateway runtime
6. start services (Telegram polling, heartbeat, cron)

When human auth is enabled in config, gateway also auto-starts:

- local relay server (`humanAuth.useLocalRelay=true`)
- optional ngrok tunnel (`humanAuth.tunnel.provider=ngrok` and `humanAuth.tunnel.ngrok.enabled=true`)

## `telegram setup`

- interactive setup for Telegram bot token source (env or config)
- optional interactive allowlist update for `telegram.allowedChatIds`
- requires interactive terminal (TTY)

## `telegram whoami`

- prints current token source and allow policy
- prints allowlist summary
- fetches bot identity (`getMe`)
- discovers known chat IDs from recent updates (`getUpdates`)
- useful for validating `--chat <id>` before E2E tests

## `test permission-app`

Purpose:

- build and install a local Android test app (`OpenPocket PermissionLab`)
- trigger concrete permission/auth walls
- validate end-to-end human-auth delegation flow

Actions:

- `cases`: list supported scenarios
- `deploy` / `install`: build+install app (with or without launch)
- `launch`: launch app
- `reset`: clear app data and revoke requested permissions
- `uninstall`: remove app from emulator
- `task`: print scenario-specific Telegram task prompt
- `task --send` or `run`: execute full E2E scenario

Common options:

- `--case <id>`: scenario (`camera`, `location`, `sms`, `2fa`, etc.)
- `--chat <id>`: Telegram chat ID for notifications and auth link
- `--model <name>`: override model for this run
- `--device <id>`: target emulator device
- `--clean`: rebuild test app from clean build dir

Recommended E2E command:

```bash
openpocket test permission-app run --case camera --chat <telegram_chat_id>
```

## `human-auth-relay start`

- standalone relay server mode for debugging
- not required for normal gateway operation when local stack is enabled
- endpoint surface:
  - `POST /v1/human-auth/requests`
  - `GET /v1/human-auth/requests/<id>?pollToken=...`
  - `POST /v1/human-auth/requests/<id>/resolve`
  - `GET /human-auth/<id>?token=...`
  - `GET /healthz`

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
- `/reset`
- `/stop`
- `/restart`
- `/cronrun <job-id>`
- `/auth`
- `/auth pending`
- `/auth approve <request-id> [note]`
- `/auth reject <request-id> [note]`
- `/run <task>`

Plain text behavior:

- auto-routed as task or chat
- task path starts `AgentRuntime`
- chat path replies conversationally

Gateway runtime behavior:

- long-running process loop with signal-aware shutdown/restart
- `SIGUSR1` restarts gateway in-process
- heartbeat runner writes periodic health snapshots
- cron service executes due jobs from `workspace/cron/jobs.json`
- if `humanAuth.enabled=true` and `useLocalRelay=true`, gateway auto-starts local relay
- if ngrok is enabled, gateway auto-starts tunnel and exposes public auth URL

## Telegram Output Sanitization

Before sending model/task content back to chat:

- remove internal lines (`Session:`, `Auto skill:`, `Auto script:`)
- redact local screenshot and run directory paths
- collapse whitespace and truncate

This keeps user-facing chat concise and avoids leaking local filesystem details.

## Related Specs

- [Remote Human Authorization](../concepts/remote-human-authorization.md)
- [Action and Output Schema](./action-schema.md)
- [Session and Memory Formats](./session-memory-formats.md)
