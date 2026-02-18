# Architecture

OpenPocket is a local phone-use agent runtime.

## Runtime Topology

```text
Telegram / CLI
      |
      v
Gateway / Command Router
      |
      v
AgentRuntime + HeartbeatRunner + CronService
  |        |         |          |
  v        v         v          v
ModelClient AdbRuntime SkillLoader ScriptExecutor
      |         |
      v         v
   LLM APIs   Android Emulator (adb)
```

## Main Components

- `AgentRuntime`: orchestrates task loop, step execution, progress callback, and session/memory persistence.
- `ModelClient`: builds multimodal prompts, calls model endpoint, parses and normalizes action output.
- `AdbRuntime`: device snapshot capture and action execution (`tap/swipe/type/...`).
- `EmulatorManager`: start/stop/status/screenshot and adb/emulator binary resolution.
- `WorkspaceStore`: creates session files and appends daily memory.
- `SkillLoader`: discovers markdown skills from workspace/local/bundled sources.
- `ScriptExecutor`: validates and executes `run_script` actions in a restricted model.
- `TelegramGateway`: command routing, chat/task decision path, and progress reporting.
- `HeartbeatRunner`: periodic liveness snapshots, busy-task watchdog warning, local heartbeat log.
- `CronService`: periodic scheduler reading `workspace/cron/jobs.json` and triggering due tasks.
- `runGatewayLoop`: long-running gateway process loop with graceful stop and `SIGUSR1` restart.

## Task Lifecycle

1. Create session markdown file.
2. Resolve model profile and API key.
3. For each step:
   - capture screen snapshot
   - optionally save local screenshot
   - request next action from model
   - execute action (`adb` or script executor)
   - append step to session and history buffer
   - send progress callback if enabled
4. Finish on `action.type=finish`, max steps, error, or user stop.
5. Finalize session and append a daily memory line.
6. Optionally send `KEYCODE_HOME` at task end.

## Model Endpoint Fallback

OpenPocket tries endpoints in fallback order and remembers the successful mode:

- task loop (`ModelClient`): `chat` -> `responses` -> `completions`
- chat assistant (`ChatAssistant`): `responses` -> `chat` -> `completions`

This improves compatibility with providers that do not implement every endpoint.

## Persistence Model

- Stateful files are local-first under `OPENPOCKET_HOME`.
- Task execution is auditable through session markdown and script run artifacts.
- Screenshot retention is bounded by configurable max count.
