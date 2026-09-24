import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ModelConfig } from "../settings";
import { outputTokenLimit } from "./output-limit";

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
  cacheCreationTokens?: number;
  stopReason?: string | null;
}

/** A tool the model may call during an agentic edit; `parameters` is a JSON schema object. */
export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolCall = { id: string; name: string; input: unknown };
/** Provider-neutral transcript of an agentic run; `raw` keeps a provider's own assistant blocks (thinking included) for replay. */
export type ToolTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: ToolCall[]; raw?: { provider: string; content: unknown } }
  | { role: "tool"; results: { id: string; name: string; output: string; isError?: boolean }[] };
export interface ToolInput {
  system: string;
  turns: ToolTurn[];
  tools: ToolSpec[];
  maxOutput?: number;
  effort?: ModelConfig["effort"];
  signal?: AbortSignal;
}
export interface ToolResult extends GenerateResult {
  toolCalls: ToolCall[];
  raw?: { provider: string; content: unknown };
}

export interface AIProvider {
  id: "anthropic" | "openai" | "mock";
  available(): boolean;
  generate(model: string, input: GenerateInput): Promise<GenerateResult>;
  /** One turn of an agentic run: the model answers with text and/or tool calls. Absent on providers without tool use. */
  generateWithTools?(model: string, input: ToolInput): Promise<ToolResult>;
}

/** Anthropic replay of a neutral transcript; a turn produced by Anthropic itself is replayed from its own blocks. */
export function anthropicToolMessages(turns: ToolTurn[]): Anthropic.MessageParam[] {
  return turns.map((turn): Anthropic.MessageParam => {
    if (turn.role === "user") return { role: "user", content: turn.content };
    if (turn.role === "tool") return { role: "user", content: turn.results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, content: r.output, ...(r.isError ? { is_error: true } : {}) })) };
    if (turn.raw?.provider === "anthropic") return { role: "assistant", content: turn.raw.content as Anthropic.ContentBlockParam[] };
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (turn.content.trim()) blocks.push({ type: "text", text: turn.content });
    for (const call of turn.toolCalls) blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input ?? {} });
    return { role: "assistant", content: blocks.length ? blocks : [{ type: "text", text: "(continuing)" }] };
  });
}

/** OpenAI replay of a neutral transcript: assistant tool calls carry JSON arguments, results are tool messages. */
export function openaiToolMessages(system: string, turns: ToolTurn[]): OpenAI.ChatCompletionMessageParam[] {
  const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: "system", content: system }];
  for (const turn of turns) {
    if (turn.role === "user") messages.push({ role: "user", content: turn.content });
    else if (turn.role === "tool") for (const r of turn.results) messages.push({ role: "tool", tool_call_id: r.id, content: r.output });
    else messages.push({ role: "assistant", content: turn.content || null, ...(turn.toolCalls.length ? { tool_calls: turn.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } })) } : {}) });
  }
  return messages;
}

/* ---------------- Anthropic ---------------- */

let anthropicClient: Anthropic | null = null;
function anthropic() {
  if (!anthropicClient) anthropicClient = new Anthropic({ maxRetries: 1, timeout: 240_000 });
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
    const frontier = /fable|mythos/.test(model);
    const params = {
      model,
      // Thinking counts against max_tokens on adaptive models; leave room for it beyond the visible budget.
      max_tokens: outputTokenLimit(model, input.maxOutput ?? 32000, input.effort, adaptive),
      system: [{ type: "text" as const, text: input.system, cache_control: { type: "ephemeral" as const } }],
      messages: anthropicMessages(input),
      ...(adaptive
        ? { thinking: { type: "adaptive" as const }, output_config: { effort: input.effort ?? "medium" } }
        : {}),
    };
    // Claude Fable 5.1 runs safety classifiers that can decline a request. The
    // server-side fallback re-runs a declined request on an Opus-class model in
    // the same call, so the user still gets a result and is billed for one run.
    let final: Anthropic.Message | Anthropic.Beta.BetaMessage;
    if (frontier) {
      const stream = client.beta.messages.stream(
        { ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" },
        { signal: input.signal },
      );
      stream.on("text", (t) => input.onText?.(t));
      final = await stream.finalMessage();
    } else {
      const stream = client.messages.stream(params, { signal: input.signal });
      stream.on("text", (t) => input.onText?.(t));
      final = await stream.finalMessage();
    }
    if (final.stop_reason === "refusal") {
      throw new Error("The model declined this request. Rephrase it or try a different tier. Your credits have been refunded.");
    }
    const text = final.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return {
      text,
      model: final.model,
      provider: "anthropic",
      inputTokens: final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0),
      cacheCreationTokens: final.usage.cache_creation_input_tokens ?? 0,
      outputTokens: final.usage.output_tokens,
      cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
      stopReason: final.stop_reason,
    };
  },
  async generateWithTools(model, input) {
    const client = anthropic();
    const adaptive = /fable|opus-5|sonnet-5|opus-4-[678]|sonnet-4-6/.test(model);
    const stream = client.messages.stream({
      model,
      max_tokens: outputTokenLimit(model, input.maxOutput ?? 16000, input.effort, adaptive),
      system: [{ type: "text" as const, text: input.system, cache_control: { type: "ephemeral" as const } }],
      messages: anthropicToolMessages(input.turns),
      tools: input.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Tool.InputSchema })),
      ...(adaptive ? { thinking: { type: "adaptive" as const }, output_config: { effort: input.effort ?? "medium" } } : {}),
    }, { signal: input.signal });
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") throw new Error("The model declined this request. Rephrase it or try a different tier. Your credits have been refunded.");
    return {
      text: final.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
      toolCalls: final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, input: b.input })),
      raw: { provider: "anthropic", content: final.content },
      model: final.model,
      provider: "anthropic",
      inputTokens: final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0),
      cacheCreationTokens: final.usage.cache_creation_input_tokens ?? 0,
      outputTokens: final.usage.output_tokens,
      cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
      stopReason: final.stop_reason,
    };
  },
};

