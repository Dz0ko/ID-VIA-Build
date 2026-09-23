import type { ModelTier, PlanId } from "../plans";
import { TIER_ORDER, tierAllowed } from "../plans";
import { isProductBrief } from "./request-intent";

export type TaskClass = "tiny" | "small" | "section" | "page" | "feature" | "fullstack";

export type ModelProvider = "anthropic" | "openai";

/** Visual work always gets the deepest available reasoning path. */
export function requiresFrontierDesign(prompt: string, agentId?: string): boolean {
  const p = prompt.toLowerCase();
  if (["designer", "animation", "3d", "asset"].includes(agentId ?? "")) return true;
  return /\b(navbar|navigation|header|footer|hero|landing page|buttons?|cta|animat(?:e|ion|ions)?|hover|parallax|scroll effect|transition|micro-?interaction|motion|visual|ui|ux|design|colou?r|palette|font|typograph|spacing|layout|responsive|style|premium|modern|redesign|3d|webgl|gradient|shadow|border|radius)\b/.test(p);
}

/** Pick the provider whose strengths fit the work; explicit user choices still win. */
export function preferredProviderForTask(prompt: string, agentId: string | undefined, isApp: boolean): ModelProvider | undefined {
  if (requiresFrontierDesign(prompt, agentId)) return "anthropic";
  if (isApp || /\b(database|auth|api|backend|full[- ]?stack|tests?|debug|bug|error|refactor|git|deploy|build)\b/i.test(prompt)) return "openai";
  return undefined;
}

/** Cheap deterministic classification; it never spends model tokens. */
export function classifyTask(prompt: string, hasExistingHtml: boolean): TaskClass {
  const p = prompt.toLowerCase();
  const words = p.split(/\s+/).length;
  if (isProductBrief(prompt)) return /\b(marketplace|saas|platform|app)\b/.test(p) ? "feature" : "page";

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
