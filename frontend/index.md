---
layout: home

title: OpenPocket
titleTemplate: OpenPocket Documentation

hero:
  name: '<img class="op-hero-logo" src="/openpocket-logo.png" alt="OpenPocket logo" />'
  text: A Second Phone That Never Sleeps.
  tagline: OpenPocket runs an always-on agent phone locally, with privacy first.
  image:
    src: /openpocket-grid.svg
    alt: OpenPocket local emulator architecture
  actions:
    - theme: brand
      text: Start Setup
      link: /get-started/
    - theme: alt
      text: Read Docs
      link: /hubs

features:
  - title: Local Runtime
    details: Execute tasks on a local Android emulator.
  - title: Human + Agent
    details: Direct control and agent automation in one workflow.
  - title: Auditable
    details: Sessions, memory, and artifacts stay visible and local.
---

<script setup>
import { withBase } from "vitepress";
</script>

<section class="op-home-section op-centered">
  <h2>OpenPocket in One Line</h2>
  <p>
    OpenPocket helps users automate real mobile app tasks without sending execution control to a cloud phone runtime.
  </p>
  <div class="op-pill-row">
    <span class="op-pill">Shopping</span>
    <span class="op-pill">Entertainment</span>
    <span class="op-pill">Social Workflows</span>
  </div>
</section>

<section class="op-home-section op-centered">
  <h2>How It Moves</h2>
  <div class="op-grid op-grid-compact">
    <article class="op-card">
      <h3>1. Ask</h3>
      <p>Start from CLI, bot, or local panel.</p>
    </article>
    <article class="op-card">
      <h3>2. Plan</h3>
      <p>Agent chooses the next mobile action.</p>
    </article>
    <article class="op-card">
      <h3>3. Act</h3>
      <p>OpenPocket executes on your local emulator.</p>
    </article>
  </div>

  <div class="op-architecture">

```mermaid
flowchart LR
  U["User"] --> R["OpenPocket Runtime"]
  R --> A["Agent"]
  A --> D["ADB Runtime"]
  D --> E["Android Emulator (Local)"]
  A --> P["Local Artifacts"]
```

  </div>
</section>

<section class="op-home-section op-doc-map-section op-centered">
  <div class="op-doc-map-head">
    <p class="op-doc-map-kicker">Documentation</p>
    <h2>Documentation Map</h2>
    <p>Pick one entry and dive deeper.</p>
  </div>
  <div class="op-doc-grid">
    <a class="op-doc-link" :href="withBase('/get-started/')">
      <span class="op-doc-chip">Start</span>
      <strong>Get Started</strong>
      <span class="op-doc-copy">Install and run OpenPocket quickly.</span>
    </a>
    <a class="op-doc-link" :href="withBase('/concepts/project-blueprint')">
      <span class="op-doc-chip">Vision</span>
      <strong>Project Blueprint</strong>
      <span class="op-doc-copy">Product direction and user scenarios.</span>
    </a>
    <a class="op-doc-link" :href="withBase('/concepts/')">
      <span class="op-doc-chip">System</span>
      <strong>Concepts</strong>
      <span class="op-doc-copy">Architecture and core runtime model.</span>
    </a>
    <a class="op-doc-link" :href="withBase('/tools/')">
      <span class="op-doc-chip">Build</span>
      <strong>Tools</strong>
      <span class="op-doc-copy">Skills and scripts for automation.</span>
    </a>
    <a class="op-doc-link" :href="withBase('/reference/')">
      <span class="op-doc-chip">Specs</span>
      <strong>Reference</strong>
      <span class="op-doc-copy">Defaults, schemas, and commands.</span>
    </a>
    <a class="op-doc-link" :href="withBase('/ops/')">
      <span class="op-doc-chip">Operate</span>
      <strong>Ops</strong>
      <span class="op-doc-copy">Runbook and troubleshooting guidance.</span>
    </a>
    <a class="op-doc-link" :href="withBase('/hubs')">
      <span class="op-doc-chip">Overview</span>
      <strong>Doc Hubs</strong>
      <span class="op-doc-copy">Browse the full documentation structure.</span>
    </a>
  </div>
</section>
