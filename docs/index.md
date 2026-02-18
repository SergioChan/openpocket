---
layout: home

title: OpenPocket
titleTemplate: OpenPocket Documentation

hero:
  name: OpenPocket
  text: Local-First Phone-Use Agent Runtime
  tagline: Auditable task sessions, controlled automation, and a production-oriented CLI + gateway stack.
  image:
    src: /openpocket-grid.svg
    alt: OpenPocket architecture grid
  actions:
    - theme: brand
      text: Get Started
      link: /get-started/
    - theme: alt
      text: Read Reference
      link: /reference/
    - theme: alt
      text: Runtime Runbook
      link: /ops/runbook

features:
  - title: Local Runtime Boundary
    details: Execute device actions locally through adb while keeping an explicit cloud model boundary.
  - title: Auditable by Design
    details: Every run writes sessions, daily memory entries, screenshots, and script artifacts for traceability.
  - title: Operator-Ready Tooling
    details: Interactive onboarding, gateway run-loop control, heartbeat, and cron-based scheduled tasks.
---

<section class="op-home-section">
  <h2>Why OpenPocket</h2>
  <p>
    OpenPocket is built for teams that need deterministic phone automation without losing transparency.
    It keeps critical execution state on your machine, supports multiple model providers, and ships with
    practical controls for day-2 operations.
  </p>
  <div class="op-pill-row">
    <span class="op-pill">CLI + Telegram Gateway</span>
    <span class="op-pill">Model Endpoint Fallback</span>
    <span class="op-pill">Script Allowlist + Timeout</span>
    <span class="op-pill">Cron + Heartbeat</span>
    <span class="op-pill">Native macOS Menu Bar Panel</span>
  </div>
</section>

<section class="op-home-section">
  <h2>Execution Model</h2>
  <div class="op-grid">
    <article class="op-card">
      <h3>1. Route</h3>
      <p>CLI or Telegram input is routed into chat mode or task mode.</p>
    </article>
    <article class="op-card">
      <h3>2. Observe</h3>
      <p>Runtime captures current app state and screenshot metadata from the emulator.</p>
    </article>
    <article class="op-card">
      <h3>3. Decide</h3>
      <p>Model returns strict JSON action output with endpoint fallback support.</p>
    </article>
    <article class="op-card op-card-wide">
      <h3>4. Execute</h3>
      <p>Action is applied via adb (or controlled script runner), then persisted in session + memory logs.</p>
    </article>
    <article class="op-card op-card-wide">
      <h3>5. Operate</h3>
      <p>Gateway run-loop, heartbeat, and cron service keep long-running automation manageable.</p>
    </article>
  </div>

  <div class="op-architecture">

```mermaid
flowchart LR
  U["User / Bot Message"] --> G["OpenPocket Gateway"]
  G --> A["Agent Runtime"]
  A --> M["Model Client"]
  A --> D["ADB Runtime"]
  A --> S["Script Executor"]
  D --> E["Android Emulator"]
  A --> P["Workspace Persistence"]
  P --> SS["sessions/*.md"]
  P --> MM["memory/YYYY-MM-DD.md"]
  P --> RR["scripts/runs/*"]
```

  </div>
</section>

<section class="op-home-section">
  <h2>Documentation Map</h2>
  <div class="op-doc-grid">
    <a class="op-doc-link" href="/get-started/">
      <strong>Get Started</strong>
      Install, initialize, and onboard a local runtime quickly.
    </a>
    <a class="op-doc-link" href="/concepts/">
      <strong>Concepts</strong>
      Understand architecture, prompting, and persistence mechanics.
    </a>
    <a class="op-doc-link" href="/tools/">
      <strong>Tools</strong>
      Author and run skills/scripts with runtime-compatible conventions.
    </a>
    <a class="op-doc-link" href="/reference/">
      <strong>Reference</strong>
      Source-of-truth defaults, schemas, command surface, and formats.
    </a>
    <a class="op-doc-link" href="/ops/">
      <strong>Ops</strong>
      Day-2 runbook, troubleshooting, and operational guardrails.
    </a>
    <a class="op-doc-link" href="/hubs">
      <strong>Doc Hubs</strong>
      High-level documentation overview and scope policy.
    </a>
  </div>
</section>
