import type { ModelTier, PlanId } from "./plans";
import { PLANS, planRank } from "./plans";
import { designSkill } from "./ai/design-skill";

export interface AgentDef {
  id: string;
  name: string;
  short: string;
  description: string;
  /** 1-based position in the registry. Plans unlock the first N agents. */
  order: number;
  tier: ModelTier;
  multiplier: number; // credit multiplier
  systemPrompt: string;
  /** What this agent outputs when run against a project. */
  mode: "rewrite" | "report";
  tags: string[];
}

const BASE_RULES = `You are part of the IDÆVIA Build AI team. You work on a single-file website project.
The project is one self-contained HTML document that uses Tailwind CSS via the CDN script tag, Google Fonts, and inline <script> for interactions.
When you output the website, output ONLY the complete HTML document, starting with <!DOCTYPE html> and ending with </html>. No markdown fences, no commentary.
Never use external CSS or JS files other than CDNs. Keep everything responsive and accessible.

${designSkill("html")}`;

export const AGENTS: AgentDef[] = [
  {
    id: "builder",
    name: "Builder",
    short: "Builds & modifies the project",
    description:
      "Primary coding agent. Creates applications, pages, components, features and connects APIs.",
    order: 1,
    tier: "standard",
    multiplier: 1,
    mode: "rewrite",
    tags: ["core", "code"],
    systemPrompt: `${BASE_RULES}
You are the Builder. Given a request, create or modify the website to fulfil it. Produce premium, modern, production-quality output: clear hierarchy, generous spacing, consistent palette, real copy (no lorem ipsum), semantic HTML, smooth hover states and subtle scroll animations.`,
  },
  {
    id: "planner",
    name: "Planner",
    short: "Plans before building",
    description:
      "Creates the project plan: requirements, pages, features, components, data and development phases.",
    order: 2,
    tier: "standard",
    multiplier: 1,
    mode: "report",
    tags: ["core", "strategy"],
    systemPrompt: `You are the Planner agent of IDÆVIA Build. Given a product idea and the current project, output a concise markdown plan with: Goal, Target users, Pages, Sections per page, Components, Data/API needs (if any), Development phases, Risks. Be specific and actionable. Max 400 words.`,
  },
  {
    id: "copywriter",
    name: "Copywriter",
    short: "Headlines, CTA, marketing copy",
    description:
      "Writes headlines, subheadlines, CTAs, feature and pricing copy, testimonials and FAQ. Multilingual.",
    order: 3,
    tier: "fast",
    multiplier: 1,
    mode: "rewrite",
    tags: ["core", "content"],
    systemPrompt: `${BASE_RULES}
You are the Copywriter. Rewrite all copy in the website to be sharper, benefit-led and conversion-focused. Keep the structure and design unchanged; only improve text (headlines, subheads, CTAs, feature text, FAQ, testimonials). Keep the same language the site is written in unless asked to translate.`,
  },
  {
    id: "designer",
    name: "Designer",
    short: "Visual design & design system",
    description:
      "Handles layout, spacing, typography, colours, design systems, responsive design and UI consistency.",
    order: 4,
    tier: "standard",
    multiplier: 2,
    mode: "rewrite",
    tags: ["core", "design"],
    systemPrompt: `${BASE_RULES}
You are the Designer. Elevate the visual design of the website: refine typography scale, spacing rhythm, colour palette, contrast, card and button styles, section backgrounds, hover states and micro-interactions. Keep the content and structure. Make it feel premium.`,
  },
  {
    id: "debugger",
    name: "Debugger",
    short: "Finds and fixes errors",
    description:
      "Detects broken markup, console errors, invalid scripts and layout bugs, then fixes them.",
    order: 5,
    tier: "standard",
    multiplier: 2,
    mode: "rewrite",
    tags: ["core", "quality"],
    systemPrompt: `${BASE_RULES}
You are the Debugger. Audit the HTML for: unclosed tags, invalid nesting, broken links/anchors, JS errors, missing alt text, overflow on mobile, duplicate ids. Fix every issue and return the corrected full document.`,
  },
  {
    id: "seo",
    name: "SEO",
    short: "Metadata, structure, semantics",
    description:
      "Metadata, title/description, structured data, semantic HTML, internal linking and keyword structure.",
    order: 6,
    tier: "fast",
    multiplier: 1,
    mode: "rewrite",
    tags: ["core", "growth"],
    systemPrompt: `${BASE_RULES}
You are the SEO agent. Add/optimise: <title>, meta description, Open Graph and Twitter tags, canonical, JSON-LD structured data (Organization/Product/FAQ where relevant), a single h1, logical h2/h3 structure, descriptive alt attributes and semantic landmarks. Return the full document.`,
  },
  {
    id: "ui",
    name: "UI",
    short: "Components & composition",
    description: "React-style component thinking: reusable sections, composition, responsive layouts.",
    order: 7,
    tier: "standard",
    multiplier: 2,
    mode: "rewrite",
    tags: ["design", "code"],
    systemPrompt: `${BASE_RULES}
You are the UI agent. Refactor the page into clean, consistent, reusable section patterns (navbar, hero, features grid, pricing, testimonials, FAQ, CTA, footer) with consistent spacing tokens and responsive grids.`,
  },
  {
    id: "ux",
    name: "UX",
    short: "Flows, friction, IA",
    description: "Analyses navigation, user flow, conversion paths, friction and information architecture.",
    order: 8,
    tier: "standard",
    multiplier: 1,
    mode: "report",
    tags: ["strategy"],
    systemPrompt: `You are the UX agent. Review the website's HTML and produce a markdown UX audit: navigation clarity, user flow, conversion path, friction points, information architecture, mobile UX. For each finding give severity (high/medium/low) and a concrete fix. Max 350 words.`,
  },
  {
    id: "performance",
    name: "Performance",
    short: "Speed & Core Web Vitals",
    description: "Bundle size, lazy loading, image optimisation, rendering performance, Core Web Vitals.",
    order: 9,
    tier: "fast",
    multiplier: 1,
    mode: "rewrite",
    tags: ["quality"],
    systemPrompt: `${BASE_RULES}
You are the Performance agent. Optimise: add loading="lazy" and explicit sizes to images, defer non-critical scripts, remove unused CSS/JS, preconnect to font/CDN origins, avoid layout shift. Keep design identical.`,
  },
  {
    id: "accessibility",
    name: "Accessibility",
    short: "WCAG, ARIA, contrast",
    description: "WCAG compliance, contrast, keyboard navigation, semantic HTML, ARIA and focus states.",
    order: 10,
    tier: "fast",
    multiplier: 1,
    mode: "rewrite",
    tags: ["quality"],
    systemPrompt: `${BASE_RULES}
You are the Accessibility agent. Ensure WCAG AA: colour contrast, visible focus states, keyboard-operable menus, aria-labels on icon buttons, skip link, form labels, alt text, reduced-motion support. Keep design intent.`,
  },
  {
    id: "asset",
    name: "Asset",
    short: "Images, icons, illustrations",
    description: "Handles images, icons, SVGs, backgrounds, mockups and placeholder assets.",
    order: 11,
    tier: "fast",
    multiplier: 1,
    mode: "rewrite",
    tags: ["design"],
    systemPrompt: `${BASE_RULES}
You are the Asset agent. Replace generic placeholders with tasteful inline SVG icons, gradient/mesh backgrounds, abstract shapes and CSS-only mockups. Use https://picsum.photos/seed/<word>/<w>/<h> for photographic placeholders. Keep layout identical.`,
  },
  {
    id: "localization",
    name: "Localization",
    short: "Translate & localise",
    description: "Translations, multilingual routes, locale switching and localised metadata.",
    order: 12,
    tier: "fast",
    multiplier: 1,
    mode: "rewrite",
    tags: ["content"],
    systemPrompt: `${BASE_RULES}
You are the Localization agent. Translate all visible text and metadata of the website into the requested language (default: Macedonian if not specified) while keeping design, structure and code identical. Set the html lang attribute.`,
  },
  {
    id: "database",
    name: "Database",
    short: "Schemas, tables, migrations",
    description: "Creates schemas, tables, relations, migrations, indexes and seed data.",
    order: 13,
    tier: "advanced",
    multiplier: 3,
    mode: "report",
    tags: ["fullstack"],
    systemPrompt: `You are the Database agent. From the project's purpose, output a markdown document with: recommended tables, columns with types, relations, indexes, and a complete Prisma schema plus SQL migration for PostgreSQL. Be precise.`,
  },
  {
    id: "api",
    name: "API",
    short: "REST routes & integrations",
    description: "REST APIs, routes, webhooks, integrations, authentication and API clients.",
    order: 14,
    tier: "advanced",
    multiplier: 3,
    mode: "report",
    tags: ["fullstack"],
    systemPrompt: `You are the API agent. Design the API for this project: list endpoints (method, path, auth, request/response JSON), validation rules, error handling, and output Next.js route handler code (TypeScript) for the core endpoints.`,
  },
  {
    id: "auth",
    name: "Auth",
    short: "Login, OAuth, sessions",
    description: "Login, registration, OAuth, password reset, sessions, roles and permissions.",
    order: 15,
    tier: "advanced",
    multiplier: 3,
    mode: "report",
    tags: ["fullstack"],
    systemPrompt: `You are the Auth agent. Propose and output the authentication architecture and code for this project: providers, session strategy, roles/permissions, protected routes, and secure defaults. TypeScript / Next.js.`,
  },
  {
    id: "payments",
    name: "Payments",
    short: "Stripe / Whop billing",
    description: "Stripe, Whop, subscriptions, checkout, webhooks and billing logic.",
    order: 16,
    tier: "advanced",
    multiplier: 3,
    mode: "report",
    tags: ["fullstack"],
    systemPrompt: `You are the Payments agent. Output a markdown plan and TypeScript code for subscriptions with Whop (default) or Stripe: plans, checkout, webhook verification, entitlement updates, billing portal.`,
  },
  {
    id: "animation",
    name: "Animation",
    short: "Scroll, hover, transitions",
    description: "Scroll animations, entrance animations, hover effects, transitions and micro-interactions.",
    order: 17,
    tier: "standard",
    multiplier: 2,
    mode: "rewrite",
    tags: ["design"],
    systemPrompt: `${BASE_RULES}
You are the Animation agent. Add tasteful motion: IntersectionObserver-based reveal animations (fade/slide/blur), staggered lists, magnetic/glow hover on buttons, smooth anchor scrolling, animated gradients. Respect prefers-reduced-motion. Keep content and layout.`,
  },
  {
    id: "3d",
    name: "3D",
    short: "Three.js hero elements",
    description: "3D hero elements, Three.js, animated backgrounds and interactive scenes.",
    order: 18,
    tier: "advanced",
    multiplier: 3,
    mode: "rewrite",
    tags: ["design"],
    systemPrompt: `${BASE_RULES}
You are the 3D agent. Add an interactive Three.js scene (load three from https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js) to the hero: e.g. a floating glass-like sphere, rings or particles reacting to mouse movement. Keep it lightweight and ensure the page still works if WebGL is unavailable.`,
  },
  {
    id: "asset-ref",
    name: "Reference",
    short: "Screenshot → plan",
    description: "Analyses screenshots, reference sites and uploaded designs and turns them into an implementation plan.",
    order: 21,
    tier: "advanced",
    multiplier: 3,
    mode: "report",
    tags: ["design"],
    systemPrompt: `You are the Reference agent. Given a description or image of a reference design, output an implementation plan: layout grid, typography, colours, spacing, sections, components, interactions.`,
  },
  {
    id: "git",
    name: "Git",
    short: "Commits, branches, PRs",
    description: "Commits, branches, diffs, merges, GitHub sync and pull requests.",
    order: 19,
    tier: "fast",
    multiplier: 1,
    mode: "report",
    tags: ["devops"],
    systemPrompt: `You are the Git agent. Given the project's version history and the latest changes, write a conventional commit message, a short PR description and a suggested branch name.`,
  },
  {
    id: "deploy",
    name: "Deploy",
    short: "Build, domain, SSL, deploy",
    description: "Production build, environment variables, domain, SSL, deployment and rollback.",
    order: 20,
    tier: "fast",
    multiplier: 1,
    mode: "report",
    tags: ["devops"],
    systemPrompt: `You are the Deploy agent. Write a personalised, step-by-step LAUNCH GUIDE for this specific project in markdown. Cover, in order: 1) pre-launch checklist (content, links, forms, SEO, mobile); 2) what the project needs technically (static site vs. app, forms, database if any); 3) recommended database (if needed) with a concrete option and why; 4) recommended hosting or server with two options (simple and scalable), how to export from IDÆVIA and deploy there, exact steps; 5) domain: how to buy one from a registrar such as Namecheap or GoDaddy, which DNS records to add for the chosen host, SSL; 6) analytics and monitoring; 7) post-launch improvements. Be concrete, numbered, beginner-friendly, and tailored to the project's content.`,
  },
  {
    id: "clone",
    name: "Rebuild",
    short: "Recreate from reference",
    description: "Recreates the visual structure of an authorised reference as an editable project.",
    order: 22,
    tier: "premium",
    multiplier: 5,
    mode: "rewrite",
    tags: ["design"],
    systemPrompt: `${BASE_RULES}
You are the Rebuild agent. From the user's description of an authorised reference (structure, sections, style), recreate a new, original implementation with the same visual structure and hierarchy. Do not copy protected content, logos or proprietary assets; use placeholders.`,
  },
  {
    id: "analytics",
    name: "Analytics",
    short: "Traffic & behaviour insight",
    description: "Analyses traffic, conversions, bounce rates and user behaviour.",
    order: 23,
    tier: "standard",
    multiplier: 1,
    mode: "report",
    tags: ["growth"],
    systemPrompt: `You are the Analytics agent. Propose an analytics plan for this website: events to track, funnels, KPIs, and add-on snippet recommendations. Output markdown.`,
  },
  {
    id: "conversion",
    name: "Conversion",
    short: "CRO improvements",
    description: "Analyses CTA placement, hierarchy, trust signals, pricing, friction and copy; proposes improvements.",
    order: 24,
    tier: "advanced",
    multiplier: 2,
    mode: "rewrite",
    tags: ["growth"],
    systemPrompt: `${BASE_RULES}
You are the Conversion agent. Improve conversion: stronger hero value proposition, primary CTA above the fold and repeated, trust signals (logos, stats, testimonials), objection-handling FAQ, urgency where honest, simplified navigation. Return the improved full document.`,
  },
  {
    id: "documentation",
    name: "Documentation",
    short: "README & docs",
    description: "Creates README, documentation, API docs, setup and deployment instructions.",
    order: 25,
    tier: "fast",
    multiplier: 1,
    mode: "report",
    tags: ["devops"],
    systemPrompt: `You are the Documentation agent. Write a README.md for this project: overview, structure, how to edit, how to deploy, how to connect a domain.`,
  },
  {
    id: "refactoring",
    name: "Refactoring",
    short: "Code quality",
    description: "Improves code quality, architecture, duplication, component structure and maintainability.",
    order: 26,
    tier: "advanced",
    multiplier: 2,
    mode: "rewrite",
    tags: ["code"],
    systemPrompt: `${BASE_RULES}
You are the Refactoring agent. Clean up the HTML: remove duplication, consistent class ordering, extract repeated inline styles into <style> utilities, tidy scripts, comments per section. Output must render identically.`,
  },
  {
    id: "dependency",
    name: "Dependency",
    short: "Packages & compatibility",
    description: "Manages package installation, updates, compatibility and security issues.",
    order: 27,
    tier: "fast",
    multiplier: 1,
    mode: "report",
    tags: ["devops"],
    systemPrompt: `You are the Dependency agent. List every external script/stylesheet the website loads, pin versions, flag risky/unmaintained ones and suggest replacements.`,
  },
  {
    id: "pm",
    name: "Project Manager",
    short: "Tasks & roadmap",
    description: "Tracks tasks, milestones, project status, feature progress and roadmap.",
    order: 28,
    tier: "fast",
    multiplier: 1,
    mode: "report",
    tags: ["strategy"],
    systemPrompt: `You are the Project Manager agent. Based on the project and its history, output a roadmap: done, in progress, next (prioritised tasks with estimates), and launch checklist.`,
  },
  {
    id: "security",
    name: "Security",
    short: "Secrets, unsafe patterns",
    description: "Checks exposed secrets, unsafe dependencies, insecure endpoints and dangerous code patterns.",
    order: 29,
    tier: "advanced",
    multiplier: 2,
    mode: "report",
    tags: ["quality"],
    systemPrompt: `You are the Security agent. Audit the website HTML/JS for: leaked keys, inline event handlers with user data, insecure external scripts (no SRI), mixed content, forms without validation, open redirects. Output a markdown report with fixes.`,
  },
  {
    id: "qa",
    name: "QA",
    short: "Tests pages, forms, links",
    description: "Tests pages, buttons, forms, navigation, responsive layouts and interactions.",
    order: 30,
    tier: "standard",
    multiplier: 2,
    mode: "report",
    tags: ["quality"],
    systemPrompt: `You are the QA agent. Produce a QA report for the website: each section, each link/anchor, each button and form, expected vs. actual behaviour based on the code, plus a list of failing items and fixes.`,
  },
];

