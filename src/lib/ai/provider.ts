import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ModelConfig } from "../settings";

export interface InputImage {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string; // base64
}

export interface GenerateInput {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** Optional reference images attached to the LAST user message (vision). */
  images?: InputImage[];
  maxOutput?: number;
  effort?: ModelConfig["effort"];
  /** Optional callback for streamed text chunks. */
  onText?: (delta: string) => void;
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  stopReason?: string | null;
}

export interface AIProvider {
  id: "anthropic" | "openai" | "mock";
  available(): boolean;
  generate(model: string, input: GenerateInput): Promise<GenerateResult>;
}

/* ---------------- Anthropic ---------------- */

let anthropicClient: Anthropic | null = null;
function anthropic() {
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

function anthropicMessages(input: GenerateInput): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = input.messages.map((m) => ({ role: m.role, content: m.content }));
  if (input.images?.length) {
    const last = msgs[msgs.length - 1];
    if (last && last.role === "user" && typeof last.content === "string") {
      msgs[msgs.length - 1] = {
        role: "user",
        content: [
          ...input.images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
          })),
          { type: "text", text: last.content },
        ],
      };
    }
  }
  return msgs;
}

export const anthropicProvider: AIProvider = {
  id: "anthropic",
  available: () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  async generate(model, input) {
    const client = anthropic();
    const adaptive = /fable|opus-5|sonnet-5|opus-4-[678]|sonnet-4-6/.test(model);
    const stream = client.messages.stream(
      {
        model,
        max_tokens: input.maxOutput ?? 32000,
        system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
        messages: anthropicMessages(input),
        ...(adaptive
          ? { thinking: { type: "adaptive" as const }, output_config: { effort: input.effort ?? "medium" } }
          : {}),
      },
      { signal: input.signal },
    );
    stream.on("text", (t) => input.onText?.(t));
    const final = await stream.finalMessage();
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return {
      text,
      model: final.model,
      provider: "anthropic",
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
      stopReason: final.stop_reason,
    };
  },
};

/* ---------------- OpenAI ---------------- */

let openaiClient: OpenAI | null = null;
function openai() {
  if (!openaiClient) openaiClient = new OpenAI();
  return openaiClient;
}

export const openaiProvider: AIProvider = {
  id: "openai",
  available: () => Boolean(process.env.OPENAI_API_KEY),
  async generate(model, input) {
    const client = openai();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: input.system },
      ...input.messages.map((m): OpenAI.ChatCompletionMessageParam => ({ role: m.role, content: m.content })),
    ];
    if (input.images?.length) {
      const last = messages[messages.length - 1];
      if (last.role === "user" && typeof last.content === "string") {
        messages[messages.length - 1] = {
          role: "user",
          content: [
            ...input.images.map((img) => ({ type: "image_url" as const, image_url: { url: `data:${img.mediaType};base64,${img.data}` } })),
            { type: "text" as const, text: last.content },
          ],
        };
      }
    }
    const stream = await client.chat.completions.create(
      { model, stream: true, stream_options: { include_usage: true }, messages },
      { signal: input.signal },
    );
    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        text += delta;
        input.onText?.(delta);
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }
    return { text, model, provider: "openai", inputTokens, outputTokens };
  },
};

/* ---------------- Mock (offline / no keys) ---------------- */

export const mockProvider: AIProvider = {
  id: "mock",
  available: () => true,
  async generate(model, input) {
    const { mockGenerate } = await import("./mock");
    const text = await mockGenerate(input);
    const step = 400;
    for (let i = 0; i < text.length; i += step) {
      input.onText?.(text.slice(i, i + step));
      await new Promise((r) => setTimeout(r, 8));
    }
    return {
      text,
      model: "idaevia-mock",
      provider: "mock",
      inputTokens: Math.round(JSON.stringify(input.messages).length / 4),
      outputTokens: Math.round(text.length / 4),
    };
  },
};

export const PROVIDERS: Record<AIProvider["id"], AIProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  mock: mockProvider,
};
