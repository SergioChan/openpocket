# Prompt Templates

This page documents the runtime prompt templates used by `src/agent/prompts.ts`.

## System Prompt (EN)

`buildSystemPrompt(skillsSummary, workspaceContext)` builds a sectioned prompt:

```text
You are OpenPocket, an Android phone-use agent running one tool step at a time.

## Tooling
- Tool catalog with argument expectations (tap, swipe, type_text, keyevent, launch_app, shell, run_script, request_human_auth, wait, finish)

## Planning Loop (mandatory every step)
1) active sub-goal
2) current screen inference
3) one deterministic next action
4) anti-loop strategy switch
5) complete finish criteria

## Execution Policy
- coordinate bounds
- focused typing
- wait usage
- run_script fallback policy
- deterministic action bias

## Human Authorization Policy
- request_human_auth capability set:
  camera, qr, microphone, voice, nfc, sms, 2fa, location, biometric, notification, contacts, calendar, files, oauth, payment, permission, unknown
- when history contains `delegation_template ...`, model should use that template to resume blocked UI flow deterministically

## Completion Policy
- finish as soon as goal is fully complete
- include full summary in finish.message

## Output Discipline
- exactly one tool call per step
- concise thought in tool args
- thought and all text fields in English

## Available Skills
<skillsSummary>

## Workspace Prompt Context (optional)
<workspaceContext>
```

Prompt mode support:

- `full`: complete policy sections (default)
- `minimal`: condensed rules for lower-noise automation
- `none`: only minimal safety instructions

## User Prompt (EN)

`buildUserPrompt(task, step, snapshot, history)` builds:

```text
One-step decision for Android task execution.
Task: <task>
Step: <step>

Screen metadata (coordinates use this scaled space):
{
  "currentApp": "...",
  "width": 1080,
  "height": 1920,
  "deviceId": "emulator-5554",
  "capturedAt": "<ISO8601>"
}

Recent execution history (oldest -> newest):
<last up to 8 lines or (none)>

Decision checklist:
1) active sub-goal
2) supporting evidence
3) anti-loop alternative
4) auth escalation if blocked
5) finish if done

Call exactly one tool now.
```

## Workspace Prompt Files

At runtime, OpenPocket loads these workspace files (trimmed with size limits) and injects them into system prompt context:

- `AGENTS.md`
- `BOOTSTRAP.md`
- `SOUL.md`
- `USER.md`
- `IDENTITY.md`
- `TOOLS.md`
- `HEARTBEAT.md`
- `MEMORY.md`

Optional hook:

- `.openpocket/bootstrap-context-hook.md` (injected before workspace files when present)

## Multimodal

Each step request includes the screenshot as base64 PNG in the model payload.

## Parsing and Fallback

- OpenPocket uses function/tool calling and maps tool name -> action.
- If tool args are invalid or action type is unknown, runtime normalizes to safe `wait`.