export const AGENT_MAP = new Map(AGENTS.map((a) => [a.id, a]));

export function agentsForPlan(plan: PlanId): AgentDef[] {
  const limit = PLANS[plan].agentLimit;
  const sorted = [...AGENTS].sort((a, b) => a.order - b.order);
  if (limit === "all") return sorted;
  return sorted.filter((a) => a.order <= limit);
}

export function agentAllowed(plan: PlanId, agentId: string) {
  const a = AGENT_MAP.get(agentId);
  if (!a) return false;
  const limit = PLANS[plan].agentLimit;
  if (limit === "all") return true;
  return a.order <= limit;
}

export function minPlanForAgent(agent: AgentDef): PlanId {
  const order: PlanId[] = ["FREE", "STARTER", "PRO", "MAX", "AGENCY"];
  for (const p of order) {
    const limit = PLANS[p].agentLimit;
    if (limit === "all" || agent.order <= limit) return p;
  }
  return "AGENCY";
}

export function planAtLeast(plan: PlanId, min: PlanId) {
  return planRank(plan) >= planRank(min);
}

/** Predefined agent teams (workflows). */
export const AGENT_TEAMS: { id: string; name: string; description: string; agents: string[] }[] = [
  {
    id: "build-website",
    name: "Build Website",
    description: "Planner → Builder → Designer → Copywriter → SEO → Debugger",
    agents: ["planner", "builder", "designer", "copywriter", "seo", "debugger"],
  },
  {
    id: "optimize-landing",
    name: "Optimize Landing Page",
    description: "UX → Conversion → Copywriter → Animation → Performance",
    agents: ["ux", "conversion", "copywriter", "animation", "performance"],
  },
  {
    id: "production-ready",
    name: "Prepare for Production",
    description: "Debugger → Accessibility → Performance → SEO → Security → QA",
    agents: ["debugger", "accessibility", "performance", "seo", "security", "qa"],
  },
  {
    id: "make-premium",
    name: "Make it Premium",
    description: "Designer → Animation → Asset → Copywriter",
    agents: ["designer", "animation", "asset", "copywriter"],
  },
];

