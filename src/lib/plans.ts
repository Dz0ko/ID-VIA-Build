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
    features: [
      "750 AI credits per month",
      "12 agents: adds UI, UX, Performance, Accessibility, Asset, Localization",
      "15 projects",
      "Screenshot and reference image to website (vision)",
      "Import from a live URL, GitHub or ZIP",
      "Effects, animations and components library",
      "Production audit (performance, SEO, accessibility, security, mobile)",
      "Code export as ZIP, preview link without badge",
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
    credits: 7500,
    agentLimit: 30,
    projectLimit: "unlimited",
    maxTier: "premium",
    rolloverPct: 25,
    features: [
      "7,500 AI credits per month",
      "All 30 standard agents: adds Reference, Rebuild, Analytics, Conversion, Documentation, Refactoring, Dependency, Project Manager, Security, QA",
      "Premium reasoning tier for architecture and complex features",
      "Agent teams and one-click workflows (Make it Premium, Production Ready)",
      "Project memory and background agents",
      "Larger context and priority generation",
      "25% credit rollover",
      "Priority support",
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
      "15,000 AI credits per month, plus optional credit packs",
      "Every agent, plus custom and private agents",
      "Teams with roles and invitations",
      "Client portal: preview, comments, change requests and approvals",
      "White-label branding (your name, logo and colours)",
      "Private templates, prompts and agents",
      "Priority queue and bulk generation",
      "25% credit rollover",
      "Dedicated support",
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
