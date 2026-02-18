# Troubleshooting

## `adb not found`

- install Android platform-tools
- set `ANDROID_SDK_ROOT`
- verify `adb` in `PATH`

## `Android emulator binary not found`

- install Android Emulator via SDK manager
- configure `emulator.androidSdkRoot` or `ANDROID_SDK_ROOT`

## `No AVD found`

- run `node dist/cli.js emulator list-avds`
- create an AVD if list is empty
- set `emulator.avdName` to a valid entry

## `Missing API key for model`

- set `models.<profile>.apiKey` or matching env var (`apiKeyEnv`)
- verify current `defaultModel` profile

## Task keeps failing with invalid model output

- inspect session file for raw thought/action progression
- verify model supports requested endpoint and multimodal input
- switch model profile and retry

## Telegram bot does not respond

- validate token (`telegram.botToken` or env)
- check allowed chat IDs (`telegram.allowedChatIds`)
- ensure gateway process is running

## Scripts blocked unexpectedly

- inspect `result.json` and `stderr.log` in run directory
- confirm command is in `scriptExecutor.allowedCommands`
- check deny patterns (for example `sudo`, `shutdown`, `rm -rf /`)
