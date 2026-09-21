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
      provider: "anthropic",
      model: process.env.AI_TIER_ADVANCED || "claude-opus-5",
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
  },
  tierMultiplier: { fast: 1, standard: 1.5, advanced: 3, premium: 5 },
  creditBase: { tiny: 1, small: 2, section: 4, page: 8, feature: 15, fullstack: 30 },
  routing: "auto",
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
