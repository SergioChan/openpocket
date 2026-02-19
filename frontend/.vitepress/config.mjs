import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const docsBaseRaw = process.env.DOCS_BASE?.trim() ?? "/";
const docsBase = docsBaseRaw.startsWith("/") ? docsBaseRaw : `/${docsBaseRaw}`;
const normalizedBase = docsBase.endsWith("/") ? docsBase : `${docsBase}/`;

export default withMermaid(defineConfig({
  base: normalizedBase,
  lang: "en-US",
  title: "OpenPocket",
  description: "Local emulator-first phone-use agent for everyday workflows with auditable local control.",
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: [
    // Native app docs may not exist in all checkouts.
    /openpocket-menubar/,
  ],
  themeConfig: {
    siteTitle: "OpenPocket",
    nav: [
      { text: "Home", link: "/" },
      { text: "Blueprint", link: "/concepts/project-blueprint" },
      { text: "Get Started", link: "/get-started/" },
      { text: "Reference", link: "/reference/" },
      { text: "Runbook", link: "/ops/runbook" },
      { text: "Doc Hubs", link: "/hubs" },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/SergioChan/openpocket" },
    ],
    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Home", link: "/" },
          { text: "Documentation Hubs", link: "/hubs" },
        ],
      },
      {
        text: "Get Started",
        collapsed: false,
        items: [
          { text: "Index", link: "/get-started/" },
          { text: "Quickstart", link: "/get-started/quickstart" },
          { text: "Configuration", link: "/get-started/configuration" },
          { text: "Deploy Documentation Site", link: "/get-started/deploy-docs" },
        ],
      },
      {
        text: "Concepts",
        collapsed: false,
        items: [
          { text: "Index", link: "/concepts/" },
          { text: "Project Blueprint", link: "/concepts/project-blueprint" },
          { text: "Architecture", link: "/concepts/architecture" },
          { text: "Prompting and Decision Model", link: "/concepts/prompting" },
          { text: "Sessions and Memory", link: "/concepts/sessions-memory" },
        ],
      },
      {
        text: "Tools",
        collapsed: false,
        items: [
          { text: "Index", link: "/tools/" },
          { text: "Skills", link: "/tools/skills" },
          { text: "Scripts", link: "/tools/scripts" },
        ],
      },
      {
        text: "Reference",
        collapsed: false,
        items: [
          { text: "Index", link: "/reference/" },
          { text: "Config Defaults", link: "/reference/config-defaults" },
          { text: "Prompt Templates", link: "/reference/prompt-templates" },
          { text: "Action and Output Schema", link: "/reference/action-schema" },
          { text: "Session and Memory Formats", link: "/reference/session-memory-formats" },
          { text: "CLI and Gateway", link: "/reference/cli-and-gateway" },
          { text: "Filesystem Layout", link: "/reference/filesystem-layout" },
        ],
      },
      {
        text: "Ops",
        collapsed: false,
        items: [
          { text: "Index", link: "/ops/" },
          { text: "Runbook", link: "/ops/runbook" },
          { text: "Troubleshooting", link: "/ops/troubleshooting" },
        ],
      },
      {
        text: "Legacy",
        collapsed: true,
        items: [
          { text: "Implementation Plan", link: "/implementation-plan" },
          { text: "MVP Runbook (Legacy Entry)", link: "/mvp-runbook" },
        ],
      },
    ],
    search: {
      provider: "local",
    },
    outline: {
      level: [2, 3],
    },
    footer: {
      message: "<a href=\"https://github.com/SergioChan/openpocket\" target=\"_blank\" rel=\"noreferrer\">GitHub Repository</a>",
      copyright: "MIT License · OpenPocket Contributors",
    },
  },
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
  mermaid: {},
}));
