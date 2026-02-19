import fs from "node:fs";
import path from "node:path";

import type { ModelProfile, OpenPocketConfig } from "../types";
import {
  defaultConfigPath,
  defaultStateDir,
  defaultWorkspaceDir,
  ensureDir,
  resolvePath,
} from "../utils/paths";
import { ensureWorkspaceBootstrap } from "../memory/workspace";

function defaultConfigObject() {
  return {
    projectName: "OpenPocket",
    workspaceDir: defaultWorkspaceDir(),
    stateDir: defaultStateDir(),
    defaultModel: "gpt-5.2-codex",
    emulator: {
      avdName: "OpenPocket_AVD",
      androidSdkRoot: process.env.ANDROID_SDK_ROOT ?? "",
      headless: false,
      bootTimeoutSec: 180,
    },
    telegram: {
      botToken: "",
      botTokenEnv: "TELEGRAM_BOT_TOKEN",
      allowedChatIds: [] as number[],
      pollTimeoutSec: 25,
    },
    agent: {
      maxSteps: 50,
      loopDelayMs: 1200,
      progressReportInterval: 1,
      returnHomeOnTaskEnd: true,
      lang: "en" as const,
      verbose: true,
      deviceId: null,
    },
    screenshots: {
      saveStepScreenshots: true,
      directory: path.join(defaultStateDir(), "screenshots"),
      maxCount: 400,
    },
    scriptExecutor: {
      enabled: true,
      timeoutSec: 60,
      maxOutputChars: 6000,
      allowedCommands: [
        "adb",
        "am",
        "pm",
        "input",
        "echo",
        "pwd",
        "ls",
        "cat",
        "grep",
        "rg",
        "sed",
        "awk",
        "bash",
        "sh",
        "node",
        "npm",
      ],
    },
    heartbeat: {
      enabled: true,
      everySec: 30,
      stuckTaskWarnSec: 600,
      writeLogFile: true,
    },
    cron: {
      enabled: true,
      tickSec: 10,
      jobsFile: path.join(defaultWorkspaceDir(), "cron", "jobs.json"),
    },
    humanAuth: {
      enabled: false,
      relayBaseUrl: "",
      publicBaseUrl: "",
      apiKey: "",
      apiKeyEnv: "OPENPOCKET_HUMAN_AUTH_KEY",
      requestTimeoutSec: 300,
      pollIntervalMs: 2000,
    },
    models: {
      "gpt-5.2-codex": {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.2-codex",
        apiKey: "",
        apiKeyEnv: "OPENAI_API_KEY",
        maxTokens: 4096,
        reasoningEffort: "medium" as const,
        temperature: null,
      },
      "gpt-5.3-codex": {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.3-codex",
        apiKey: "",
        apiKeyEnv: "OPENAI_API_KEY",
        maxTokens: 4096,
        reasoningEffort: "medium" as const,
        temperature: null,
      },
      "claude-sonnet-4.6": {
        baseUrl: "https://openrouter.ai/api/v1",
        model: "claude-sonnet-4.6",
        apiKey: "",
        apiKeyEnv: "OPENROUTER_API_KEY",
        maxTokens: 4096,
        reasoningEffort: "medium" as const,
        temperature: null,
      },
      "claude-opus-4.6": {
        baseUrl: "https://openrouter.ai/api/v1",
        model: "claude-opus-4.6",
        apiKey: "",
        apiKeyEnv: "OPENROUTER_API_KEY",
        maxTokens: 4096,
        reasoningEffort: "medium" as const,
        temperature: null,
      },
      "autoglm-phone": {
        baseUrl: "https://api.z.ai/api/paas/v4",
        model: "autoglm-phone-multilingual",
        apiKey: "",
        apiKeyEnv: "AUTOGLM_API_KEY",
        maxTokens: 3000,
        reasoningEffort: null,
        temperature: null,
      },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, incoming: unknown): T {
  if (!isObject(base) || !isObject(incoming)) {
    return (incoming as T) ?? base;
  }
  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = output[key];
    if (isObject(existing) && isObject(value)) {
      output[key] = deepMerge(existing, value);
    } else {
      output[key] = value;
    }
  }
  return output as T;
}

function normalizeLegacyKeys(input: Record<string, unknown>): Record<string, unknown> {
  const raw = { ...input };

  const topLevelMap: Record<string, string> = {
    project_name: "projectName",
    workspace_dir: "workspaceDir",
    state_dir: "stateDir",
    default_model: "defaultModel",
    script_executor: "scriptExecutor",
    heartbeat_config: "heartbeat",
    cron_config: "cron",
    human_auth: "humanAuth",
  };

  for (const [oldKey, newKey] of Object.entries(topLevelMap)) {
    if (oldKey in raw && !(newKey in raw)) {
      raw[newKey] = raw[oldKey];
    }
  }

  const emulator = isObject(raw.emulator) ? { ...raw.emulator } : {};
  const emulatorMap: Record<string, string> = {
    avd_name: "avdName",
    android_sdk_root: "androidSdkRoot",
    boot_timeout_sec: "bootTimeoutSec",
  };
  for (const [oldKey, newKey] of Object.entries(emulatorMap)) {
    if (oldKey in emulator && !(newKey in emulator)) {
      emulator[newKey] = emulator[oldKey];
    }
  }
  if (Object.keys(emulator).length > 0) {
    raw.emulator = emulator;
  }

  const telegram = isObject(raw.telegram) ? { ...raw.telegram } : {};
  const telegramMap: Record<string, string> = {
    bot_token: "botToken",
    bot_token_env: "botTokenEnv",
    allowed_chat_ids: "allowedChatIds",
    poll_timeout_sec: "pollTimeoutSec",
  };
  for (const [oldKey, newKey] of Object.entries(telegramMap)) {
    if (oldKey in telegram && !(newKey in telegram)) {
      telegram[newKey] = telegram[oldKey];
    }
  }
  if (Object.keys(telegram).length > 0) {
    raw.telegram = telegram;
  }

  const agent = isObject(raw.agent) ? { ...raw.agent } : {};
  const agentMap: Record<string, string> = {
    max_steps: "maxSteps",
    loop_delay_ms: "loopDelayMs",
    progress_report_interval: "progressReportInterval",
    return_home_on_task_end: "returnHomeOnTaskEnd",
    device_id: "deviceId",
  };
  for (const [oldKey, newKey] of Object.entries(agentMap)) {
    if (oldKey in agent && !(newKey in agent)) {
      agent[newKey] = agent[oldKey];
    }
  }
  if (Object.keys(agent).length > 0) {
    raw.agent = agent;
  }

  const screenshots = isObject(raw.screenshots) ? { ...raw.screenshots } : {};
  const screenshotsMap: Record<string, string> = {
    save_step_screenshots: "saveStepScreenshots",
    max_count: "maxCount",
  };
  for (const [oldKey, newKey] of Object.entries(screenshotsMap)) {
    if (oldKey in screenshots && !(newKey in screenshots)) {
      screenshots[newKey] = screenshots[oldKey];
    }
  }
  if (Object.keys(screenshots).length > 0) {
    raw.screenshots = screenshots;
  }

  const scriptExecutor = isObject(raw.scriptExecutor) ? { ...raw.scriptExecutor } : {};
  const scriptExecutorMap: Record<string, string> = {
    timeout_sec: "timeoutSec",
    max_output_chars: "maxOutputChars",
    allowed_commands: "allowedCommands",
  };
  for (const [oldKey, newKey] of Object.entries(scriptExecutorMap)) {
    if (oldKey in scriptExecutor && !(newKey in scriptExecutor)) {
      scriptExecutor[newKey] = scriptExecutor[oldKey];
    }
  }
  if (Object.keys(scriptExecutor).length > 0) {
    raw.scriptExecutor = scriptExecutor;
  }

  const heartbeat = isObject(raw.heartbeat) ? { ...raw.heartbeat } : {};
  const heartbeatMap: Record<string, string> = {
    every_sec: "everySec",
    stuck_task_warn_sec: "stuckTaskWarnSec",
    write_log_file: "writeLogFile",
  };
  for (const [oldKey, newKey] of Object.entries(heartbeatMap)) {
    if (oldKey in heartbeat && !(newKey in heartbeat)) {
      heartbeat[newKey] = heartbeat[oldKey];
    }
  }
  if (Object.keys(heartbeat).length > 0) {
    raw.heartbeat = heartbeat;
  }

  const cron = isObject(raw.cron) ? { ...raw.cron } : {};
  const cronMap: Record<string, string> = {
    tick_sec: "tickSec",
    jobs_file: "jobsFile",
  };
  for (const [oldKey, newKey] of Object.entries(cronMap)) {
    if (oldKey in cron && !(newKey in cron)) {
      cron[newKey] = cron[oldKey];
    }
  }
  if (Object.keys(cron).length > 0) {
    raw.cron = cron;
  }

  const humanAuth = isObject(raw.humanAuth) ? { ...raw.humanAuth } : {};
  const humanAuthMap: Record<string, string> = {
    relay_base_url: "relayBaseUrl",
    public_base_url: "publicBaseUrl",
    api_key: "apiKey",
    api_key_env: "apiKeyEnv",
    request_timeout_sec: "requestTimeoutSec",
    poll_interval_ms: "pollIntervalMs",
  };
  for (const [oldKey, newKey] of Object.entries(humanAuthMap)) {
    if (oldKey in humanAuth && !(newKey in humanAuth)) {
      humanAuth[newKey] = humanAuth[oldKey];
    }
  }
  if (Object.keys(humanAuth).length > 0) {
    raw.humanAuth = humanAuth;
  }

  if (isObject(raw.models)) {
    const convertedModels: Record<string, unknown> = {};
    for (const [modelKey, modelValue] of Object.entries(raw.models)) {
      if (!isObject(modelValue)) {
        convertedModels[modelKey] = modelValue;
        continue;
      }
      const m = { ...modelValue };
      const modelMap: Record<string, string> = {
        base_url: "baseUrl",
        api_key: "apiKey",
        api_key_env: "apiKeyEnv",
        max_tokens: "maxTokens",
        reasoning_effort: "reasoningEffort",
      };
      for (const [oldKey, newKey] of Object.entries(modelMap)) {
        if (oldKey in m && !(newKey in m)) {
          m[newKey] = m[oldKey];
        }
      }
      convertedModels[modelKey] = m;
    }
    raw.models = convertedModels;
  }

  return raw;
}

function normalizeConfig(raw: Record<string, unknown>, configPath: string): OpenPocketConfig {
  const compatibleRaw = normalizeLegacyKeys(raw);
  const merged = deepMerge(
    defaultConfigObject() as Record<string, unknown>,
    compatibleRaw,
  ) as Record<string, unknown>;
  const rawModels = (merged.models ?? {}) as Record<string, unknown>;
  const models: Record<string, ModelProfile> = {};
  for (const [key, value] of Object.entries(rawModels)) {
    const model = isObject(value) ? value : {};
    const reasoningRaw =
      model.reasoningEffort ?? model.reasoning_effort ?? null;
    const reasoningEffort =
      reasoningRaw === "low" ||
      reasoningRaw === "medium" ||
      reasoningRaw === "high" ||
      reasoningRaw === "xhigh"
        ? reasoningRaw
        : null;
    const tempRaw = model.temperature;
    models[key] = {
      baseUrl: String(model.baseUrl ?? model.base_url ?? "https://api.openai.com/v1"),
      model: String(model.model ?? key),
      apiKey: String(model.apiKey ?? model.api_key ?? ""),
      apiKeyEnv: String(model.apiKeyEnv ?? model.api_key_env ?? "OPENAI_API_KEY"),
      maxTokens: Number(model.maxTokens ?? model.max_tokens ?? 4096),
      reasoningEffort,
      temperature:
        tempRaw === null || tempRaw === undefined || Number.isNaN(Number(tempRaw))
          ? null
          : Number(tempRaw),
    };
  }
  const defaultModel = String(merged.defaultModel ?? "gpt-5.2-codex");
  if (!models[defaultModel]) {
    throw new Error(`defaultModel '${defaultModel}' is not present in models.`);
  }

  const emulator = (merged.emulator ?? {}) as Record<string, unknown>;
  const telegram = (merged.telegram ?? {}) as Record<string, unknown>;
  const agent = (merged.agent ?? {}) as Record<string, unknown>;
  const screenshots = (merged.screenshots ?? {}) as Record<string, unknown>;
  const scriptExecutor = (merged.scriptExecutor ?? {}) as Record<string, unknown>;
  const heartbeat = (merged.heartbeat ?? {}) as Record<string, unknown>;
  const cron = (merged.cron ?? {}) as Record<string, unknown>;
  const humanAuth = (merged.humanAuth ?? {}) as Record<string, unknown>;
  const resolvedWorkspaceDir = resolvePath(String(merged.workspaceDir));
  const resolvedStateDir = resolvePath(String(merged.stateDir));

  const cfg: OpenPocketConfig = {
    projectName: String(merged.projectName),
    workspaceDir: resolvedWorkspaceDir,
    stateDir: resolvedStateDir,
    defaultModel,
    emulator: {
      avdName: String(emulator.avdName ?? "OpenPocket_AVD"),
      androidSdkRoot: String(emulator.androidSdkRoot ?? ""),
      headless: Boolean(emulator.headless),
      bootTimeoutSec: Number(emulator.bootTimeoutSec ?? 180),
    },
    telegram: {
      botToken: String(telegram.botToken ?? ""),
      botTokenEnv: String(telegram.botTokenEnv ?? "TELEGRAM_BOT_TOKEN"),
      allowedChatIds: Array.isArray(telegram.allowedChatIds)
        ? telegram.allowedChatIds.map((id) => Number(id)).filter(Number.isFinite)
        : [],
      pollTimeoutSec: Number(telegram.pollTimeoutSec ?? 25),
    },
    agent: {
      maxSteps: Number(agent.maxSteps ?? 50),
      loopDelayMs: Number(agent.loopDelayMs ?? 1200),
      progressReportInterval: Math.max(1, Number(agent.progressReportInterval ?? 1)),
      returnHomeOnTaskEnd: Boolean(agent.returnHomeOnTaskEnd ?? true),
      lang: "en",
      verbose: Boolean(agent.verbose),
      deviceId: agent.deviceId ? String(agent.deviceId) : null,
    },
    screenshots: {
      saveStepScreenshots: Boolean(screenshots.saveStepScreenshots ?? true),
      directory: resolvePath(String(screenshots.directory ?? path.join(resolvedStateDir, "screenshots"))),
      maxCount: Math.max(20, Number(screenshots.maxCount ?? 400)),
    },
    scriptExecutor: {
      enabled: Boolean(scriptExecutor.enabled ?? true),
      timeoutSec: Math.max(1, Number(scriptExecutor.timeoutSec ?? 60)),
      maxOutputChars: Math.max(1000, Number(scriptExecutor.maxOutputChars ?? 6000)),
      allowedCommands: Array.isArray(scriptExecutor.allowedCommands)
        ? scriptExecutor.allowedCommands.map((v) => String(v))
        : defaultConfigObject().scriptExecutor.allowedCommands,
    },
    heartbeat: {
      enabled: Boolean(heartbeat.enabled ?? true),
      everySec: Math.max(5, Number(heartbeat.everySec ?? 30)),
      stuckTaskWarnSec: Math.max(30, Number(heartbeat.stuckTaskWarnSec ?? 600)),
      writeLogFile: Boolean(heartbeat.writeLogFile ?? true),
    },
    cron: {
      enabled: Boolean(cron.enabled ?? true),
      tickSec: Math.max(2, Number(cron.tickSec ?? 10)),
      jobsFile: resolvePath(String(cron.jobsFile ?? path.join(resolvedWorkspaceDir, "cron", "jobs.json"))),
    },
    humanAuth: {
      enabled: Boolean(humanAuth.enabled ?? false),
      relayBaseUrl: String(humanAuth.relayBaseUrl ?? "").trim().replace(/\/+$/, ""),
      publicBaseUrl: String(humanAuth.publicBaseUrl ?? "").trim().replace(/\/+$/, ""),
      apiKey: String(humanAuth.apiKey ?? ""),
      apiKeyEnv: String(humanAuth.apiKeyEnv ?? "OPENPOCKET_HUMAN_AUTH_KEY"),
      requestTimeoutSec: Math.max(30, Number(humanAuth.requestTimeoutSec ?? 300)),
      pollIntervalMs: Math.max(500, Number(humanAuth.pollIntervalMs ?? 2000)),
    },
    models,
    configPath,
  };

  return cfg;
}

export function loadConfig(configPath?: string): OpenPocketConfig {
  const finalPath = configPath ? resolvePath(configPath) : defaultConfigPath();
  ensureDir(path.dirname(finalPath));

  if (!fs.existsSync(finalPath)) {
    fs.writeFileSync(finalPath, `${JSON.stringify(defaultConfigObject(), null, 2)}\n`, "utf-8");
  }

  const raw = JSON.parse(fs.readFileSync(finalPath, "utf-8"));
  const cfg = normalizeConfig(raw, finalPath);

  ensureDir(cfg.stateDir);
  ensureDir(cfg.screenshots.directory);
  ensureDir(cfg.workspaceDir);
  ensureDir(path.dirname(cfg.cron.jobsFile));
  ensureWorkspaceBootstrap(cfg.workspaceDir);
  return cfg;
}

export function saveConfig(config: OpenPocketConfig): void {
  const payload = {
    projectName: config.projectName,
    workspaceDir: config.workspaceDir,
    stateDir: config.stateDir,
    defaultModel: config.defaultModel,
    emulator: config.emulator,
    telegram: config.telegram,
    agent: config.agent,
    screenshots: config.screenshots,
    scriptExecutor: config.scriptExecutor,
    heartbeat: config.heartbeat,
    cron: config.cron,
    humanAuth: config.humanAuth,
    models: config.models,
  };
  fs.writeFileSync(config.configPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

export function getModelProfile(config: OpenPocketConfig, name?: string): ModelProfile {
  const key = name ?? config.defaultModel;
  const profile = config.models[key];
  if (!profile) {
    throw new Error(`Unknown model profile: ${key}`);
  }
  return profile;
}

export function resolveApiKey(profile: ModelProfile): string {
  if (profile.apiKey?.trim()) {
    return profile.apiKey.trim();
  }
  if (profile.apiKeyEnv?.trim()) {
    return process.env[profile.apiKeyEnv]?.trim() ?? "";
  }
  return "";
}
