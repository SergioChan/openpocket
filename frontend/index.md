---
layout: home

title: OpenPocket
titleTemplate: OpenPocket Documentation

hero:
  name: OpenPocket
  text: Local Emulator Phone-Use Agent
  tagline: Secure local mobile automation for everyday life scenarios such as shopping, entertainment, and social workflows.
  image:
    src: /openpocket-grid.svg
    alt: OpenPocket local emulator architecture
  actions:
    - theme: brand
      text: Start Local Setup
      link: /get-started/
    - theme: alt
      text: View Blueprint
      link: /concepts/project-blueprint
    - theme: alt
      text: Read Reference
      link: /reference/

features:
  - title: No Main-Phone Resource Usage
    details: Tasks run on a local Android emulator, not on your primary phone.
  - title: Local Data and Permission Boundary
    details: Runtime state and artifacts remain on your machine with explicit model provider control.
  - title: Human + Agent Shared Control
    details: You can directly operate the emulator or let the agent run tasks, with handoff in one runtime.
---

<script setup>
import { withBase } from "vitepress";
</script>

<section class="op-home-section">
  <h2>Why OpenPocket</h2>
  <p>
    OpenPocket is built for real life mobile automation, not only developer productivity.
    It helps users complete practical app tasks locally while keeping control, visibility,
    and auditability.
  </p>
  <div class="op-pill-row">
    <span class="op-pill">Shopping</span>
    <span class="op-pill">Entertainment</span>
    <span class="op-pill">Social Workflows</span>
    <span class="op-pill">Local Emulator Runtime</span>
    <span class="op-pill">Human-in-the-Loop</span>
  </div>
</section>

<section class="op-home-section">
  <h2>Execution Model</h2>
  <div class="op-grid">
    <article class="op-card">
      <h3>1. Request</h3>
      <p>User sends a task from CLI, bot, or local operations panel.</p>
    </article>
    <article class="op-card">
      <h3>2. Observe</h3>
      <p>Runtime captures local emulator state and contextual screenshot data.</p>
    </article>
    <article class="op-card">
      <h3>3. Decide</h3>
      <p>Agent plans the next action through configured model profiles.</p>
    </article>
    <article class="op-card op-card-wide">
      <h3>4. Execute</h3>
      <p>Actions are applied to the local Android emulator via adb with audit logs.</p>
    </article>
    <article class="op-card op-card-wide">
      <h3>5. Review and Continue</h3>
      <p>Users can intervene, inspect artifacts, and continue in a shared human-agent loop.</p>
    </article>
  </div>

  <div class="op-architecture">

```mermaid
flowchart LR
  U["Local User Control"] --> R["OpenPocket Runtime"]
  B["Bot / CLI Task"] --> R
  R --> A["Agent Runtime"]
  A --> M["Model Client"]
  A --> D["ADB Runtime"]
  D --> E["Android Emulator (Local)"]
  A --> P["Local Persistence"]
  P --> SS["sessions/*.md"]
  P --> MM["memory/YYYY-MM-DD.md"]
  P --> RR["scripts/runs/*"]
  RP["User Phone (Upcoming Remote Control)"] -.-> R
```

  </div>
</section>

<section class="op-home-section">
  <h2>Control Modes</h2>
  <div class="op-grid">
    <article class="op-card">
      <h3>Direct Human Control</h3>
      <p>Users can manually control the local emulator for sensitive or high-context steps.</p>
    </article>
    <article class="op-card">
      <h3>Agent Control</h3>
      <p>The agent executes mobile actions on the same local runtime for repeatable flows.</p>
    </article>
    <article class="op-card op-card-wide">
      <h3>Upcoming: Phone Remote Human-in-the-Loop</h3>
      <p>Planned support lets users connect from their own phone to supervise and control the local emulator remotely.</p>
    </article>
  </div>
</section>

<section class="op-home-section op-doc-map-section">
  <div class="op-doc-map-head">
    <p class="op-doc-map-kicker">Explore</p>
    <h2>Documentation Map</h2>
    <p>Choose your path based on where you are right now: first setup, product understanding, implementation details, or operations.</p>
  </div>
  <div class="op-doc-grid">
    <a class="op-doc-link" :href="withBase('/get-started/')">
      <span class="op-doc-chip">Start Here</span>
      <strong>Get Started</strong>
      <span class="op-doc-copy">Install and run your local emulator-first runtime.</span>
      <span class="op-doc-cta">Open Guide</span>
    </a>
    <a class="op-doc-link" :href="withBase('/concepts/project-blueprint')">
      <span class="op-doc-chip">Product</span>
      <strong>Project Blueprint</strong>
      <span class="op-doc-copy">Read the full product direction and operating model.</span>
      <span class="op-doc-cta">Read Vision</span>
    </a>
    <a class="op-doc-link" :href="withBase('/concepts/')">
      <span class="op-doc-chip">System</span>
      <strong>Concepts</strong>
      <span class="op-doc-copy">Understand architecture, prompting, and persistence behavior.</span>
      <span class="op-doc-cta">View Concepts</span>
    </a>
    <a class="op-doc-link" :href="withBase('/tools/')">
      <span class="op-doc-chip">Builder</span>
      <strong>Tools</strong>
      <span class="op-doc-copy">Author and run skills/scripts with runtime-compatible conventions.</span>
      <span class="op-doc-cta">Open Tools</span>
    </a>
    <a class="op-doc-link" :href="withBase('/reference/')">
      <span class="op-doc-chip">Specs</span>
      <strong>Reference</strong>
      <span class="op-doc-copy">Source-of-truth defaults, schemas, command surface, and formats.</span>
      <span class="op-doc-cta">Open Reference</span>
    </a>
    <a class="op-doc-link" :href="withBase('/ops/')">
      <span class="op-doc-chip">Operations</span>
      <strong>Ops</strong>
      <span class="op-doc-copy">Day-2 runbook, troubleshooting, and operational guardrails.</span>
      <span class="op-doc-cta">Open Runbook</span>
    </a>
    <a class="op-doc-link" :href="withBase('/get-started/deploy-docs')">
      <span class="op-doc-chip">Publish</span>
      <strong>Deploy Docs</strong>
      <span class="op-doc-copy">Publish this documentation site on Vercel.</span>
      <span class="op-doc-cta">Deploy</span>
    </a>
    <a class="op-doc-link" :href="withBase('/hubs')">
      <span class="op-doc-chip">Overview</span>
      <strong>Doc Hubs</strong>
      <span class="op-doc-copy">Browse the complete documentation structure.</span>
      <span class="op-doc-cta">Browse All</span>
    </a>
  </div>
</section>
