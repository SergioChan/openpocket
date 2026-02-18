# Sessions and Memory

OpenPocket persists execution traces into markdown files under workspace.

## Workspace Bootstrap

On onboard/load (or legacy init), OpenPocket ensures these directories:

- `workspace/memory`
- `workspace/sessions`
- `workspace/skills`
- `workspace/scripts`
- `workspace/scripts/runs`

And bootstrap files if missing:

- `AGENTS.md`
- `SOUL.md`
- `USER.md`
- `IDENTITY.md`
- `TOOLS.md`
- `HEARTBEAT.md`
- `MEMORY.md`

## Session File Lifecycle

For each task, runtime creates:

- `workspace/sessions/session-<timestamp>.md`

During run, each step appends:

- thought text block
- action JSON block
- execution result block

At end, runtime appends final status block (`SUCCESS` or `FAILED`) and message.

See exact template in [Session and Memory Formats](../reference/session-memory-formats.md).

## Daily Memory

Runtime appends one compact line per task into:

- `workspace/memory/YYYY-MM-DD.md`

Line includes:

- local time
- status (`OK` or `FAIL`)
- model profile key
- task text
- compact result summary (trimmed and whitespace-normalized)

## Screenshots

When enabled (`screenshots.saveStepScreenshots=true`), each step screenshot is saved locally and optionally referenced in step result text.

Retention policy:

- keep newest `screenshots.maxCount`
- delete oldest PNG files when over limit
