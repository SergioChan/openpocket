import fs from "node:fs";
import path from "node:path";
import * as readline from "node:readline";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { EmulatorStatus, ModelProfile, OpenPocketConfig } from "../types";
import { saveConfig } from "../config";
import { ensureDir, nowIso } from "../utils/paths";
import { EmulatorManager } from "../device/emulator-manager";

const DROID_ASCII = [
  "██████╗ ██████╗ ███████╗███╗   ██╗██████╗ ██████╗  ██████╗ ██╗██████╗ ",
  "██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗██╔══██╗██╔═══██╗██║██╔══██╗",
  "██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║  ██║██████╔╝██║   ██║██║██║  ██║",
  "██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║  ██║██╔══██╗██║   ██║██║██║  ██║",
  "╚██████╔╝██║     ███████╗██║ ╚████║██████╔╝██║  ██║╚██████╔╝██║██████╔╝",
  " ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═════╝ ",
  "                             🤖 SETUP WIZARD                            ",
  "",
];

interface SetupState {
  updatedAt: string;
  consentAcceptedAt?: string;
  modelProfile?: string;
  modelProvider?: string;
  modelConfiguredAt?: string;
  apiKeyEnv?: string;
  apiKeySource?: "env" | "config" | "skipped";
  apiKeyConfiguredAt?: string;
  emulatorStartedAt?: string;
  gmailLoginConfirmedAt?: string;
  playStoreDetected?: boolean | null;
}

type SelectOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

type SetupPrompter = {
  intro: (title: string) => Promise<void>;
  note: (title: string, body: string) => Promise<void>;
  select: <T extends string>(message: string, options: SelectOption<T>[], initialValue?: T) => Promise<T>;
  confirm: (message: string, initialValue?: boolean) => Promise<boolean>;
  text: (message: string, initialValue?: string, validate?: (value: string) => string | null) => Promise<string>;
  pause: (message: string) => Promise<void>;
  outro: (message: string) => Promise<void>;
  close: () => Promise<void>;
};

type SetupEmulator = {
  start: (headless?: boolean) => Promise<string>;
  showWindow: () => string;
  status: () => EmulatorStatus;
  runAdb: (args: string[], timeoutMs?: number) => string;
};

export type RunSetupOptions = {
  prompter?: SetupPrompter;
  emulator?: SetupEmulator;
  skipTtyCheck?: boolean;
  printHeader?: boolean;
};

function printHeader(): void {
  // eslint-disable-next-line no-console
  console.log(DROID_ASCII.join("\n"));
}

function onboardingStatePath(config: OpenPocketConfig): string {
  ensureDir(config.stateDir);
  return path.join(config.stateDir, "onboarding.json");
}

function loadState(config: OpenPocketConfig): SetupState {
  const statePath = onboardingStatePath(config);
  if (!fs.existsSync(statePath)) {
    return { updatedAt: nowIso() };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf-8")) as SetupState;
    return parsed && typeof parsed === "object" ? parsed : { updatedAt: nowIso() };
  } catch {
    return { updatedAt: nowIso() };
  }
}