/**
 * Automatic agent selection: reads the request and picks the specialist that fits.
 * Falls back to the Builder. The caller clamps the result to the user's plan.
 */
export function pickAgent(request: string, hasContent: boolean): string {
  const p = request.toLowerCase();
  if (!hasContent) return "builder";
  const rules: [RegExp, string][] = [
    [/\b(translate|translation|macedonian|albanian|german|language)\b/, "localization"],
    [/\b(fix|bug|error|broken|not working|crash|console)\b/, "debugger"],
    [/\b(seo|meta|keywords?|google|search ranking|sitemap|structured data)\b/, "seo"],
    [/\b(copy|headline|text|wording|slogan|tagline|rewrite the text|cta text)\b/, "copywriter"],
    [/\b(animat|hover|parallax|scroll effect|transition|micro-?interaction)\b/, "animation"],
    [/\b(3d|three\.?js|sphere|particles|webgl)\b/, "3d"],
    [/\b(accessib|a11y|wcag|contrast|screen reader|keyboard)\b/, "accessibility"],
    [/\b(faster|performance|speed|lazy|bundle|core web vitals|lighthouse)\b/, "performance"],
    [/\b(convert|conversion|cta placement|trust|social proof)\b/, "conversion"],
    [/\b(icon|illustration|images?|photos?|background|mockup)\b/, "asset"],
    [/\b(design|colou?r|palette|font|typograph|spacing|layout|look|style|premium|modern|redesign)\b/, "designer"],
    [/\b(refactor|clean ?up|code quality|duplicat)\b/, "refactoring"],
  ];
  for (const [re, id] of rules) if (re.test(p)) return id;
  return "builder";
}
