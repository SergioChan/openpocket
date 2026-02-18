# Project Blueprint

This page describes the product direction of OpenPocket as a **consumer-ready phone-use agent** built around a local Android emulator.

## Product Vision

OpenPocket helps everyday users complete real mobile tasks with an AI agent, while keeping control and sensitive data on their own machine.

The target is not only developer productivity. The core focus is everyday life scenarios such as:

- shopping
- entertainment
- social and messaging workflows
- repetitive in-app routines

## Core Product Principles

### 1. Local Emulator First

OpenPocket runs tasks on a local Android emulator instead of the user’s physical phone.

Benefits:

- does not consume battery, storage, or runtime resources on the user’s main phone
- execution state and permissions stay local to the user’s computer
- no mandatory cloud-hosted phone infrastructure

### 2. Local Data Boundary

OpenPocket is not a cloud execution farm.

- device automation runs locally through `adb`
- workspace artifacts remain local (`sessions`, `memory`, `scripts`, screenshots)
- model calls are explicit and configurable; users choose model provider and endpoint

### 3. Dual Control Modes

OpenPocket is designed for both autonomous and manual interaction:

- **Direct local control**: users can directly operate the local emulator window
- **Agent control**: the agent can operate the same local emulator through planned actions

This enables practical handoff between human and agent in one runtime.

### 4. Human-in-the-Loop by Default

OpenPocket should always allow users to intervene, inspect, and continue.

Current foundations:

- observable task lifecycle
- step-by-step persistence and logs
- explicit command surfaces (`agent`, `gateway`, `emulator`, `script`)

Near-term roadmap:

- remote connection from a user’s own phone to the local runtime
- phone-side controls for pause/resume/approve/retry flows
- richer human-in-the-loop checkpoints during agent execution

## Product Experience Layers

1. **Runtime Layer**: local emulator + `adb` + task loop + persistence.
2. **Control Layer**: CLI, Telegram gateway, and native panel.
3. **Trust Layer**: local storage, auditable sessions, script guardrails, controlled execution.
4. **Collaboration Layer**: human and agent can share control over the same mobile runtime.

## Representative User Scenarios

### Shopping

- compare products across multiple apps
- prepare carts and checkouts with user confirmation before final purchase

### Entertainment

- routine content checks, sign-ins, and navigation between media apps
- repeated daily engagement flows without manual repetition

### Social

- draft-assist and interaction setup in social apps
- structured review before sending or posting

## What OpenPocket Is Not

- not a browser-only desktop automation tool
- not limited to coding and office productivity tasks
- not a cloud-only remote device service

## Blueprint Summary

OpenPocket is evolving into a practical personal phone-use system: local, controllable, auditable, and oriented toward real consumer app workflows.