function saveState(config: OpenPocketConfig, state: SetupState): void {
  const statePath = onboardingStatePath(config);
  state.updatedAt = nowIso();
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function providerFromBaseUrl(baseUrl: string): string {
  const lower = baseUrl.toLowerCase();
  if (lower.includes("api.openai.com")) {
    return "OpenAI";
  }
  if (lower.includes("openrouter.ai")) {
    return "OpenRouter";
  }
  if (lower.includes("api.z.ai")) {
    return "AutoGLM";
  }
  try {
    const host = new URL(baseUrl).host;
    return host || "custom";
  } catch {
    return "custom";
  }
}

function providerKey(baseUrl: string): string {
  try {
    return new URL(baseUrl).host.toLowerCase();
  } catch {
    return baseUrl.toLowerCase().trim();
  }
}

function applyProviderApiKey(config: OpenPocketConfig, targetModelKey: string, apiKey: string): string[] {
  const target = config.models[targetModelKey];
  if (!target) {
    return [];
  }
  const targetProvider = providerKey(target.baseUrl);
  const updated: string[] = [];
  for (const [name, profile] of Object.entries(config.models)) {
    const sameProvider =
      providerKey(profile.baseUrl) === targetProvider || profile.apiKeyEnv === target.apiKeyEnv;
    if (sameProvider) {
      profile.apiKey = apiKey;
      profile.apiKeyEnv = target.apiKeyEnv;
      updated.push(name);
    }
  }
  return updated;
}

function modelOptionLabel(profileKey: string, profile: ModelProfile): string {
  if (profileKey === "gpt-5.2-codex") {
    return "GPT-5.2 Codex (OpenAI)";
  }
  if (profileKey === "gpt-5.3-codex") {
    return "GPT-5.3 Codex (OpenAI)";
  }
  if (profileKey === "claude-sonnet-4.6") {
    return "Claude Sonnet 4.6 (OpenRouter)";
  }
  if (profileKey === "claude-opus-4.6") {
    return "Claude Opus 4.6 (OpenRouter)";
  }
  if (profileKey === "autoglm-phone") {
    return "AutoGLM Phone (Z.ai)";
  }
  return `${profile.model} (${providerFromBaseUrl(profile.baseUrl)})`;
}

function detectPlayStore(emulator: SetupEmulator, preferredDeviceId: string | null): boolean | null {
  const status = emulator.status();
  const deviceId =
    preferredDeviceId && status.devices.includes(preferredDeviceId)
      ? preferredDeviceId
      : status.bootedDevices[0] ?? status.devices[0] ?? null;
  if (!deviceId) {
    return null;
  }
  try {
    const outputText = emulator.runAdb(["-s", deviceId, "shell", "pm", "path", "com.android.vending"]);
    return outputText.includes("package:");
  } catch {
    return false;
  }
}

function makeConsolePrompter(): SetupPrompter {
  const rl = createInterface({ input, output });

  async function ask(message: string): Promise<string> {
    return rl.question(message);
  }

  async function selectByArrowKeys<T extends string>(
    message: string,
    options: SelectOption<T>[],
    initialValue?: T,
  ): Promise<T> {
    if (options.length === 0) {
      throw new Error("Select prompt requires at least one option.");
    }
    const initialIndex =
      initialValue !== undefined ? Math.max(0, options.findIndex((opt) => opt.value === initialValue)) : 0;
    let index = initialIndex >= 0 && initialIndex < options.length ? initialIndex : 0;

    if (!input.isTTY || !output.isTTY) {
      return options[index].value;
    }

    rl.pause();
    readline.emitKeypressEvents(input);

    const previousRaw = Boolean((input as NodeJS.ReadStream).isRaw);
    if (input.setRawMode) {
      input.setRawMode(true);
    }
    input.resume();

    let renderedLines = 0;
    const render = () => {
      if (renderedLines > 0) {
        readline.moveCursor(output, 0, -renderedLines);
        readline.clearScreenDown(output);
      }
      const lines: string[] = [];
      lines.push("");
      lines.push(message);
      for (let i = 0; i < options.length; i += 1) {
        const option = options[i];
        const prefix = i === index ? ">" : " ";
        const hint = option.hint ? ` (${option.hint})` : "";
        lines.push(`  ${prefix} ${option.label}${hint}`);
      }
      lines.push("Use Up/Down arrows and Enter to select.");
      output.write(`${lines.join("\n")}\n`);
      renderedLines = lines.length;
    };

    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        input.removeListener("keypress", onKeypress);
        if (input.setRawMode) {
          input.setRawMode(previousRaw);
        }
        rl.resume();
      };

      const onKeypress = (_char: string, key: { name?: string; ctrl?: boolean }) => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          reject(new Error("Setup cancelled by user."));
          return;
        }
        if (key.name === "up") {
          index = (index - 1 + options.length) % options.length;
          render();
          return;
        }
        if (key.name === "down") {
          index = (index + 1) % options.length;
          render();
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          cleanup();
          output.write("\n");
          resolve(options[index].value);
        }
      };

      input.on("keypress", onKeypress);
      render();
    });
  }

  return {
    intro: async (title: string) => {
      // eslint-disable-next-line no-console
      console.log(`[OpenPocket] ${title}`);
    },
    note: async (title: string, body: string) => {
      // eslint-disable-next-line no-console
      console.log(`\n[${title}]`);
      // eslint-disable-next-line no-console
      console.log(body);
    },
    select: async (message, options, initialValue) => selectByArrowKeys(message, options, initialValue),
    confirm: async (message, initialValue = false) => {
      const defaultHint = initialValue ? "Y/n" : "y/N";
      while (true) {
        const raw = (await ask(`${message} [${defaultHint}]: `)).trim().toLowerCase();
        if (!raw) {
          return initialValue;
        }
        if (raw === "y" || raw === "yes") {
          return true;
        }
        if (raw === "n" || raw === "no") {
          return false;
        }
        // eslint-disable-next-line no-console
        console.log("Please enter y or n.");
      }
    },
    text: async (message, initialValue, validate) => {
      while (true) {
        const initSuffix = initialValue ? ` [${initialValue}]` : "";
        const raw = (await ask(`${message}${initSuffix}: `)).trim();
        const finalValue = raw || initialValue || "";
        const err = validate ? validate(finalValue) : null;
        if (!err) {
          return finalValue;
        }
        // eslint-disable-next-line no-console
        console.log(`Invalid input: ${err}`);
      }
    },
    pause: async (message) => {
      await ask(`${message}\nPress Enter to continue...`);
    },
    outro: async (message: string) => {
      // eslint-disable-next-line no-console
      console.log(`\n${message}`);
    },
    close: async () => {
      rl.close();
    },
  };
}

