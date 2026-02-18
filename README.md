# OpenPocket

[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-0f766e.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-2563eb.svg)](https://www.typescriptlang.org/)
[![Runtime](https://img.shields.io/badge/runtime-Local--first-0f172a.svg)](#architecture)
[![Docs](https://img.shields.io/badge/docs-VitePress-0a9396.svg)](./docs/index.md)

OpenPocket is a local-first phone-use agent runtime for Android automation.

It combines a practical CLI, a Telegram gateway, model-driven planning, and adb-based action execution with auditable persistence:

`Telegram / CLI -> Gateway -> Agent Runtime -> Model Client -> adb -> Android Emulator`

## Why OpenPocket

- **Local execution boundary**: device control stays local through adb.
- **Auditable runs**: sessions, daily memory, screenshots, and script artifacts are persisted.
- **Provider flexibility**: model endpoint fallback and profile-based config.
- **Operator-friendly**: setup wizard, heartbeat, cron scheduler, and controlled run-loop.
- **macOS control panel**: optional native menu bar app for operational control.

## Key Capabilities

- Emulator control: `start`, `stop`, `status`, `list-avds`, `hide`, `show`, `screenshot`
- Agent actions: `tap`, `swipe`, `type`, `keyevent`, `launch_app`, `shell`, `run_script`, `wait`, `finish`
- Gateway modes: Telegram polling, chat/task routing, `/stop`, `/cronrun`, `/run`
- Runtime services: heartbeat monitoring, cron job execution, signal-aware gateway restarts
- Script safety: allowlist, deny patterns, timeout, output limits, and run archives
- Workspace memory: per-task session files + daily memory timeline

## Architecture

```mermaid
flowchart LR
  U["User / Telegram"] --> G["OpenPocket Gateway"]
  G --> A["Agent Runtime"]
  A --> M["Model Client"]
  A --> D["ADB Runtime"]
  A --> S["Script Executor"]
  D --> E["Android Emulator"]
  A --> W["Workspace Store"]
  W --> SS["sessions/*.md"]
  W --> MM["memory/YYYY-MM-DD.md"]
  W --> RR["scripts/runs/*"]
```

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Android SDK emulator + platform-tools (`adb`)
- At least one Android AVD
- Model API key (for your selected model profile)
- Telegram bot token (if using gateway)

### 2. Option A: Use the npm package (no source code required)

```bash
npm install -g openpocket
openpocket init
openpocket onboard
```

If you use the native macOS panel, install the release package from:

- [OpenPocket Releases](https://github.com/SergioChan/openpocket/releases)

Then start the panel:

```bash
openpocket panel start
```

### 3. Option B: Use a local source clone (for contributors)

```bash
git clone git@github.com:SergioChan/openpocket.git
cd openpocket
npm install
npm run build
./openpocket init
./openpocket onboard
```

`./openpocket` runs `dist/cli.js` when present and falls back to `tsx src/cli.ts` in local dev installs.

### 4. Start runtime

For npm package install:

```bash
openpocket emulator start
openpocket gateway start
```

For local source clone:

```bash
./openpocket emulator start
./openpocket gateway start
```

### 5. Optional: install a user-local command

```bash
./openpocket install-cli
```

This installs `~/.local/bin/openpocket` and updates shell rc files when needed.

## Configuration

Primary config file:

- `~/.openpocket/config.json` (or `OPENPOCKET_HOME/config.json`)

Example config template:

- [`openpocket.config.example.json`](./openpocket.config.example.json)

Common environment variables:

```bash
export OPENAI_API_KEY="<your_openai_key>"
export OPENROUTER_API_KEY="<your_openrouter_key>"
export AUTOGLM_API_KEY="<your_autoglm_key>"
export TELEGRAM_BOT_TOKEN="<your_telegram_bot_token>"
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export OPENPOCKET_HOME="$HOME/.openpocket"
```

## CLI Surface

Command prefix by install mode:

- npm package install: use `openpocket ...`
- local source clone: use `./openpocket ...` (or `openpocket ...` after `install-cli`)

```bash
./openpocket --help
./openpocket init
./openpocket install-cli
./openpocket setup
./openpocket onboard
./openpocket config-show
./openpocket emulator start
./openpocket emulator status
./openpocket agent --model gpt-5.2-codex "Open Chrome and search weather"
./openpocket script run --text "echo hello"
./openpocket skills list
./openpocket gateway start
./openpocket panel start
```

`openpocket panel start` on macOS uses this order:

1. Open an already-installed panel app from `/Applications` or `~/Applications`.
2. If running from a source clone with `apps/openpocket-menubar`, build and launch from source.
3. If neither is available (typical npm install), open GitHub Releases and guide PKG installation.

## Documentation

### Where the frontend is

The documentation frontend is implemented in this repository:

- Site source: [`/docs`](./docs)
- VitePress config: [`/docs/.vitepress/config.mjs`](./docs/.vitepress/config.mjs)
- Custom homepage: [`/docs/index.md`](./docs/index.md)
- Custom theme styles: [`/docs/.vitepress/theme/custom.css`](./docs/.vitepress/theme/custom.css)

### Documentation Website

- Start local docs server:

```bash
npm run docs:dev
```

- Build static docs:

```bash
npm run docs:build
```

- Build for GitHub Pages (project-path base):

```bash
npm run docs:build:pages
```

- Preview built docs:

```bash
npm run docs:preview
```

### Deployment options

- GitHub Pages workflow: [`.github/workflows/deploy-docs-pages.yml`](./.github/workflows/deploy-docs-pages.yml)
- Vercel config: [`vercel.json`](./vercel.json)
- Deployment guide: [`/docs/get-started/deploy-docs.md`](./docs/get-started/deploy-docs.md)

Expected GitHub Pages URL for this repo:

- `https://sergiochan.github.io/openpocket/`

### Docs entry points

- [Docs Home](./docs/index.md)
- [Documentation Hubs](./docs/hubs.md)
- [Get Started](./docs/get-started/README.md)
- [Reference](./docs/reference/README.md)
- [Ops Runbook](./docs/ops/runbook.md)

## Repository Structure

- [`/src`](./src): runtime source code (agent, gateway, device, tools, onboarding)
- [`/docs`](./docs): project documentation + VitePress site source
- [`/test`](./test): runtime contract and integration tests
- [`/apps/openpocket-menubar`](./apps/openpocket-menubar): native macOS menu bar control panel
- [`/dist`](./dist): build output

## Development

Run checks:

```bash
npm run check
npm test
```

## Contributing

- Keep code, docs, comments, and tests in English.
- Prefer behavior-driven changes with matching tests.
- Document new runtime capabilities under `/docs` in the relevant hub.

## Security and Safety Notes

- `run_script` execution is guarded by an allowlist and deny patterns.
- Timeout and output truncation are enforced per script run.
- Local paths are sanitized/redacted in Telegram-facing outputs.

## License

License file is not finalized yet for this repository.
Add a license before public distribution.
