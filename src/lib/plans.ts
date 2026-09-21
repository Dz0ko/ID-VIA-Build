export type PlanId = "FREE" | "STARTER" | "PRO" | "MAX" | "AGENCY";

export type ModelTier = "fast" | "standard" | "advanced" | "premium";

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // USD / month
  tagline: string;
  credits: number; // monthly
  agentLimit: number | "all";
  projectLimit: number | "unlimited";
  maxTier: ModelTier;
  rolloverPct: number;
  features: string[];
}

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
    features: [
      "100 AI credits / month",
      "6 core agents",
      "2 projects",
      "Basic templates & prompts",
      "Live preview + visual editor",
      "idaevia.app subdomain",
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
    features: [
      "750 AI credits / month",
      "12 agents",
      "15 projects",
      "Premium templates & prompt library",
      "Screenshot → website, reference images",
      "Animations, hover effects, basic 3D",
      "Custom domain, GitHub, export",
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
    features: [
      "2,500 AI credits / month",
      "20 agents",
      "Unlimited projects",
      "Advanced coding tier + higher effort",
      "Full terminal & code editor",
      "Database, API, auth & payments agents",
      "Deployment, staging, advanced SEO",
    ],
  },
  MAX: {
    id: "MAX",
    name: "Max",
    price: 99,
    tagline: "For professionals and high-volume builders.",
    credits: 7500,
    agentLimit: 30,
    projectLimit: "unlimited",
    maxTier: "premium",
    rolloverPct: 25,
    features: [
      "7,500 AI credits / month",
      "30 agents + agent teams",
      "Premium reasoning tier",
      "Project memory & background agents",
      "Reference recreation, full-stack apps",
      "Advanced analytics & automated optimization",
      "Priority generation, larger context",
    ],
  },
  AGENCY: {
    id: "AGENCY",
    name: "Agency",
    price: 199,
    tagline: "For agencies and teams.",
    credits: 15000,
    agentLimit: "all",
    projectLimit: "unlimited",
    maxTier: "premium",
    rolloverPct: 25,
    features: [
      "15,000 AI credits / month",
      "All agents, custom & private agents",
      "Team members, roles, client portal",
      "White label & custom branding",
      "Private templates, prompts, components",
      "API access, priority queue, bulk generation",
      "Multiple workspaces",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "STARTER", "PRO", "MAX", "AGENCY"];

export const TIER_ORDER: ModelTier[] = ["fast", "standard", "advanced", "premium"];

export function planRank(plan: PlanId) {
  return PLAN_ORDER.indexOf(plan);
}

export function tierAllowed(plan: PlanId, tier: ModelTier) {
  return TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(PLANS[plan].maxTier);
}

export function isPlanId(v: string): v is PlanId {
  return (PLAN_ORDER as string[]).includes(v);
}

export const CREDIT_PACKS = [
  { credits: 500, price: 10 },
  { credits: 2000, price: 30 },
  { credits: 5000, price: 60 },
  { credits: 10000, price: 100 },
];
