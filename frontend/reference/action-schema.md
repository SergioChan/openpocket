# Action and Output Schema

OpenPocket action schema is a tagged union.

## Model Step Output

```ts
interface ModelStepOutput {
  thought: string;
  action: AgentAction;
  raw: string;
}
```

## AgentAction Types

```ts
type AgentAction =
  | { type: "tap"; x: number; y: number; reason?: string }
  | { type: "swipe"; x1: number; y1: number; x2: number; y2: number; durationMs?: number; reason?: string }
  | { type: "type"; text: string; reason?: string }
  | { type: "keyevent"; keycode: string; reason?: string }
  | { type: "launch_app"; packageName: string; reason?: string }
  | { type: "shell"; command: string; reason?: string }
  | { type: "run_script"; script: string; timeoutSec?: number; reason?: string }
  | {
      type: "request_human_auth";
      capability:
        | "camera"
        | "sms"
        | "2fa"
        | "location"
        | "biometric"
        | "notification"
        | "contacts"
        | "calendar"
        | "files"
        | "oauth"
        | "payment"
        | "permission"
        | "unknown";
      instruction: string;
      timeoutSec?: number;
      reason?: string;
    }
  | { type: "wait"; durationMs?: number; reason?: string }
  | { type: "finish"; message: string };
```

## Normalization Defaults

When fields are missing/invalid:

- `tap`: `x=0`, `y=0`
- `swipe`: coords default `0`, `durationMs=300`
- `type`: `text=""`
- `keyevent`: `keycode="KEYCODE_ENTER"`
- `launch_app`: `packageName=""`
- `shell`: `command=""`
- `run_script`: `script=""`, `timeoutSec=60`
- `request_human_auth`: `capability="unknown"`, `instruction="Human authorization is required to continue."`, `timeoutSec=300`
- `wait`: `durationMs=1000`
- `finish`: `message="Task finished."`
- unknown type -> `wait` (`durationMs=1000`)

## Execution Semantics

- `tap`: `adb shell input tap <x> <y>`
- `swipe`: `adb shell input swipe <x1> <y1> <x2> <y2> <durationMs>`
- `type`: tries `adb shell input text`; for non-ASCII or failure, falls back to clipboard + paste keyevent
- `keyevent`: `adb shell input keyevent <keycode>`
- `launch_app`: `adb shell monkey -p <package> -c android.intent.category.LAUNCHER 1`
- `shell`: executes command tokens after `adb shell`
- `run_script`: handled by `ScriptExecutor` in `AgentRuntime`
- `request_human_auth`: pauses task and waits for human approval through `HumanAuthBridge`
- `wait`: async sleep
- `finish`: marks successful task completion

## Current Screen Snapshot Schema

```ts
interface ScreenSnapshot {
  deviceId: string;
  currentApp: string;
  width: number;
  height: number;
  screenshotBase64: string;
  capturedAt: string;
}
```
