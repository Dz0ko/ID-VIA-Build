import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ModelConfig } from "../settings";

export interface GenerateInput {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
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

export const anthropicProvider: AIProvider = {
  id: "anthropic",
  available: () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  async generate(model, input) {
    const client = anthropic();
    const isFableOrOpus5 = /fable|opus-5|sonnet-5/.test(model);
    const stream = client.messages.stream(
      {
        model,
        max_tokens: input.maxOutput ?? 32000,
        system: [
          { type: "text", text: input.system, cache_control: { type: "ephemeral" } },
        ],
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        ...(isFableOrOpus5 || /opus-4-[678]|sonnet-4-6/.test(model)
          ? {
              thinking: { type: "adaptive" as const },
              output_config: { effort: input.effort ?? "medium" },
            }
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
    const stream = await client.chat.completions.create(
      {
        model,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: input.system },
          ...input.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      },
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
    // Lazy import to avoid pulling templates into every route.
    const { mockGenerate } = await import("./mock");
    const text = await mockGenerate(input);
    // simulate streaming
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
