import OpenAI from "openai";

import type { AgentAction, ModelProfile, ModelStepOutput, ScreenSnapshot } from "../types";
import { normalizeAction } from "./actions";
import { buildUserPrompt } from "./prompts";

function extractJsonObject(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = text.indexOf("{");
  if (start < 0) {
    return text.trim();
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1).trim();
      }
    }
  }

  return text.trim();
}

function readContent(raw: unknown): string {
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    const textChunks = raw
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          (item as { type?: string }).type === "text" &&
          "text" in item
        ) {
          return String((item as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .filter(Boolean);
    return textChunks.join("\n");
  }
  return "";
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
      if (
        (typed.type === "output_text" || typed.type === "text") &&
        typeof typed.text === "string"
      ) {
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

export class ModelClient {
  private readonly client: OpenAI;
  private readonly profile: ModelProfile;
  private modeHint: "chat" | "responses" | "completions" = "chat";

  constructor(profile: ModelProfile, apiKey: string) {
    this.profile = profile;
    this.client = new OpenAI({ apiKey, baseURL: profile.baseUrl });
  }

  private buildChatRequest(params: {
    systemPrompt: string;
    userText: string;
    snapshot: ScreenSnapshot;
  }): Record<string, unknown> {
    const request: Record<string, unknown> = {
      model: this.profile.model,
      max_tokens: this.profile.maxTokens,
      messages: [
        {
          role: "system",
          content: params.systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: params.userText,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${params.snapshot.screenshotBase64}`,
              },
            },
          ],
        },
      ],
    };

    if (this.profile.reasoningEffort) {
      request.reasoning_effort = this.profile.reasoningEffort;
    }
    if (this.profile.temperature !== null) {
      request.temperature = this.profile.temperature;
    }
    return request;
  }

  private buildResponsesRequest(params: {
    systemPrompt: string;
    userText: string;
    snapshot: ScreenSnapshot;
  }): Record<string, unknown> {
    const request: Record<string, unknown> = {
      model: this.profile.model,
      max_output_tokens: this.profile.maxTokens,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: params.systemPrompt }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: params.userText },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${params.snapshot.screenshotBase64}`,
            },
          ],
        },
      ],
    };

    if (this.profile.reasoningEffort) {
      request.reasoning = { effort: this.profile.reasoningEffort };
    }
    if (this.profile.temperature !== null) {
      request.temperature = this.profile.temperature;
    }
    return request;
  }

  private buildCompletionsRequest(params: {
    systemPrompt: string;
    userText: string;
  }): Record<string, unknown> {
    const request: Record<string, unknown> = {
      model: this.profile.model,
      max_tokens: this.profile.maxTokens,
      prompt: `${params.systemPrompt}\n\n${params.userText}\n\nReturn JSON only.`,
    };
    if (this.profile.temperature !== null) {
      request.temperature = this.profile.temperature;
    }
    return request;
  }

  private async requestByMode(
    mode: "chat" | "responses" | "completions",
    params: {
      systemPrompt: string;
      userText: string;
      snapshot: ScreenSnapshot;
    },
  ): Promise<string> {
    if (mode === "chat") {
      const response = await this.client.chat.completions.create(
        this.buildChatRequest(params) as never,
      );
      return readContent(response.choices?.[0]?.message?.content ?? "").trim();
    }

    if (mode === "responses") {
      const response = await this.client.responses.create(
        this.buildResponsesRequest(params) as never,
      );
      const text = readResponseOutputText(response);
      if (!text) {
        throw new Error("Responses API returned empty text output.");
      }
      return text;
    }

    const response = await this.client.completions.create(
      this.buildCompletionsRequest(params) as never,
    );
    const text = (response.choices?.[0]?.text ?? "").trim();
    if (!text) {
      throw new Error("Completions API returned empty text output.");
    }
    return text;
  }

  async nextStep(params: {
    systemPrompt: string;
    task: string;
    step: number;
    snapshot: ScreenSnapshot;
    history: string[];
  }): Promise<ModelStepOutput> {
    const userText = buildUserPrompt(params.task, params.step, params.snapshot, params.history);
    const modes: Array<"chat" | "responses" | "completions"> =
      this.modeHint === "chat"
        ? ["chat", "responses", "completions"]
        : this.modeHint === "responses"
          ? ["responses", "chat", "completions"]
          : ["completions", "responses", "chat"];

    let rawContent = "";
    const errors: string[] = [];

    for (const mode of modes) {
      try {
        rawContent = await this.requestByMode(mode, {
          systemPrompt: params.systemPrompt,
          userText,
          snapshot: params.snapshot,
        });
        if (this.modeHint !== mode) {
          this.modeHint = mode;
          // eslint-disable-next-line no-console
          console.log(`[OpenPocket][model] switched endpoint mode -> ${mode}`);
        }
        break;
      } catch (error) {
        errors.push(`${mode}: ${stringifyError(error)}`);
      }
    }

    if (!rawContent) {
      throw new Error(`All model endpoints failed. ${errors.join(" | ")}`);
    }

    const jsonText = extractJsonObject(rawContent);

    let thought = "";
    let actionRaw: unknown = { type: "wait", durationMs: 1000, reason: "invalid model output" };

    try {
      const parsed = JSON.parse(jsonText) as { thought?: unknown; action?: unknown };
      thought = typeof parsed.thought === "string" ? parsed.thought : "";
      actionRaw = parsed.action ?? actionRaw;
    } catch {
      actionRaw = {
        type: "wait",
        durationMs: 1200,
        reason: "model output was not valid JSON",
      };
      thought = rawContent;
    }

    const action: AgentAction = normalizeAction(actionRaw);
    return {
      thought,
      action,
      raw: rawContent,
    };
  }
}
