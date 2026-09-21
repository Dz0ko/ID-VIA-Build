import { db } from "./db";
import type { ModelTier } from "./plans";

export interface ModelConfig {
  provider: "anthropic" | "openai" | "mock";
  model: string;
  label: string;
  enabled: boolean;
  maxOutput: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

export interface AppSettings {
  /** Which concrete model backs each tier. Admin can change without redeploy. */
  tiers: Record<ModelTier, ModelConfig>;
  tierMultiplier: Record<ModelTier, number>;
  creditBase: Record<"tiny" | "small" | "section" | "page" | "feature" | "fullstack", number>;
  routing: "auto" | "manual";
  /** Referral programme rewards (credits). */
  referral: {
    /** Credits the new user gets for signing up through a friend's link. */
    referredSignupCredits: number;
    /** Credits the referrer gets when a friend signs up. */
    referrerSignupCredits: number;
    /** Credits the referrer gets the first time a friend buys any paid plan. */
    referrerPaidCredits: number;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  tiers: {
    fast: {
      provider: "anthropic",
      model: process.env.AI_TIER_FAST || "claude-haiku-4-5",
      label: "Fast tier",
      enabled: true,
      maxOutput: 16000,
    },
    standard: {
      provider: "anthropic",
      model: process.env.AI_TIER_STANDARD || "claude-sonnet-5",
      label: "Standard coding tier",
      enabled: true,
      maxOutput: 32000,
      effort: "medium",
    },
    advanced: {
      // Sonnet 5 at high effort builds full pages at ~2.5x lower token cost than
      // Opus 5; Opus stays reserved for the premium tier (full-stack features).
      provider: "anthropic",
      model: process.env.AI_TIER_ADVANCED || "claude-sonnet-5",
      label: "Advanced coding tier",
      enabled: true,
      maxOutput: 32000,
      effort: "high",
    },
    premium: {
      provider: "anthropic",
      model: process.env.AI_TIER_PREMIUM || "claude-opus-5",
      label: "Premium reasoning tier",
      enabled: true,
      maxOutput: 64000,
      effort: "xhigh",
    },
    frontier: {
      // Anthropic's most capable model ($10/$50 per 1M tokens). Never auto-routed:
      // users on Max/Agency pick it explicitly. Switch provider to "openai" and
      // model to "gpt-6-astra" (same price) to run the frontier tier on OpenAI.
      provider: "anthropic",
      model: process.env.AI_TIER_FRONTIER || "claude-fable-5-1",
      label: "Frontier tier",
      enabled: true,
      maxOutput: 64000,
      effort: "xhigh",
    },
  },
  // Calibrated so every task class costs the platform <= ~$0.02 per credit
  // (Anthropic list prices, whole-document rewrites). See the "Credit economics" doc.
  tierMultiplier: { fast: 1, standard: 1.5, advanced: 3, premium: 6, frontier: 12 },
  creditBase: { tiny: 2, small: 3, section: 5, page: 10, feature: 20, fullstack: 40 },
  routing: "auto",
  // 50 credits ≈ $0.55 of model cost: cheap acquisition; the paid bonus is worth ~1 full page.
  referral: { referredSignupCredits: 50, referrerSignupCredits: 50, referrerPaidCredits: 300 },
};

/**
 * OpenAI model used per tier when a tier falls back to OpenAI (Anthropic key
 * missing or tier disabled). Priced comparably to the Anthropic model of the
 * same tier: Luna $0.20/$1.20, Terra $2/$12, Sol $4/$20, Astra $10/$50.
 * `OPENAI_MODEL` overrides every tier (legacy single-model setup).
 */
export const OPENAI_TIER_MODELS: Record<ModelTier, string> = {
  fast: "gpt-5.6-luna",
  standard: "gpt-5.6-terra",
  advanced: "gpt-5.6-terra",
  premium: "gpt-5.6-sol",
  frontier: "gpt-6-astra",
};

const KEY = "app";

export async function getSettings(): Promise<AppSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(row.value) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      tiers: { ...DEFAULT_SETTINGS.tiers, ...(parsed.tiers ?? {}) },
      tierMultiplier: { ...DEFAULT_SETTINGS.tierMultiplier, ...(parsed.tierMultiplier ?? {}) },
      creditBase: { ...DEFAULT_SETTINGS.creditBase, ...(parsed.creditBase ?? {}) },
      referral: { ...DEFAULT_SETTINGS.referral, ...(parsed.referral ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: AppSettings) {
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(s) },
    update: { value: JSON.stringify(s) },
  });
}
