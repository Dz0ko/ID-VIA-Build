import { AGENTS, AGENT_TEAMS } from "./agents";
import { COMPONENTS, EFFECTS, PROMPT_LIBRARY, PROMPT_PACKS } from "./library";
import { TEMPLATES } from "./templates";

/** Catalog the IDÆVIA Agent "owns" and can recommend from. */
export function catalogSummary() {
  return [
    `TEMPLATES (${TEMPLATES.length}): ${TEMPLATES.map((t) => `${t.name} [${t.category}]`).join("; ")}`,
    `PROMPT LIBRARY (${PROMPT_LIBRARY.length}): ${PROMPT_LIBRARY.map((p) => `${p.title} [${p.category}]`).join("; ")}`,
    `PROMPT PACKS: ${PROMPT_PACKS.map((p) => p.name).join("; ")}`,
    `COMPONENTS: ${COMPONENTS.map((c) => c.name).join(", ")}`,
    `EFFECTS: ${EFFECTS.map((e) => `${e.name} (${e.group})`).join(", ")}`,
    `AGENTS (${AGENTS.length}): ${AGENTS.map((a) => a.name).join(", ")}`,
    `AGENT TEAMS: ${AGENT_TEAMS.map((t) => t.name).join(", ")}`,
  ].join("\n");
}

export const ASSISTANT_SYSTEM = `You are the IDÆVIA Agent: the creative director, product strategist and design lead inside IDÆVIA Build (an AI software creation platform: websites, landing pages, SaaS, dashboards and React apps).

You personally designed everything in the IDÆVIA catalog below: the templates, the prompt library and prompt packs, the component library, the effects and animation library, and the agent team. Recommend them by name when relevant and speak about them as your own work.

What you do:
- Suggest project ideas (websites, SaaS products, dashboards, tools) with a clear angle: who it is for, the core value, the key sections or screens, and how to monetise.
- Give design directions: palette (hex values), typography pairing, layout structure, motion and effects, and which template or components to start from.
- Design on request: when asked to "design" or "make" something, write a complete, specific build brief the Builder can execute.
- Answer questions about how IDÆVIA works (agents, credits, plans, import, client portal, marketplace).

Rules:
- Be concise and concrete. Use short markdown headings and bullet lists. No filler.
- Never use the em dash character. Use commas, colons or full stops instead.
- Do not talk about buying domains or hosting providers; if asked about launching, say the Deploy agent generates a personalised step-by-step launch guide inside the project.
- When you propose something buildable, finish with one to three action blocks on their own lines, exactly in this format:
<<<ACTION {"type":"create_project","name":"Short name","kind":"website","prompt":"A complete, detailed build prompt (sections, style, palette, copy tone, effects)."}>>>
Use "kind":"app" for dashboards, admin panels or SaaS application UIs; "website" for landing pages and marketing sites.
- Reply in the user's language (Macedonian, English, etc.).

IDÆVIA CATALOG:
${catalogSummary()}`;

/** Offline fallback when no AI key is configured. */
export function mockAssistantReply(userText: string): string {
  const t = userText.toLowerCase();
  if (/design|colou?r|font|palette/.test(t)) {
    return `## Design direction\n\n- **Palette:** Void #0A0A0B, Ink #121214, Signal #5B5CFF accent, warm gold #F5C04A highlight.\n- **Typography:** Space Grotesk for headings, Inter for body, JetBrains Mono for labels.\n- **Layout:** hero with a 3D element behind the headline, floating glass stat cards, 3×2 features grid, pricing with a highlighted plan, FAQ, CTA banner.\n- **Effects:** Cursor glow, 3D tilt on cards, Text reveal on the headline, Animated gradient background (all from my Effects library).\n- **Start from:** the “SaaS · Dark Signal” or “AI · Platform” template.\n\n<<<ACTION {"type":"create_project","name":"Dark premium landing","kind":"website","prompt":"Build a premium dark landing page: hero with a large glossy 3D liquid sphere behind the headline, floating glass stat cards, features grid 3x2, pricing with a highlighted plan, testimonials, FAQ and a CTA banner. Palette: #0A0A0B background, #121214 cards, #5B5CFF accent, #F5C04A gold highlights. Fonts: Space Grotesk headings, Inter body. Add cursor glow, 3D tilt on cards, text reveal on the headline and an animated gradient background."}>>>`;
  }
  const ideas = [
    { name: "Bookly", kind: "website", pitch: "online booking site for salons and clinics", prompt: "Build a modern booking website for a hair salon: services with prices, team, gallery, an appointment form with date and time, opening hours and location. Warm palette, rounded cards, subtle reveal animations." },
    { name: "Ledgerly", kind: "app", pitch: "invoicing dashboard for freelancers", prompt: "Build an invoicing dashboard app: sidebar, KPI cards (outstanding, paid, overdue), invoices table with status pills and filters, a new-invoice form and a monthly revenue chart. Dark theme, indigo accent." },
    { name: "Signal Conf", kind: "website", pitch: "conference landing with tickets", prompt: "Build a conference landing page: dates and venue, speakers grid, schedule tabs, three ticket tiers, sponsors and FAQ. Purple neon style with animated gradient background." },
    { name: "Metrix", kind: "app", pitch: "product analytics SaaS UI", prompt: "Build a product analytics dashboard: sidebar, date range picker, funnel chart, retention table, top events list and an alerts panel. Light theme, slate palette." },
  ];
  const head = "## Project ideas\n\nHere are four ideas I can build right away. Click one to create the project:\n\n";
  return (
    head +
    ideas.map((i) => `- **${i.name}**: ${i.pitch}`).join("\n") +
    "\n\n" +
    ideas.map((i) => `<<<ACTION ${JSON.stringify({ type: "create_project", name: i.name, kind: i.kind, prompt: i.prompt })}>>>`).join("\n") +
    "\n\n(Offline mode: add an API key for real answers.)"
  );
}

export interface AssistantAction {
  type: "create_project";
  name: string;
  kind: "website" | "app";
  prompt: string;
}

/** Split a reply into text and parsed action blocks. */
export function parseActions(text: string): { text: string; actions: AssistantAction[] } {
  const actions: AssistantAction[] = [];
  const clean = text.replace(/<<<ACTION\s+([\s\S]*?)>>>/g, (_, json) => {
    try {
      const a = JSON.parse(json);
      if (a && a.type === "create_project" && a.name && a.prompt) actions.push({ type: "create_project", name: String(a.name).slice(0, 80), kind: a.kind === "app" ? "app" : "website", prompt: String(a.prompt).slice(0, 4000) });
    } catch { /* ignore malformed block */ }
    return "";
  });
  return { text: clean.trim(), actions };
}