/* ---------------- OpenAI ---------------- */

let openaiClient: OpenAI | null = null;
function openai() {
  if (!openaiClient) openaiClient = new OpenAI({ maxRetries: 1, timeout: 240_000 });
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
    // GPT-5.x / GPT-6 reasoning models accept reasoning_effort (low … max);
    // older chat models reject it.
    const reasoning = /^(gpt-5|gpt-6|o\d)/.test(model);
    const stream = await client.chat.completions.create(
      {
        model,
        stream: true,
        stream_options: { include_usage: true },
        messages,
        // Reasoning tokens count against the completion limit; leave room for them beyond the visible budget.
        max_completion_tokens: outputTokenLimit(model, input.maxOutput ?? 32000, input.effort, reasoning),
        ...(reasoning && input.effort ? { reasoning_effort: input.effort } : {}),
      },
      { signal: input.signal },
    );
    let stopReason: string | null = null;
    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const chunk of stream) {
      if (chunk.choices?.[0]?.finish_reason) stopReason = chunk.choices[0].finish_reason;
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
    return { text, model, provider: "openai", inputTokens, outputTokens, stopReason };
  },
  async generateWithTools(model, input) {
    const client = openai();
    const reasoning = /^(gpt-5|gpt-6|o\d)/.test(model);
    const request = {
      model,
      messages: openaiToolMessages(input.system, input.turns),
      tools: input.tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } })),
      max_completion_tokens: outputTokenLimit(model, input.maxOutput ?? 16000, input.effort, reasoning),
    };
    // Reasoning with function tools differs per model on Chat Completions: GPT-6 Astra takes a level, GPT-5.6 Terra
    // wants 'none', older models reject the field. A 400 about reasoning_effort moves to the next variant once.
    const variants: (Record<string, unknown>)[] = reasoning ? [...(input.effort ? [{ reasoning_effort: input.effort }] : []), { reasoning_effort: "none" }, {}] : [{}];
    let completion!: OpenAI.ChatCompletion;
    for (let i = 0; i < variants.length; i++) {
      try { completion = await client.chat.completions.create({ ...request, ...variants[i] } as OpenAI.ChatCompletionCreateParamsNonStreaming, { signal: input.signal }); break; }
      catch (e) {
        const err = e as { status?: number; message?: string };
        if (err?.status === 400 && /reasoning_effort/i.test(err.message ?? "") && i < variants.length - 1) continue;
        throw e;
      }
    }
    const choice = completion.choices[0];
    const message = choice?.message;
    const toolCalls = (message?.tool_calls ?? []).flatMap((call) => {
      if (call.type !== "function") return [];
      let parsed: unknown;
      try { parsed = JSON.parse(call.function.arguments || "{}"); } catch { parsed = { __invalid_json: call.function.arguments }; }
      return [{ id: call.id, name: call.function.name, input: parsed }];
    });
    return { text: message?.content ?? "", toolCalls, model: completion.model || model, provider: "openai", inputTokens: completion.usage?.prompt_tokens ?? 0, outputTokens: completion.usage?.completion_tokens ?? 0, stopReason: choice?.finish_reason ?? null };
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
