# OpenPocket

OpenPocket is a local phone-use agent runtime built with Node.js and TypeScript:

`Telegram -> local gateway -> model inference -> adb -> Android Emulator`

## Documentation

The project now uses a hub-based documentation framework (inspired by OpenClaw docs structure):

- [Documentation Home](./docs/README.md)
- [Get Started](./docs/get-started/README.md)
- [Concepts](./docs/concepts/README.md)
- [Tools](./docs/tools/README.md)
- [Reference](./docs/reference/README.md)
- [Ops](./docs/ops/README.md)

For exact specs requested most often:

- [Prompt Templates](./docs/reference/prompt-templates.md)
- [Config Defaults](./docs/reference/config-defaults.md)
- [Session and Memory Formats](./docs/reference/session-memory-formats.md)
- [Skills](./docs/tools/skills.md)
- [Scripts](./docs/tools/scripts.md)

## Repository Structure

- `src/`: TypeScript source code (main runtime)
- `dist/`: build output
- `docs/`: documentation
- `test/`: Node test suite
- `apps/openpocket-menubar/`: native macOS menu bar control panel app

## Implemented Capabilities

- Emulator controls: `start/stop/status/list-avds/hide/show/screenshot`
- Agent action loop: `tap/swipe/type/keyevent/launch_app/shell/run_script/wait/finish`
- Model endpoint fallback: `chat/completions -> responses -> completions`
- Telegram gateway with chat/task auto routing and `/stop`
- Gateway run-loop: long-running process with `SIGUSR1` restart and graceful shutdown
- Heartbeat runner: periodic health logs + stuck-task warning
- Cron service: scheduled local tasks from `workspace/cron/jobs.json`
- Native macOS menu bar control panel:
  - menu bar icon without Dock icon
  - UI onboarding
  - permission and storage scope management
  - prompt file management
- Local session and daily memory persistence
- Step screenshot retention with max-count cleanup
- Skill loading from workspace/local/bundled sources
- Controlled script executor (allowlist + deny patterns + timeout + run artifacts)

## Quick Start

```bash
cd /Users/sergiochan/Documents/GitHub/phone-use-agent
npm install
npm run build
node dist/cli.js init
openpocket setup
```

If `openpocket` is not yet in your PATH in the current shell, run `node dist/cli.js setup` once.

`init` automatically installs a local launcher at `~/.local/bin/openpocket` (no `npm link` required).
If this is your first install, restart your shell (or run `source ~/.zshrc` / `source ~/.bashrc`) to use `openpocket ...` directly.

`setup`/`onboard` is an interactive onboarding flow (OpenClaw-style) that runs in the terminal:

- local runtime and data-handling user consent
- model profile selection (GPT-5.2/5.3 Codex, Claude Sonnet/Opus, AutoGLM, etc.)
- provider-specific API key setup based on selected model
- option prompts use Up/Down arrows + Enter (no numeric input)
- one-click emulator launch with guided manual Gmail sign-in for Play Store

## Environment Variables

```bash
export OPENAI_API_KEY="<your_openai_key>"
export OPENROUTER_API_KEY="<your_openrouter_key>"
export TELEGRAM_BOT_TOKEN="<your_telegram_bot_token>"
# optional
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export OPENPOCKET_HOME="$HOME/.openpocket"
export AUTOGLM_API_KEY="<optional_for_autoglm_profile>"
```

## CLI Commands

```bash
openpocket --help
openpocket init
openpocket install-cli
openpocket setup
openpocket onboard
openpocket config-show
openpocket emulator start
openpocket emulator status
openpocket emulator screenshot --out ~/Desktop/screen.png
openpocket skills list
openpocket script run --text "echo hello"
openpocket agent --model gpt-5.2-codex "Open Chrome and search weather"
openpocket gateway start
openpocket panel start
```

After running `init` once, you can usually run:

```bash
openpocket onboard
openpocket gateway start
```

`openpocket panel start` builds the native menu app (if needed), launches it in background, and returns the shell prompt.

## Tests

```bash
npm test
```
