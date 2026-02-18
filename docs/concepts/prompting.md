# Prompting and Decision Model

This page explains how OpenPocket constructs prompts and routes user messages.

## Agent System Prompt

`buildSystemPrompt(skillsSummary)` generates an instruction block with:

- strict JSON-only output requirement
- allowed `action.type` list
- safety and execution rules
- English-only output text rule (`thought` and action text fields)
- loaded skill summary text

Prompt templates are documented in [Prompt Templates](../reference/prompt-templates.md).

## Agent User Prompt

Per step, `buildUserPrompt(task, step, snapshot, history)` includes:

- task text
- step number
- structured screen metadata (`currentApp`, `width`, `height`, `deviceId`, `capturedAt`)
- recent execution history (last 8 lines)
- explicit instruction to return one JSON object

The screenshot image itself is attached in model request payload as base64 PNG.

## Action Output Contract

Expected output shape:

```json
{"thought":"...","action":{"type":"..."}}
```

If model output is invalid JSON or has unknown action type, runtime normalizes to safe fallback `wait` action.

## Chat vs Task Routing (Telegram)

`ChatAssistant.decide(chatId, inputText)` uses:

1. heuristic classifier (high-confidence greetings and obvious task keywords)
2. model-based classifier fallback
3. final fallback strategy if model classification fails

When routed to task mode, message is passed to `AgentRuntime.runTask`.
When routed to chat mode, response is generated conversationally.

## Conversation Memory Window

Chat assistant stores in-memory turn history per chat ID:

- keep max 20 turns
- include up to last 12 turns in next prompt

`/clear` removes memory for the current chat.
