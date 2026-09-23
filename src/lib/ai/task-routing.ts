import type { ModelTier, PlanId } from "../plans";
import { TIER_ORDER, tierAllowed } from "../plans";

export type TaskClass = "tiny" | "small" | "section" | "page" | "feature" | "fullstack";

/** Cheap deterministic classification; it never spends model tokens. */
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
    case "fullstack":
      // Substantial work uses the strongest reasoning tier available to the plan.
      tier = "frontier";
      break;
  }
  if (requested) tier = requested;
  while (!tierAllowed(plan, tier)) {
    const i = TIER_ORDER.indexOf(tier);
    if (i <= 0) break;
    tier = TIER_ORDER[i - 1];
  }
  return tier;
}
