# Quickstart

This page gets OpenPocket running locally with the current Node.js + TypeScript runtime.

## Prerequisites

- Node.js 20+
- Android SDK Emulator and platform-tools (`adb`)
- At least one Android AVD
- API key for your configured model profile

## Option A: npm package (global install)

After the package is published to npm:

```bash
npm install -g openpocket
openpocket init
openpocket onboard
```

## Option B: local clone (no global install)

```bash
cd /Users/sergiochan/Documents/GitHub/phone-use-agent
npm install
./openpocket init
./openpocket onboard
```

`./openpocket` uses `dist/cli.js` when present and falls back to `tsx src/cli.ts` in dev installs.

Default runtime home is `~/.openpocket`, unless `OPENPOCKET_HOME` is set.

For commands below, use `openpocket ...` for npm global install, or `./openpocket ...` for local clone.

Initialization creates:

- `config.json`
- `workspace/` with bootstrap files and directories
- `state/` for runtime state and emulator logs

`setup` creates/updates onboarding state in `state/onboarding.json` and guides:

- user consent
- model profile selection (GPT/Claude/AutoGLM profiles)
- provider-specific API key setup based on selected model
- option prompts use Up/Down arrows + Enter
- emulator wake-up + manual Gmail login for Play Store

Alternative (macOS GUI onboarding):

```bash
openpocket panel start
```

Then complete onboarding directly in the menu bar control panel UI.

If you explicitly want a user-local PATH command without npm global install:

```bash
./openpocket install-cli
```

## Required Environment Variables

```bash
export OPENAI_API_KEY="<your_key>"
export OPENROUTER_API_KEY="<your_key>"        # required if using Claude/OpenRouter profile
export TELEGRAM_BOT_TOKEN="<your_bot_token>"   # only for Telegram gateway
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"   # recommended
```

Optional:

```bash
export OPENPOCKET_HOME="$HOME/.openpocket"
export AUTOGLM_API_KEY="<optional>"
```

## Verify Local Commands

```bash
openpocket config-show
openpocket emulator status
openpocket emulator start
openpocket emulator screenshot --out ~/Desktop/openpocket-screen.png
openpocket skills list
openpocket script run --text "echo hello"
```

## Run One Agent Task

```bash
openpocket agent --model gpt-5.2-codex "Open Chrome and search weather"
```

Result includes:

- terminal summary message
- session file path (`workspace/sessions/session-*.md`)
- daily memory append in `workspace/memory/YYYY-MM-DD.md`

## Run Telegram Gateway

```bash
openpocket gateway start
```

Then chat with your bot and send `/help`.
