# Operations Runbook

This runbook focuses on day-to-day operation of the current runtime.

## Daily Start

1. Ensure Android emulator dependencies are available.
2. Verify config and environment variables.
3. Run onboarding if first launch.
4. Start emulator and check booted device.
5. Start gateway or run tasks from CLI.

Commands:

```bash
openpocket config-show
openpocket onboard
openpocket emulator status
openpocket emulator start
openpocket gateway start
```

If the launcher is not in PATH yet, use `node dist/cli.js <command>`.

## Monitoring

- gateway terminal logs show accepted task, step progress, and final status
- heartbeat logs are printed periodically and appended to `state/heartbeat.log`
- cron execution status is persisted in `state/cron-state.json`
- each task writes a session markdown file
- each task appends one line to daily memory file

## Safe Stop

- use `/stop` in Telegram to request cancellation
- runtime checks stop flag between steps and finalizes session as failed with stop reason

## Data Retention

- screenshots: bounded by `screenshots.maxCount`
- sessions/memory/scripts: retained until manually cleaned

## Model Switch

Use Telegram `/model <name>` or edit `defaultModel` in config.

When changing model, verify:

- profile exists in `models`
- API key or env var is valid
- model supports required capabilities for your task

## Script Safety

- keep allowlist narrow in production
- disable script executor globally when not needed (`scriptExecutor.enabled=false`)
- inspect run artifacts under `workspace/scripts/runs` regularly
