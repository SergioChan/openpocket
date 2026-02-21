# Operations Runbook

This runbook focuses on day-to-day operation of the current runtime.

## Daily Start

1. Ensure Android emulator dependencies are available.
2. Verify config and environment variables.
3. Run onboarding if first launch.
4. Start emulator and check booted device.
5. Start gateway or run tasks from CLI.
6. Validate human-auth readiness if remote approvals are enabled.

Commands:

```bash
openpocket config-show
openpocket onboard
openpocket emulator status
openpocket emulator start
openpocket gateway start
```

If the launcher is not in PATH yet, use `node dist/cli.js <command>`.

Human-auth readiness checks:

- `humanAuth.enabled` and `humanAuth.useLocalRelay` in config
- `humanAuth.relayBaseUrl` / `humanAuth.publicBaseUrl` populated after gateway boot
- if ngrok mode is enabled, verify `NGROK_AUTHTOKEN` (or config token) is available

## Remote Auth Validation (PermissionLab)

Use this playbook to verify end-to-end remote authorization before production use.

```bash
openpocket telegram whoami
openpocket test permission-app cases
openpocket test permission-app run --case camera --chat <telegram_chat_id>
```

Expected outcome:

1. PermissionLab deploys and launches.
2. Agent taps scenario button in emulator.
3. Telegram receives human-auth request with web link.
4. Phone approval/rejection resolves request.
5. Agent resumes and reports final result.

Recommended scenario matrix:

- `--case camera` for image delegation
- `--case location` for geo delegation
- `--case sms` or `--case 2fa` for text/code delegation

## Automated Agent E2E (Local)

Use the integration harness to validate natural-language planning -> emulator actions -> session assertions.

```bash
npm run build
OPENPOCKET_E2E_HOME=/tmp/openpocket-e2e-report node test/integration/docker-agent-e2e.mjs
```

Expected outcome:

1. mock model server starts locally
2. emulator boots and is detected by `adb`
3. task session contains expected action chain and `status: SUCCESS`
4. script exits with `E2E assertions passed`

This test uses a local mock model endpoint and does not require external model API keys.

## Monitoring

- gateway terminal logs show accepted task, step progress, and final status
- heartbeat logs are printed periodically and appended to `state/heartbeat.log`
- cron execution status is persisted in `state/cron-state.json`
- each task writes a session markdown file
- each task appends one line to daily memory file
- human-auth relay requests are persisted in `state/human-auth-relay/requests.json`
- uploaded auth artifacts are stored in `state/human-auth-artifacts/`
- delegation apply summaries are recorded in session `execution_result`

## Safe Stop

- use `/stop` in Telegram to request cancellation
- runtime checks stop flag between steps and finalizes session as failed with stop reason
- for blocked auth requests, use `/auth pending` and resolve with `/auth approve|reject`

## Debug Evidence Collection

When remote auth flow fails, collect:

- gateway log lines containing `[OpenPocket][human-auth]`
- latest session file under `workspace/sessions/`
- relay state file `state/human-auth-relay/requests.json`
- artifact directory listing under `state/human-auth-artifacts/`

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
