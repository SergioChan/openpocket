import OpenAI from "openai";

import type { OpenPocketConfig } from "../types";
import { getModelProfile, resolveModelAuth } from "../config";

type MsgRole = "user" | "assistant";

interface ChatTurn {
  role: MsgRole;
  content: string;
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
  private modeHint: "responses" | "chat" | "completions" = "responses";

  constructor(config: OpenPocketConfig) {
    this.config = config;
  }

  clear(chatId: number): void {
    this.history.delete(chatId);
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
    void chatId;
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
