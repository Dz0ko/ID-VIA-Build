import type { ModelTier, PlanId } from "../plans";
import { TIER_ORDER, tierAllowed } from "../plans";
import { getSettings, type ModelConfig } from "../settings";
import { PROVIDERS, type AIProvider } from "./provider";

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

/** Resolve a tier to a concrete model + provider, falling back to mock when no key is set. */
export async function resolveModel(tier: ModelTier): Promise<ResolvedModel> {
  const settings = await getSettings();
  let cfg = settings.tiers[tier];
  let provider = PROVIDERS[cfg.provider];
  if (!cfg.enabled || !provider.available()) {
    // try other configured providers with the same tier intent
    const alt: AIProvider[] = [PROVIDERS.anthropic, PROVIDERS.openai].filter((p) => p.available());
    if (alt.length) {
      provider = alt[0];
      cfg = {
        ...cfg,
        provider: provider.id,
        model: provider.id === "openai" ? process.env.OPENAI_MODEL || "gpt-4.1" : cfg.model,
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
