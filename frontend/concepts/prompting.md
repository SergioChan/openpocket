# Prompting and Decision Model

This page explains how OpenPocket constructs prompts and routes user messages.

## System Prompt

`buildSystemPrompt(skillsSummary, workspaceContext)` generates a structured instruction block with:

- tool catalog and argument expectations
- mandatory planning loop for every step
- skill-selection protocol (mandatory when relevant skills exist)
- memory-recall protocol for identity/preferences/history questions
- execution policy (deterministic, bounded, anti-loop)
- explicit `request_human_auth` policy and capability set
- completion policy (`finish` with full summary)
- output discipline (one tool call per step, English text fields)
- loaded skill summary text
- optional injected workspace context (`AGENTS.md`, `BOOTSTRAP.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`)

System prompt supports three modes:

- `full`: default rich policy
- `minimal`: lean policy (used by cron)
- `none`: minimal safety skeleton only

Prompt templates are documented in [Prompt Templates](../reference/prompt-templates.md).

## User Prompt

Per step, `buildUserPrompt(task, step, snapshot, history)` includes:

- task text
- step number
- structured screen metadata (`currentApp`, `width`, `height`, `deviceId`, `capturedAt`)
- recent execution history (last 8 lines)
- decision checklist (sub-goal, evidence, anti-loop alternative, auth escalation, finish criteria)
- explicit instruction to call exactly one tool

The screenshot image itself is attached in model request payload as base64 PNG.

## Output Contract

Runtime uses function/tool calling, then converts tool call args into an internal `AgentAction`.

If args are malformed or action type is unknown, runtime normalizes to safe fallback `wait` action.

## Telegram Routing

`ChatAssistant.decide(chatId, inputText)` uses:

1. heuristic classifier (high-confidence greetings and obvious task keywords)
2. model-based classifier fallback
3. final fallback strategy if model classification fails

When routed to task mode, message is passed to `AgentRuntime.runTask`.
When routed to chat mode, response is generated conversationally.

For task mode with auth checkpoints:

- agent can emit `request_human_auth`
- gateway opens one-time web approval link (when relay is configured)
- Telegram `/auth approve|reject` remains available as manual fallback
- approved requests may inject `delegation_result` and `delegation_template` lines into history, so the next step can continue with deterministic UI paths (for example gallery import after delegated image upload)

## Memory Window

Chat assistant stores in-memory turn history per chat ID:

- keep max 20 turns
- include up to last 12 turns in next prompt

`/clear` removes memory for the current chat.
