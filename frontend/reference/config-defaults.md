# Config Defaults

This page is the source-of-truth documentation for current default config values and normalization behavior.

## Default Config JSON

```json
{
  "projectName": "OpenPocket",
  "workspaceDir": "<absolute OPENPOCKET_HOME>/workspace",
  "stateDir": "<absolute OPENPOCKET_HOME>/state",
  "defaultModel": "gpt-5.2-codex",
  "emulator": {
    "avdName": "OpenPocket_AVD",
    "androidSdkRoot": "<ANDROID_SDK_ROOT env or empty string>",
    "headless": false,
    "bootTimeoutSec": 180
  },
  "telegram": {
    "botToken": "",
    "botTokenEnv": "TELEGRAM_BOT_TOKEN",
    "allowedChatIds": [],
    "pollTimeoutSec": 25
  },
  "agent": {
    "maxSteps": 50,
    "loopDelayMs": 1200,
    "progressReportInterval": 1,
    "returnHomeOnTaskEnd": true,
    "lang": "en",
    "verbose": true,
    "deviceId": null
  },
  "screenshots": {
    "saveStepScreenshots": true,
    "directory": "<absolute OPENPOCKET_HOME>/state/screenshots",
    "maxCount": 400
  },
  "scriptExecutor": {
    "enabled": true,
    "timeoutSec": 60,
    "maxOutputChars": 6000,
    "allowedCommands": [
      "adb",
      "am",
      "pm",
      "input",
      "echo",
      "pwd",
      "ls",
      "cat",
      "grep",
      "rg",
      "sed",
      "awk",
      "bash",
      "sh",
      "node",
      "npm"
    ]
  },
  "heartbeat": {
    "enabled": true,
    "everySec": 30,
    "stuckTaskWarnSec": 600,
    "writeLogFile": true
  },
  "cron": {
    "enabled": true,
    "tickSec": 10,
    "jobsFile": "<absolute OPENPOCKET_HOME>/workspace/cron/jobs.json"
  },
  "models": {
    "gpt-5.2-codex": {
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-5.2-codex",
      "apiKey": "",
      "apiKeyEnv": "OPENAI_API_KEY",
      "maxTokens": 4096,
      "reasoningEffort": "medium",
      "temperature": null
    },
    "gpt-5.3-codex": {
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-5.3-codex",
      "apiKey": "",
      "apiKeyEnv": "OPENAI_API_KEY",
      "maxTokens": 4096,
      "reasoningEffort": "medium",
      "temperature": null
    },
    "claude-sonnet-4.6": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "model": "claude-sonnet-4.6",
      "apiKey": "",
      "apiKeyEnv": "OPENROUTER_API_KEY",
      "maxTokens": 4096,
      "reasoningEffort": "medium",
      "temperature": null
    },
    "claude-opus-4.6": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "model": "claude-opus-4.6",
      "apiKey": "",
      "apiKeyEnv": "OPENROUTER_API_KEY",
      "maxTokens": 4096,
      "reasoningEffort": "medium",
      "temperature": null
    },
    "autoglm-phone": {
      "baseUrl": "https://api.z.ai/api/paas/v4",
      "model": "autoglm-phone-multilingual",
      "apiKey": "",
      "apiKeyEnv": "AUTOGLM_API_KEY",
      "maxTokens": 3000,
      "reasoningEffort": null,
      "temperature": null
    }
  }
}
```

Notes:

- Runtime-generated `config.json` uses absolute paths.
- `openpocket.config.example.json` keeps `~` for readability, but loader resolves to absolute paths.

## Normalization

- `defaultModel` must exist in `models`.
- `agent.lang` is normalized to `en` (English-only runtime prompts).
- `agent.progressReportInterval` is clamped to at least `1`.
- `screenshots.maxCount` is clamped to at least `20`.
- `scriptExecutor.timeoutSec` is clamped to at least `1`.
- `scriptExecutor.maxOutputChars` is clamped to at least `1000`.
- `heartbeat.everySec` is clamped to at least `5`.
- `heartbeat.stuckTaskWarnSec` is clamped to at least `30`.
- `cron.tickSec` is clamped to at least `2`.
- `allowedChatIds` is coerced to numeric array with non-finite values removed.
- model `reasoningEffort` accepts only `low|medium|high|xhigh`, else `null`.
- model `temperature` is `null` if absent/invalid.

## Paths

- values starting with `~` are expanded to user home
- other paths are resolved to absolute paths

## API Keys

Per model profile:

1. use `apiKey` when non-empty
2. else use env var from `apiKeyEnv`
3. else key is missing

Missing key causes task start failure with a persisted failed session/memory entry.

## Legacy Keys

The loader maps legacy snake_case keys (top-level and nested) to camelCase keys before merge.

Examples:

- `default_model` -> `defaultModel`
- `max_steps` -> `maxSteps`
- `heartbeat_config` -> `heartbeat`
- `cron_config` -> `cron`
- `allowed_commands` -> `allowedCommands`
- `base_url` -> `baseUrl`
- `reasoning_effort` -> `reasoningEffort`
