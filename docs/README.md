# OpenPocket Documentation

This documentation is organized in documentation hubs (inspired by OpenClaw docs information architecture):

- Start with task-oriented onboarding.
- Move to concepts and execution model.
- Use tools/reference pages for exact schemas and defaults.
- Keep operations and troubleshooting separated.

All pages in this folder document implemented behavior in the current TypeScript runtime (`src/`).
For the native macOS menu bar app, see:
- [OpenPocket Menu Bar App](../apps/openpocket-menubar/README.md)

## Documentation Hubs

| Hub | Purpose | Entry |
| --- | --- | --- |
| Get Started | Install, initialize, and configure quickly | [Quickstart](./get-started/quickstart.md) |
| Concepts | Understand runtime design and core agent mechanics | [Architecture](./concepts/architecture.md) |
| Tools | Skill and script authoring and runtime behavior | [Skills](./tools/skills.md) |
| Reference | Precise schemas, defaults, formats, and commands | [Config Defaults](./reference/config-defaults.md) |
| Ops | Day-2 runbook and troubleshooting | [Runbook](./ops/runbook.md) |

## Most Requested Specs

- Prompt templates: [Prompt Templates](./reference/prompt-templates.md)
- Default values: [Config Defaults](./reference/config-defaults.md)
- Session and memory formats: [Session and Memory Formats](./reference/session-memory-formats.md)
- Skill format and loading rules: [Skills](./tools/skills.md)
- Script format and execution rules: [Scripts](./tools/scripts.md)
- CLI and Telegram commands: [CLI and Gateway](./reference/cli-and-gateway.md)

## Documentation Scope Policy

- Document only what exists in code today.
- Mark fallback behavior and normalization rules explicitly.
- Keep examples executable with current CLI.

## Legacy Pages

Older planning pages are still available:

- [Implementation Plan](./implementation-plan.md)
- [MVP Runbook (legacy)](./mvp-runbook.md)
