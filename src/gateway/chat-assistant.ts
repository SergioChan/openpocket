import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

import type { OpenPocketConfig } from "../types";
import { getModelProfile, resolveModelAuth } from "../config";

type MsgRole = "user" | "assistant";

interface ChatTurn {
  role: MsgRole;
  content: string;
}

type OnboardingStep = 1 | 2 | 3;
type OnboardingLocale = "zh" | "en";

interface ProfileOnboardingState {
  step: OnboardingStep;
  locale: OnboardingLocale;
  userPreferredAddress?: string;
  assistantName?: string;
  assistantPersona?: string;
}

export interface ChatDecision {
  mode: "task" | "chat";
  task: string;
  reply: string;
  confidence: number;
  reason: string;
}

function readResponseOutputText(response: unknown): string {
  if (typeof response !== "object" || response === null) {
    return "";
  }

  const withOutputText = response as { output_text?: unknown };
  if (typeof withOutputText.output_text === "string" && withOutputText.output_text.trim()) {
    return withOutputText.output_text.trim();
  }

  const chunks: string[] = [];
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (typeof part !== "object" || part === null) {
        continue;
      }
      const typed = part as { type?: unknown; text?: unknown };
      if ((typed.type === "output_text" || typed.type === "text") && typeof typed.text === "string") {
        chunks.push(typed.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class ChatAssistant {
  private readonly config: OpenPocketConfig;
  private readonly history = new Map<number, ChatTurn[]>();
  private readonly profileOnboarding = new Map<number, ProfileOnboardingState>();
  private readonly pendingProfileUpdates =
    new Map<number, { assistantName: string; locale: OnboardingLocale }>();
  private modeHint: "responses" | "chat" | "completions" = "responses";

  constructor(config: OpenPocketConfig) {
    this.config = config;
  }

  clear(chatId: number): void {
    this.history.delete(chatId);
    this.profileOnboarding.delete(chatId);
    this.pendingProfileUpdates.delete(chatId);
  }

  consumePendingProfileUpdate(
    chatId: number,
  ): { assistantName: string; locale: OnboardingLocale } | null {
    const payload = this.pendingProfileUpdates.get(chatId) ?? null;
    this.pendingProfileUpdates.delete(chatId);
    return payload;
  }

  private profileFilePath(name: "IDENTITY.md" | "USER.md"): string {
    return path.join(this.config.workspaceDir, name);
  }

  private readTextSafe(filePath: string): string {
    try {
      if (!fs.existsSync(filePath)) {
        return "";
      }
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return "";
    }
  }

  private writeTextSafe(filePath: string, content: string): void {
    fs.writeFileSync(filePath, `${content.trim()}\n`, "utf-8");
  }

  private normalizeOneLine(input: string): string {
    return input.replace(/\s+/g, " ").trim();
  }

  private extractBulletValue(content: string, key: string): string {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^-\\s*${escaped}\\s*:\\s*(.*)$`, "i");
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    for (const line of lines) {
      const match = line.match(regex);
      if (!match) {
        continue;
      }
      return this.normalizeOneLine(match[1] ?? "");
    }
    return "";
  }

  private isPlaceholderValue(value: string, extra: string[] = []): boolean {
    const normalized = this.normalizeOneLine(value).toLowerCase();
    if (!normalized) {
      return true;
    }
    const placeholders = new Set([
      "unknown",
      "tbd",
      "todo",
      "null",
      "n/a",
      "none",
      "placeholder",
      ...extra.map((v) => v.toLowerCase()),
    ]);
    return placeholders.has(normalized);
  }

  private needsIdentityOnboarding(): boolean {
    const content = this.readTextSafe(this.profileFilePath("IDENTITY.md")).trim();
    if (!content) {
      return true;
    }
    const name = this.extractBulletValue(content, "Name");
    if (this.isPlaceholderValue(name, ["openpocket"])) {
      return true;
    }
    const persona = this.extractBulletValue(content, "Persona");
    if (this.isPlaceholderValue(persona)) {
      return true;
    }
    return false;
  }

  private needsUserOnboarding(): boolean {
    const content = this.readTextSafe(this.profileFilePath("USER.md")).trim();
    if (!content) {
      return true;
    }
    const preferred = this.extractBulletValue(content, "Preferred form of address")
      || this.extractBulletValue(content, "What to call them");
    if (this.isPlaceholderValue(preferred)) {
      return true;
    }
    return false;
  }

  private needsProfileOnboarding(): boolean {
    // Run onboarding if either profile file is missing critical identity fields.
    return this.needsIdentityOnboarding() || this.needsUserOnboarding();
  }

  private detectOnboardingLocale(input: string): OnboardingLocale {
    // Use a simple CJK signal so onboarding language follows the user's first message.
    return /[\u4e00-\u9fff]/.test(input) ? "zh" : "en";
  }

  private questionForStep(step: OnboardingStep, locale: OnboardingLocale): string {
    if (locale === "zh") {
      if (step === 1) {
        return "先做个简短初始化：我该怎么称呼你？如果你愿意，也可以一次告诉我你希望我叫什么和什么人设。";
      }
      if (step === 2) {
        return "收到。那你希望我叫什么名字？";
      }
      return [
        "最后一步：设定我的人设/语气。",
        "你可以直接描述，也可以选编号：",
        "1) 专业可靠：清晰、稳健、少废话",
        "2) 高效直给：结果导向、节奏快",
        "3) 温和陪伴：耐心解释、语气柔和",
        "4) 幽默轻松：轻松自然，但不影响执行",
        "回复示例：`2` 或 `专业可靠，简洁，必要时幽默`",
      ].join("\n");
    }

    if (step === 1) {
      return "Quick setup before we continue: how would you like me to address you? You can also tell me my name and persona in one message.";
    }
    if (step === 2) {
      return "Great. What name would you like to call me?";
    }
    return [
      "Final step: choose my persona/tone.",
      "You can describe it freely, or pick one preset:",
      "1) Professional & reliable: clear, stable, minimal fluff",
      "2) Fast & direct: action-oriented, concise, high tempo",
      "3) Warm & supportive: patient guidance, softer tone",
      "4) Light & humorous: relaxed tone while staying task-focused",
      "Reply example: `2` or `professional, concise, lightly humorous`",
    ].join("\n");
  }

  private pickFallback(locale: OnboardingLocale, key: "user" | "assistant" | "persona"): string {
    if (locale === "zh") {
      if (key === "user") return "用户";
      if (key === "assistant") return "OpenPocket";
      return "务实、冷静、可靠";
    }
    if (key === "user") return "User";
    if (key === "assistant") return "OpenPocket";
    return "pragmatic, calm, and reliable";
  }

  private extractByPatterns(input: string, patterns: RegExp[]): string {
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (!match?.[1]) {
        continue;
      }
      const value = this.normalizeOneLine(match[1].replace(/^["'“”‘’]+|["'“”‘’]+$/g, ""));
      if (value) {
        return value;
      }
    }
    return "";
  }

  private parseOnboardingFields(input: string): Partial<Pick<ProfileOnboardingState, "userPreferredAddress" | "assistantName" | "assistantPersona">> {
    const out: Partial<Pick<ProfileOnboardingState, "userPreferredAddress" | "assistantName" | "assistantPersona">> = {};
    const normalized = this.normalizeOneLine(input);
    if (!normalized) {
      return out;
    }

    const userPreferredAddress = this.extractByPatterns(normalized, [
      /(?:叫我|称呼我|你可以叫我|喊我)\s*[:：]?\s*([^,，。;；\n]+)/i,
      /(?:call me|address me as|you can call me)\s+([^,.;\n]+)/i,
    ]);
    const assistantName = this.extractByPatterns(normalized, [
      /(?:你叫|你就叫|称呼你为|我叫你|我希望你叫)\s*[:：]?\s*([^,，。;；\n]+)/i,
      /(?:call you|your name is|i want to call you)\s+([^,.;\n]+)/i,
    ]);
    const assistantPersona = this.extractByPatterns(normalized, [
      /(?:人设|风格|语气|设定)\s*[:：]?\s*([^。;；\n]+)/i,
      /(?:persona|tone|style)\s*(?:is|:)?\s*([^.;\n]+)/i,
    ]);

    if (userPreferredAddress) {
      out.userPreferredAddress = userPreferredAddress;
    }
    if (assistantName) {
      out.assistantName = assistantName;
    }
    if (assistantPersona) {
      out.assistantPersona = assistantPersona;
    }

    return out;
  }

  private personaPresetFromAnswer(answer: string, locale: OnboardingLocale): string {
    const normalized = this.normalizeOneLine(answer).toLowerCase();
    const presetMapZh: Record<string, string> = {
      "1": "专业可靠：清晰、稳健、少废话",
      "2": "高效直给：结果导向、节奏快",
      "3": "温和陪伴：耐心解释、语气柔和",
      "4": "幽默轻松：轻松自然，但不影响执行",
      a: "专业可靠：清晰、稳健、少废话",
      b: "高效直给：结果导向、节奏快",
      c: "温和陪伴：耐心解释、语气柔和",
      d: "幽默轻松：轻松自然，但不影响执行",
      "选1": "专业可靠：清晰、稳健、少废话",
      "选2": "高效直给：结果导向、节奏快",
      "选3": "温和陪伴：耐心解释、语气柔和",
      "选4": "幽默轻松：轻松自然，但不影响执行",
      "方案1": "专业可靠：清晰、稳健、少废话",
      "方案2": "高效直给：结果导向、节奏快",
      "方案3": "温和陪伴：耐心解释、语气柔和",
      "方案4": "幽默轻松：轻松自然，但不影响执行",
    };
    const presetMapEn: Record<string, string> = {
      "1": "professional and reliable: clear, stable, minimal fluff",
      "2": "fast and direct: action-oriented, concise, high tempo",
      "3": "warm and supportive: patient guidance, softer tone",
      "4": "light and humorous: relaxed tone while staying task-focused",
      a: "professional and reliable: clear, stable, minimal fluff",
      b: "fast and direct: action-oriented, concise, high tempo",
      c: "warm and supportive: patient guidance, softer tone",
      d: "light and humorous: relaxed tone while staying task-focused",
      option1: "professional and reliable: clear, stable, minimal fluff",
      option2: "fast and direct: action-oriented, concise, high tempo",
      option3: "warm and supportive: patient guidance, softer tone",
      option4: "light and humorous: relaxed tone while staying task-focused",
    };
    const table = locale === "zh" ? presetMapZh : presetMapEn;
    return table[normalized] ?? "";
  }

  private resolvePersonaAnswer(answer: string, locale: OnboardingLocale): string {
    const preset = this.personaPresetFromAnswer(answer, locale);
    if (preset) {
      return preset;
    }
    return answer;
  }

  private applyThreePartFallback(state: ProfileOnboardingState, answer: string): void {
    if (state.step !== 1) {
      return;
    }
    if (state.userPreferredAddress || state.assistantName || state.assistantPersona) {
      return;
    }
    const parts = answer
      .split(/[,\n;；|]/)
      .map((v) => this.normalizeOneLine(v))
      .filter(Boolean);
    if (parts.length !== 3) {
      return;
    }
    if (parts.some((part) => part.length > 80)) {
      return;
    }
    [state.userPreferredAddress, state.assistantName, state.assistantPersona] = parts;
  }

  private firstMissingStep(state: ProfileOnboardingState): OnboardingStep | null {
    if (!state.userPreferredAddress) return 1;
    if (!state.assistantName) return 2;
    if (!state.assistantPersona) return 3;
    return null;
  }

  private buildIdentityFromAnswers(params: {
    assistantName: string;
    assistantPersona: string;
  }): string {
    return [
      "# IDENTITY",
      "",
      "## Agent Identity",
      "",
      `- Name: ${params.assistantName}`,
      "- Role: Android phone-use automation agent",
      `- Persona: ${params.assistantPersona}`,
      "- Primary objective: execute user tasks safely and efficiently",
      "",
      "## Behavioral Defaults",
      "",
      "- Language for model thought/action text: English",
      "- Planning style: sub-goal driven, one deterministic step at a time",
      "- Escalation trigger: request_human_auth when real-device authorization is required",
    ].join("\n");
  }

  private buildUserFromAnswers(params: {
    userPreferredAddress: string;
    assistantName: string;
    assistantPersona: string;
  }): string {
    return [
      "# USER",
      "",
      "Record user-specific preferences and constraints.",
      "",
      "## Profile",
      "",
      "- Name:",
      `- Preferred form of address: ${params.userPreferredAddress}`,
      "- Timezone:",
      "- Language preference:",
      "",
      "## Interaction Preferences",
      "",
      "- Verbosity:",
      "- Risk tolerance:",
      "- Confirmation preference for external actions:",
      `- Preferred assistant name: ${params.assistantName}`,
      `- Preferred assistant persona: ${params.assistantPersona}`,
      "",
      "## Task Preferences",
      "",
      "- Preferred apps/services:",
      "- Avoided apps/services:",
      "- Recurring goals:",
      "",
      "## Notes",
      "",
      "- Add durable preferences here.",
      "- Keep sensitive details minimal.",
    ].join("\n");
  }

  private applyProfileOnboarding(chatId: number, inputText: string): string | null {
    const needs = this.needsProfileOnboarding();
    const current = this.profileOnboarding.get(chatId);
    if (!needs && !current) {
      return null;
    }

    const answer = this.normalizeOneLine(inputText);
    if (!current) {
      const locale = this.detectOnboardingLocale(inputText);
      const state: ProfileOnboardingState = {
        step: 1,
        locale,
      };

      if (answer) {
        const parsed = this.parseOnboardingFields(answer);
        if (parsed.userPreferredAddress) state.userPreferredAddress = parsed.userPreferredAddress;
        if (parsed.assistantName) state.assistantName = parsed.assistantName;
        if (parsed.assistantPersona) {
          state.assistantPersona = this.resolvePersonaAnswer(parsed.assistantPersona, state.locale);
        }
        this.applyThreePartFallback(state, answer);
        const firstMissing = this.firstMissingStep(state);
        if (firstMissing) {
          state.step = firstMissing;
          this.profileOnboarding.set(chatId, state);
          return this.questionForStep(firstMissing, state.locale);
        }
        this.profileOnboarding.set(chatId, state);
      } else {
        this.profileOnboarding.set(chatId, state);
        return this.questionForStep(1, locale);
      }
    } else if (!answer) {
      return current.locale === "zh"
        ? "请用一句话回答，我会帮你写入 profile。"
        : "Please answer in one short sentence so I can save your profile.";
    } else {
      const parsed = this.parseOnboardingFields(answer);

      if (parsed.userPreferredAddress) current.userPreferredAddress = parsed.userPreferredAddress;
      if (parsed.assistantName) current.assistantName = parsed.assistantName;
      if (parsed.assistantPersona) {
        current.assistantPersona = this.resolvePersonaAnswer(parsed.assistantPersona, current.locale);
      }
      this.applyThreePartFallback(current, answer);

      // If user answered naturally without keywords, map answer to current step.
      if (current.step === 1 && !current.userPreferredAddress) {
        current.userPreferredAddress = answer;
      } else if (current.step === 2 && !current.assistantName) {
        current.assistantName = answer;
      } else if (current.step === 3 && !current.assistantPersona) {
        current.assistantPersona = this.resolvePersonaAnswer(answer, current.locale);
      }

      const firstMissing = this.firstMissingStep(current);
      if (firstMissing) {
        current.step = firstMissing;
        this.profileOnboarding.set(chatId, current);
        return this.questionForStep(firstMissing, current.locale);
      }
    }

    const finalized = this.profileOnboarding.get(chatId);
    if (!finalized) {
      return null;
    }
    const userPreferredAddress = finalized.userPreferredAddress ?? this.pickFallback(finalized.locale, "user");
    const assistantName = finalized.assistantName ?? this.pickFallback(finalized.locale, "assistant");
    const assistantPersona = finalized.assistantPersona ?? this.pickFallback(finalized.locale, "persona");

    this.writeTextSafe(
      this.profileFilePath("IDENTITY.md"),
      this.buildIdentityFromAnswers({
        assistantName,
        assistantPersona,
      }),
    );
    this.writeTextSafe(
      this.profileFilePath("USER.md"),
      this.buildUserFromAnswers({
        userPreferredAddress,
        assistantName,
        assistantPersona,
      }),
    );
    this.pendingProfileUpdates.set(chatId, {
      assistantName,
      locale: finalized.locale,
    });
    this.profileOnboarding.delete(chatId);
    if (finalized.locale === "zh") {
      return `好，我已经写入 USER.md 和 IDENTITY.md。后续我会称呼你为“${userPreferredAddress}”，我的名字是“${assistantName}”，人设是“${assistantPersona}”。`;
    }
    return `Done. I saved your profile to USER.md and IDENTITY.md. I will address you as "${userPreferredAddress}", and use "${assistantName}" with persona "${assistantPersona}".`;
  }

  private systemPrompt(): string {
    return [
      "You are OpenPocket conversational assistant.",
      "Keep answers concise and practical.",
      "Users can talk naturally without command syntax.",
      "Do not expose internal file paths, session files, skills, or scripts in user-facing replies.",
      "For requests that are not device automation tasks, answer directly in chat.",
    ].join("\n");
  }

  private recentTurns(chatId: number): ChatTurn[] {
    return (this.history.get(chatId) ?? []).slice(-12);
  }

  private pushTurn(chatId: number, role: MsgRole, content: string): void {
    const turns = this.history.get(chatId) ?? [];
    turns.push({ role, content });
    this.history.set(chatId, turns.slice(-20));
  }

  private async classifyWithModel(
    client: OpenAI,
    model: string,
    maxTokens: number,
    inputText: string,
  ): Promise<ChatDecision> {
    const prompt = [
      "Classify the user message for phone assistant routing.",
      "Output strict JSON only:",
      '{"mode":"task|chat","task":"<task or empty>","reply":"<chat reply or empty>","confidence":0-1,"reason":"..."}',
      "Rules:",
      "1) mode=task when user wants the assistant to operate phone/apps.",
      "2) mode=chat for small talk, explanation, status discussion, and generic questions.",
      "3) task should be executable imperative sentence.",
      "4) for chat mode, reply should be concise.",
      `User message: ${inputText}`,
    ].join("\n");

    const tryModes: Array<"responses" | "chat" | "completions"> =
      this.modeHint === "responses"
        ? ["responses", "chat", "completions"]
        : this.modeHint === "chat"
          ? ["chat", "responses", "completions"]
          : ["completions", "responses", "chat"];

    let output = "";
    const errors: string[] = [];
    for (const mode of tryModes) {
      try {
        if (mode === "responses") {
          const response = await client.responses.create({
            model,
            max_output_tokens: Math.min(maxTokens, 300),
            input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
          } as never);
          output = readResponseOutputText(response);
        } else if (mode === "chat") {
          const response = await client.chat.completions.create({
            model,
            max_tokens: Math.min(maxTokens, 300),
            messages: [{ role: "user", content: prompt }],
          } as never);
          output = typeof response.choices?.[0]?.message?.content === "string"
            ? response.choices?.[0]?.message?.content.trim()
            : "";
        } else {
          const response = await client.completions.create({
            model,
            max_tokens: Math.min(maxTokens, 300),
            prompt,
          } as never);
          output = (response.choices?.[0]?.text ?? "").trim();
        }

        if (output) {
          if (this.modeHint !== mode) {
            this.modeHint = mode;
            // eslint-disable-next-line no-console
            console.log(`[OpenPocket][chat] switched endpoint mode -> ${mode}`);
          }
          break;
        }
      } catch (error) {
        errors.push(`${mode}: ${stringifyError(error)}`);
      }
    }

    if (!output) {
      throw new Error(`classify failed: ${errors.join(" | ")}`);
    }

    const jsonText = (() => {
      const fenced = output.match(/```json\s*([\s\S]*?)```/i) ?? output.match(/```\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        return fenced[1].trim();
      }
      const start = output.indexOf("{");
      const end = output.lastIndexOf("}");
      if (start >= 0 && end > start) {
        return output.slice(start, end + 1);
      }
      return output.trim();
    })();

    try {
      const parsed = JSON.parse(jsonText) as Partial<ChatDecision>;
      const mode = parsed.mode === "task" ? "task" : "chat";
      return {
        mode,
        task: typeof parsed.task === "string" ? parsed.task.trim() : "",
        reply: typeof parsed.reply === "string" ? parsed.reply.trim() : "",
        confidence:
          typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
            ? parsed.confidence
            : 0.5,
        reason: typeof parsed.reason === "string" ? parsed.reason : "model_classify",
      };
    } catch {
      return {
        mode: "chat",
        task: "",
        reply: "",
        confidence: 0.3,
        reason: "model_output_not_json",
      };
    }
  }

  private async askResponses(client: OpenAI, model: string, maxTokens: number, inputText: string, chatId: number): Promise<string> {
    const input: Array<Record<string, unknown>> = [
      {
        role: "system",
        content: [{ type: "input_text", text: this.systemPrompt() }],
      },
      ...this.recentTurns(chatId).map((turn) => ({
        role: turn.role,
        content: [{ type: "input_text", text: turn.content }],
      })),
      {
        role: "user",
        content: [{ type: "input_text", text: inputText }],
      },
    ];

    const response = await client.responses.create({
      model,
      max_output_tokens: Math.min(maxTokens, 800),
      input,
    } as never);

    const text = readResponseOutputText(response);
    if (!text) {
      throw new Error("Responses API returned empty text output.");
    }
    return text;
  }

  private async askChat(client: OpenAI, model: string, maxTokens: number, inputText: string, chatId: number): Promise<string> {
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: this.systemPrompt() },
      ...this.recentTurns(chatId).map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: inputText },
    ];

    const response = await client.chat.completions.create({
      model,
      max_tokens: Math.min(maxTokens, 800),
      messages,
    } as never);

    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const text = content
        .map((item) => (typeof item === "object" && item && "text" in item ? String((item as { text?: unknown }).text ?? "") : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) {
        return text;
      }
    }
    throw new Error("Chat Completions API returned empty text output.");
  }

  private async askCompletions(client: OpenAI, model: string, maxTokens: number, inputText: string, chatId: number): Promise<string> {
    const transcript = this.recentTurns(chatId)
      .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
      .join("\n");

    const prompt = [
      this.systemPrompt(),
      transcript ? `\nConversation:\n${transcript}` : "",
      `\nUSER: ${inputText}`,
      "ASSISTANT:",
    ].join("\n");

    const response = await client.completions.create({
      model,
      max_tokens: Math.min(maxTokens, 800),
      prompt,
    } as never);

    const text = (response.choices?.[0]?.text ?? "").trim();
    if (!text) {
      throw new Error("Completions API returned empty text output.");
    }
    return text;
  }

  async reply(chatId: number, inputText: string): Promise<string> {
    const profile = getModelProfile(this.config);
    const auth = resolveModelAuth(profile);
    if (!auth) {
      const codexHint = profile.model.toLowerCase().includes("codex")
        ? " or login with Codex CLI"
        : "";
      return `API key for model '${profile.model}' is not configured. Configure it${codexHint} and try again.`;
    }

    const client = new OpenAI({
      apiKey: auth.apiKey,
      baseURL: auth.baseUrl ?? profile.baseUrl,
    });

    const modes: Array<"responses" | "chat" | "completions"> =
      this.modeHint === "responses"
        ? ["responses", "chat", "completions"]
        : this.modeHint === "chat"
          ? ["chat", "responses", "completions"]
          : ["completions", "responses", "chat"];

    let reply = "";
    const errors: string[] = [];

    for (const mode of modes) {
      try {
        if (mode === "responses") {
          reply = await this.askResponses(client, profile.model, profile.maxTokens, inputText, chatId);
        } else if (mode === "chat") {
          reply = await this.askChat(client, profile.model, profile.maxTokens, inputText, chatId);
        } else {
          reply = await this.askCompletions(client, profile.model, profile.maxTokens, inputText, chatId);
        }
        if (this.modeHint !== mode) {
          this.modeHint = mode;
          // eslint-disable-next-line no-console
          console.log(`[OpenPocket][chat] switched endpoint mode -> ${mode}`);
        }
        break;
      } catch (error) {
        errors.push(`${mode}: ${stringifyError(error)}`);
      }
    }

    if (!reply) {
      return `Conversation failed: ${errors.join(" | ")}`;
    }

    this.pushTurn(chatId, "user", inputText);
    this.pushTurn(chatId, "assistant", reply);
    return reply;
  }

  async decide(chatId: number, inputText: string): Promise<ChatDecision> {
    const normalizedInput = inputText.trim();
    if (!normalizedInput) {
      return {
        mode: "chat",
        task: "",
        reply: "Please share a request and I will respond.",
        confidence: 1,
        reason: "empty_input",
      };
    }

    const onboardingReply = this.applyProfileOnboarding(chatId, normalizedInput);
    if (onboardingReply) {
      this.pushTurn(chatId, "user", normalizedInput);
      this.pushTurn(chatId, "assistant", onboardingReply);
      return {
        mode: "chat",
        task: "",
        reply: onboardingReply,
        confidence: 1,
        reason: "profile_onboarding",
      };
    }

    const profile = getModelProfile(this.config);
    const auth = resolveModelAuth(profile);
    if (!auth) {
      return {
        mode: "chat",
        task: "",
        reply: "API key not configured. I can still answer basic questions.",
        confidence: 0.4,
        reason: "no_api_key",
      };
    }

    const client = new OpenAI({
      apiKey: auth.apiKey,
      baseURL: auth.baseUrl ?? profile.baseUrl,
    });
    try {
      const decided = await this.classifyWithModel(
        client,
        profile.model,
        profile.maxTokens,
        normalizedInput,
      );
      if (decided.mode === "task" && !decided.task) {
        decided.task = normalizedInput;
      }
      return decided;
    } catch {
      return {
        mode: "task",
        task: normalizedInput,
        reply: "",
        confidence: 0.5,
        reason: "fallback_task",
      };
    }
  }
}
