import type { ModelTier, PlanId } from "../plans";
import { TIER_ORDER, tierAllowed } from "../plans";
import { getSettings, OPENAI_TIER_MODELS, type ModelConfig } from "../settings";
import { PROVIDERS, type AIProvider, type GenerateInput, type GenerateResult } from "./provider";

export type TaskClass = "tiny" | "small" | "section" | "page" | "feature" | "fullstack";

/**
 * Cheap deterministic task classifier. Used to pick a model tier and a credit cost
 * without spending tokens on classification.
 */
export function classifyTask(prompt: string, hasExistingHtml: boolean): TaskClass {
  const p = prompt.toLowerCase();
  const words = p.split(/\s+/).length;

  if (!hasExistingHtml) {
    if (/\b(saas|dashboard|app|full[- ]?stack|platform|marketplace|crm)\b/.test(p)) return "feature";
    return "page";
  }
  if (/\b(database|auth|login|api|payments?|stripe|whop|backend|full[- ]?stack)\b/.test(p)) return "fullstack";
  if (/\b(rebuild|redesign|rewrite everything|new page|entire|whole site|from scratch)\b/.test(p)) return "page";
  if (/\b(add|create|new|build)\b.*\b(section|pricing|faq|testimonial|hero|footer|gallery|form|table|nav)/.test(p))
    return "section";
  if (words <= 8 && /\b(color|colour|text|font|button|title|rename|change|make|bigger|smaller|padding|spacing)\b/.test(p))
    return "tiny";
  if (words <= 20) return "small";
  return "section";
}

export function tierForTask(task: TaskClass, plan: PlanId, requested?: ModelTier): ModelTier {
  let tier: ModelTier;
  switch (task) {
    case "tiny":
      tier = "fast";
      break;
    case "small":
    case "section":
      tier = "standard";
      break;
    case "page":
    case "feature":
      tier = "advanced";
      break;
    case "fullstack":
      tier = "premium";
      break;
  }
  if (requested) tier = requested;
  // Auto routing never escalates to the frontier tier: it is a deliberate user choice.
  if (!requested && tier === "frontier") tier = "premium";
  // clamp to plan
  while (!tierAllowed(plan, tier)) {
    const i = TIER_ORDER.indexOf(tier);
    if (i <= 0) break;
    tier = TIER_ORDER[i - 1];
  }
  return tier;
}

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
  return err?.status === 401 || err?.status === 402 || err?.status === 403 || err?.status === 429 || err?.status === 529 ||
    (err?.status === 400 && /credit balance|billing|quota/.test(msg));
}

/**
 * Run a generation with automatic provider fallback: if the resolved provider is
 * Anthropic and it fails for account/capacity reasons, retry once on the OpenAI
 * model mapped to the same tier. The caller gets one result either way.
 */
export async function generateWithFallback(resolved: ResolvedModel, input: GenerateInput): Promise<GenerateResult & { fellBack?: boolean }> {
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

/** Resolve a tier to a concrete model + provider, falling back to mock when no key is set. */
export async function resolveModel(tier: ModelTier): Promise<ResolvedModel> {
  const settings = await getSettings();
  let cfg = settings.tiers[tier];
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
