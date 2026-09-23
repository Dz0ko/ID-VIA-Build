import type { ModelTier } from "../plans";
import { getSettings, OPENAI_TIER_MODELS, type ModelConfig } from "../settings";
import { PROVIDERS, type AIProvider, type GenerateInput, type GenerateResult } from "./provider";
export { classifyTask, requiresFrontierDesign, tierForTask, type TaskClass } from "./task-routing";

export interface ResolvedModel {
  tier: ModelTier;
  config: ModelConfig;
  provider: AIProvider;
  fallback: boolean; // true when we fell back to mock
}

/**
 * When Anthropic rejects requests for account reasons (no credit, bad key,
 * overloaded), skip it for a while so users get OpenAI immediately instead of
 * a failed run. Per-instance memory; a fresh instance simply retries once.
 */
let anthropicPausedUntil = 0;
const PAUSE_MS = 10 * 60 * 1000;

function isAccountOrCapacityError(e: unknown) {
  const err = e as { status?: number; message?: string };
  const msg = (err?.message ?? "").toLowerCase();
  return err?.status === 401 || err?.status === 402 || err?.status === 403 || err?.status === 429 || err?.status === 503 || err?.status === 529 ||
    (err?.status === 400 && /credit balance|billing|quota/.test(msg));
}

/**
 * Run a generation with automatic provider fallback: if the resolved provider is
 * Anthropic and it fails for account/capacity reasons, retry once on the OpenAI
 * model mapped to the same tier. The caller gets one result either way.
 */
export async function generateWithFallback(resolved: ResolvedModel, input: GenerateInput): Promise<GenerateResult & { fellBack?: boolean }> {
  // The template engine is a local-dev stand-in only; paying users never receive placeholder output.
  if (resolved.provider.id === "mock" && process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("No AI provider is available."), { status: 503 });
  }
  try {
    return await resolved.provider.generate(resolved.config.model, input);
  } catch (e) {
    const canFallback = resolved.provider.id === "anthropic" && PROVIDERS.openai.available() && isAccountOrCapacityError(e);
    if (!canFallback) throw e;
    anthropicPausedUntil = Date.now() + PAUSE_MS;
    console.warn(`[ai] Anthropic unavailable (${(e as Error).message?.slice(0, 120)}), falling back to OpenAI for ${resolved.tier}`);
    const model = process.env.OPENAI_MODEL || OPENAI_TIER_MODELS[resolved.tier];
    const result = await PROVIDERS.openai.generate(model, input);
    return { ...result, fellBack: true };
  }
}

/** Turn provider SDK errors into a message safe to show users. */
export function friendlyAiError(e: unknown): string {
  const err = e as { status?: number; message?: string };
  const msg = err?.message ?? "";
  if (isAccountOrCapacityError(e) || /no credits remaining|insufficient_quota|billing/i.test(msg)) {
    return "The AI providers are temporarily unavailable. Your credits were refunded; please try again in a few minutes.";
  }
  if (err?.status === 400) return "The request could not be processed by the model. Try a shorter or clearer prompt.";
  if (err?.status === 401 || err?.status === 403) return "The AI service is temporarily unavailable. Please contact support if this continues.";
  if (/did not return/.test(msg)) return "The model output could not be applied. See your credit history for the adjustment.";
  if (e instanceof Error && e.name === "AbortError") return "Generation was interrupted. See your credit history for the adjustment.";
  return "Generation failed. See your credit history for the adjustment.";
}

/** Resolve a tier to a concrete model + provider, falling back to mock when no key is set. */
export async function resolveModel(tier: ModelTier, preferProvider?: "anthropic" | "openai"): Promise<ResolvedModel> {
  const settings = await getSettings();
  let cfg = settings.tiers[tier];
  // Explicit choice (e.g. GPT-6 Astra instead of Claude Fable 5.1 on the frontier tier).
  if (preferProvider === "openai" && PROVIDERS.openai.available()) {
    cfg = { ...cfg, provider: "openai", model: process.env.OPENAI_MODEL || OPENAI_TIER_MODELS[tier] };
  } else if (preferProvider === "anthropic" && PROVIDERS.anthropic.available() && cfg.provider !== "anthropic") {
    cfg = { ...cfg, provider: "anthropic" };
  }
  let provider = PROVIDERS[cfg.provider];
  const paused = provider.id === "anthropic" && Date.now() < anthropicPausedUntil && PROVIDERS.openai.available();
  if (!cfg.enabled || !provider.available() || paused) {
    // try other configured providers with the same tier intent
    const alt: AIProvider[] = [PROVIDERS.anthropic, PROVIDERS.openai].filter((p) => p.available());
    if (alt.length) {
      provider = alt[0];
      cfg = {
        ...cfg,
        provider: provider.id,
        model: provider.id === "openai" ? process.env.OPENAI_MODEL || OPENAI_TIER_MODELS[tier] : cfg.model,
      };
      return { tier, config: cfg, provider, fallback: false };
    }
    return {
      tier,
      config: { ...cfg, provider: "mock", model: "idaevia-mock" },
      provider: PROVIDERS.mock,
      fallback: true,
    };
  }
  return { tier, config: cfg, provider, fallback: false };
}

export function providerStatus() {
  return {
    anthropic: PROVIDERS.anthropic.available(),
    openai: PROVIDERS.openai.available(),
    mock: true,
  };
}