async function runConsentStep(prompter: SetupPrompter, state: SetupState): Promise<void> {
  await prompter.note(
    "User Consent (Required)",
    [
      "OpenPocket terms:",
      "1) The emulator and runtime data directories run on your local machine.",
      "2) Account sign-ins, app data, and screenshots are stored locally by default.",
      "3) If you configure a cloud model API (for example OpenAI), task text and screenshots may be sent to that provider for inference.",
      "4) You can stop the gateway at any time and remove local runtime data.",
    ].join("\n"),
  );

  const accepted = await prompter.confirm(
    "I have read and accept the terms above, and allow OpenPocket to run local automation.",
    false,
  );
  if (!accepted) {
    throw new Error("User consent not accepted. Setup aborted.");
  }
  state.consentAcceptedAt = nowIso();
}

async function runModelSelectionStep(
  config: OpenPocketConfig,
  prompter: SetupPrompter,
  state: SetupState,
): Promise<string> {
  const options = Object.entries(config.models).map(([profileKey, profile]) => ({
    value: profileKey,
    label: modelOptionLabel(profileKey, profile),
    hint: `${profile.model} | ${profile.apiKeyEnv}`,
  }));
  const selected = await prompter.select(
    "Choose your default model profile",
    options,
    config.defaultModel,
  );

  config.defaultModel = selected;
  saveConfig(config);

  const selectedProfile = config.models[selected];
  state.modelProfile = selected;
  state.modelProvider = providerFromBaseUrl(selectedProfile.baseUrl);
  state.apiKeyEnv = selectedProfile.apiKeyEnv;
  state.modelConfiguredAt = nowIso();

  await prompter.note(
    "Model Setup",
    [
      `Default model profile: ${selected}`,
      `Provider: ${state.modelProvider}`,
      `Model id: ${selectedProfile.model}`,
      `API key env: ${selectedProfile.apiKeyEnv}`,
    ].join("\n"),
  );

  return selected;
}

