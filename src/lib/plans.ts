export type PlanId = "FREE" | "STARTER" | "PRO" | "MAX" | "AGENCY";

/**
 * fast → Claude Haiku 4.5 · standard → Claude Sonnet 5 · advanced → Claude Sonnet 5 (high effort)
 * premium → Claude Opus 5 · frontier → Claude Fable 5.1 / GPT-6 Astra for the most demanding work.
 */
export type ModelTier = "fast" | "standard" | "advanced" | "premium" | "frontier";
export const MODEL_TIERS = ["fast", "standard", "advanced", "premium", "frontier"] as const;

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // USD / month
  /** Original price shown struck through when a launch discount applies. */
  listPrice?: number;
  /** Discount percentage displayed as a badge (derived from listPrice). */
  discountPct?: number;
  tagline: string;
  credits: number; // monthly
  agentLimit: number | "all";
  projectLimit: number | "unlimited";
  maxTier: ModelTier;
  rolloverPct: number;
  /** Short selling points for compact cards (landing). Full list lives in `features`. */
  highlights: string[];
  features: string[];
}

/** Human-readable model behind each tier, for plan cards. */
export const TIER_LABELS: Record<ModelTier, string> = {
  fast: "Claude Haiku 4.5",
  standard: "Claude Sonnet 5",
  advanced: "Claude Sonnet 5 · high effort",
  premium: "Claude Opus 5",
  frontier: "Claude Fable 5.1 · GPT-6 Astra",
};

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: "FREE",
    name: "Free",
    price: 0,
    tagline: "Try IDÆVIA Build.",
    credits: 100,
    agentLimit: 6,
    projectLimit: 2,
    maxTier: "standard",
    rolloverPct: 0,
    highlights: ["6 core agents", "2 projects", "20 templates and the prompt library", "Preview link with IDÆVIA badge"],
    features: [
      "100 AI credits per month",
      "6 core agents: Builder, Planner, Copywriter, Designer, Debugger, SEO",
      "2 projects",
      "20 templates and the prompt library",
      "Live preview, code editor, versions and rollback",
      "Standard coding tier with automatic routing",
      "Preview link on idaevia.app (with IDÆVIA badge)",
      "Community support",
    ],
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    price: 19,
    tagline: "For individuals and small projects.",
    credits: 750,
    agentLimit: 12,
    projectLimit: 15,
    maxTier: "standard",
    rolloverPct: 0,
    highlights: ["Screenshot and reference image to website", "Import from URL, GitHub or ZIP", "Production audit and code export", "IDÆVIA Academy: 18 lessons and tutorials"],
    features: [
      "750 AI credits per month",
      "12 agents: adds UI, UX, Performance, Accessibility, Asset, Localization",
      "15 projects",
      "Screenshot and reference image to website (vision)",
      "Import from a live URL, GitHub or ZIP",
      "Effects, animations and components library",
      "Production audit (performance, SEO, accessibility, security, mobile)",
      "Code export as ZIP, preview link without badge",
      "IDÆVIA Academy: 18 step-by-step lessons, tutorials and glossary",
      "Email support",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 49,
    tagline: "For serious builders and startups.",
    credits: 2500,
    agentLimit: 20,
    projectLimit: "unlimited",
    maxTier: "advanced",
    rolloverPct: 25,
    highlights: ["React apps with a live sandbox", "Client feedback links and approvals", "Publish to the marketplace", "25% credit rollover"],
    features: [
      "2,500 AI credits per month",
      "20 agents: adds Database, API, Auth, Payments, Animation, 3D, Git, Deploy",
      "Unlimited projects",
      "Advanced coding tier with higher effort modes",
      "React app projects with a live sandbox and Vite export",
      "Client feedback links with comments and approvals",
      "Publish templates, prompts and components to the marketplace",
      "25% credit rollover",
      "Priority support",
    ],
  },
  MAX: {
    id: "MAX",
    name: "Max",
    price: 99,
    tagline: "For professionals and high-volume builders.",
    credits: 6000,
    agentLimit: 30,
    projectLimit: "unlimited",
    maxTier: "frontier",
    rolloverPct: 25,
    highlights: ["Claude Opus 5 for architecture and complex features", "Frontier tier: Claude Fable 5.1 and GPT-6 Astra", "Agent teams and one-click workflows", "Project memory and background agents"],
    features: [
      "6,000 AI credits per month",
      "All 30 standard agents: adds Reference, Rebuild, Analytics, Conversion, Documentation, Refactoring, Dependency, Project Manager, Security, QA",
      "Premium reasoning tier (Claude Opus 5) for architecture and complex features",
      "Frontier reasoning: Claude Fable 5.1 and GPT-6 Astra for the hardest builds",
      "Agent teams and one-click workflows (Make it Premium, Production Ready)",
      "Project memory and background agents",
      "Larger context and priority generation",
      "25% credit rollover",
      "Premium support with priority manager queue",
    ],
  },
  AGENCY: {
    id: "AGENCY",
    name: "Agency",
    price: 489,
    listPrice: 652,
    discountPct: 25,
    tagline: "For agencies and teams.",
    credits: 15000,
    agentLimit: "all",
    projectLimit: "unlimited",
    maxTier: "frontier",
    rolloverPct: 25,
    highlights: ["Teams, roles and the client portal", "White-label branding", "Custom and private agents", "Priority queue and premium support"],
    features: [
      "15,000 AI credits per month, plus optional credit packs",
      "Every agent, plus custom and private agents",
      "Premium and Frontier tiers: Claude Opus 5, Claude Fable 5.1 and GPT-6 Astra",
      "Teams with roles and invitations",
      "Client portal: preview, comments, change requests and approvals",
      "White-label branding (your name, logo and colours)",
      "Private templates, prompts and agents",
      "Priority queue and bulk generation",
      "25% credit rollover",
      "Premium support with priority manager queue",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "STARTER", "PRO", "MAX", "AGENCY"];

export const TIER_ORDER: ModelTier[] = [...MODEL_TIERS];

export function planRank(plan: PlanId) {
  return PLAN_ORDER.indexOf(plan);
}

export function tierAllowed(plan: PlanId, tier: ModelTier) {
  return TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(PLANS[plan].maxTier);
}

export function isPlanId(v: string): v is PlanId {
  return (PLAN_ORDER as string[]).includes(v);
}

/** Rough credit cost of common tasks, used to explain what credits buy. */
/** Typical credit costs shown in marketing copy. Edits scale with page size (a rewrite re-emits the whole document). */
export const CREDIT_GUIDE = { smallEdit: 12, page: 30, fullstack: 240 };

/**
 * Credit top-ups. Each step is roughly 3× the previous one and the price per
 * credit drops 10% per step (2.4¢ → 2.2¢ → 2.0¢ → 1.8¢). Never below $0.015 per
 * credit so a pack never sells under the blended model cost (see the "Credit
 * economics" doc): the plans carry the discount, refills do not.
 */
export const CREDIT_PACKS = [
  { credits: 500, price: 12 },
  { credits: 1500, price: 33 },
  { credits: 4000, price: 80 },
  { credits: 10000, price: 180 },
];

export function packSavingsPct(pack: { credits: number; price: number }) {
  const base = CREDIT_PACKS[0].price / CREDIT_PACKS[0].credits;
  return Math.round((1 - pack.price / pack.credits / base) * 100);
}
