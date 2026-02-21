---
title: "HEARTBEAT.md Template"
summary: "Periodic health-check checklist"
read_when:
  - Heartbeat execution
---

# HEARTBEAT

Background checks to run periodically when heartbeat is enabled.

## Cadence

- Run light checks first.
- Skip noisy checks if there is no signal of change.

## Checklist

- Gateway process healthy
- Emulator/device online
- Recent task failures requiring attention
- Queue/backlog requiring user notification

## Reporting Rule

- If no action is needed, report `HEARTBEAT_OK`.
- If action is needed, report only the actionable summary.