async function runApiKeyStep(
  config: OpenPocketConfig,
  prompter: SetupPrompter,
  state: SetupState,
  modelProfileKey: string,
): Promise<void> {
  const selectedProfile = config.models[modelProfileKey];
  if (!selectedProfile) {
    throw new Error(`Unknown model profile during setup: ${modelProfileKey}`);
  }

  const envName = selectedProfile.apiKeyEnv || "MODEL_API_KEY";
  const envKey = process.env[envName]?.trim() ?? "";
  const provider = providerFromBaseUrl(selectedProfile.baseUrl);

  await prompter.note(
    "API Key Setup",
    [
      `Selected model profile: ${modelProfileKey}`,
      `Provider: ${provider}`,
      `Model id: ${selectedProfile.model}`,
      `Expected environment variable: ${envName}`,
      "You can also edit config.json manually after setup.",
    ].join("\n"),
  );

  const choice = await prompter.select(
    "Choose API key setup method",
    [
      {
        value: "env",
        label: `Use environment variable ${envName}`,
        hint: envKey ? `Detected (length ${envKey.length})` : "Not detected",
      },
      {
        value: "config",
        label: "Paste API key and save to local config.json",
        hint: "Stored in plain text on this machine",
      },
      {
        value: "skip",
        label: "Skip for now",
      },
    ],
    envKey ? "env" : "config",
  );

  if (choice === "env") {
    if (!envKey) {
      await prompter.note(
        "Environment Variable Not Found",
        `${envName} is not set in the current shell. Marked as skipped; you can export it and rerun setup later.`,
      );
      state.apiKeySource = "skipped";
      return;
    }
    state.apiKeyEnv = envName;
    state.apiKeySource = "env";
    state.apiKeyConfiguredAt = nowIso();
    return;
  }

  if (choice === "skip") {
    state.apiKeySource = "skipped";
    return;
  }

  const inputKey = await prompter.text(
    `Enter API key for ${provider}`,
    "",
    (value) => (value.trim() ? null : "API key cannot be empty"),
  );
  const confirmed = await prompter.confirm(
    "Confirm writing this key to local config.json (stored only on this machine)?",
    true,
  );
  if (!confirmed) {
    state.apiKeySource = "skipped";
    return;
  }

  const updatedProfiles = applyProviderApiKey(config, modelProfileKey, inputKey.trim());
  saveConfig(config);
  state.apiKeyEnv = envName;
  state.apiKeySource = "config";
  state.apiKeyConfiguredAt = nowIso();
  await prompter.note(
    "API Key Setup",
    `Updated model profiles: ${updatedProfiles.join(", ") || "(none)"}`,
  );
}

async function runVmStep(
  config: OpenPocketConfig,
  prompter: SetupPrompter,
  state: SetupState,
  emulator: SetupEmulator,
): Promise<void> {
  const choice = await prompter.select(
    "Do you want to launch the Android emulator now and complete Gmail sign-in for Play Store?",
    [
      { value: "start", label: "Start and show emulator now (recommended)" },
      { value: "skip", label: "Skip for now and do it later with /startvm" },
    ],
    "start",
  );
  if (choice === "skip") {
    return;
  }

  const startMsg = await emulator.start(false);
  const showMsg = emulator.showWindow();
  state.emulatorStartedAt = nowIso();
  await prompter.note("Emulator", `${startMsg}\n${showMsg}`);

  const playStoreDetected = detectPlayStore(emulator, config.agent.deviceId);
  state.playStoreDetected = playStoreDetected;
  if (playStoreDetected === false) {
    await prompter.note(
      "Play Store Check",
      [
        "Play Store (com.android.vending) was not detected.",
        "Use a Google Play AVD image, otherwise many apps cannot be installed or signed in.",
      ].join("\n"),
    );
  }

  await prompter.note(
    "Manual Action Required",
    [
      "Please complete the following manually in the emulator:",
      "1) Open Play Store",
      "2) Sign in with your Gmail account",
      "3) Complete verification / 2FA if prompted",
      "4) Confirm you can search and install apps in Play Store",
    ].join("\n"),
  );

  await prompter.pause("Return to the terminal after finishing the steps above.");
  const done = await prompter.confirm("Have you completed Gmail sign-in and verified Play Store access?", false);
  if (done) {
    state.gmailLoginConfirmedAt = nowIso();
  }
}

export async function runSetupWizard(
  config: OpenPocketConfig,
  options: RunSetupOptions = {},
): Promise<void> {
  if (!options.skipTtyCheck && !options.prompter && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error("`setup` requires an interactive terminal (TTY).");
  }

  const prompter = options.prompter ?? makeConsolePrompter();
  const emulator = options.emulator ?? new EmulatorManager(config);
  const state = loadState(config);

  try {
    if (options.printHeader !== false) {
      printHeader();
    }
    await prompter.intro("OpenPocket onboarding");
    await runConsentStep(prompter, state);
    const selectedModel = await runModelSelectionStep(config, prompter, state);
    await runApiKeyStep(config, prompter, state, selectedModel);
    await runVmStep(config, prompter, state, emulator);
    saveState(config, state);
    await prompter.outro(
      [
        "Setup completed.",
        `Onboarding state: ${onboardingStatePath(config)}`,
        "Next:",
        "  1) openpocket gateway start",
        "  2) Send a natural-language task directly in Telegram",
      ].join("\n"),
    );
  } finally {
    await prompter.close();
  }
}
