/**
 * Offline "AI": deterministic generation used when no provider key is configured.
 * It keeps the whole product usable (builder, agents, versions, publish) in dev/demo mode.
 */
import type { GenerateInput } from "./provider";
import { PALETTES, TEMPLATES, renderSite, type SiteConfig } from "../templates";

const KEYWORDS: { re: RegExp; id: string }[] = [
  { re: /crm|saas|software|subscription/i, id: "saas-dark" },
  { re: /agency|studio|design studio/i, id: "agency" },
  { re: /startup|launch|waitlist/i, id: "startup" },
  { re: /portfolio|freelanc|designer|photograph/i, id: "portfolio" },
  { re: /restaurant|cafe|café|bistro|pizz|food|bar\b/i, id: "restaurant" },
  { re: /hotel|villa|resort|apartment|booking/i, id: "hotel" },
  { re: /real ?estate|property|realty/i, id: "realestate" },
  { re: /gym|fitness|trainer|yoga|crossfit/i, id: "fitness" },
  { re: /clinic|dental|dentist|medical|doctor|health/i, id: "medical" },
  { re: /law|legal|attorney|lawyer/i, id: "legal" },
  { re: /car|auto|garage|mechanic|dealership/i, id: "automotive" },
  { re: /event|conference|festival|wedding/i, id: "events" },
  { re: /course|school|academy|education|learn/i, id: "education" },
  { re: /shop|store|e-?commerce|fashion|clothing|product/i, id: "ecommerce" },
  { re: /creator|influencer|link in bio|community/i, id: "creator" },
  { re: /bank|fintech|finance|payment|wallet/i, id: "finance" },
  { re: /token|web3|crypto|nft|defi|dex/i, id: "web3" },
  { re: /game|gaming|studio/i, id: "gaming" },
  { re: /dashboard|analytics|admin/i, id: "dashboard" },
  { re: /\bai\b|agent|assistant|chatbot|llm/i, id: "ai-platform" },
];

const COLOR_WORDS: Record<string, string> = {
  purple: "#a855f7", violet: "#8b5cf6", blue: "#3b82f6", indigo: "#6366f1", green: "#22c55e",
  emerald: "#10b981", teal: "#14b8a6", red: "#ef4444", orange: "#f97316", amber: "#f59e0b",
  yellow: "#eab308", pink: "#ec4899", rose: "#f43f5e", black: "#111111", white: "#f5f5f7", gold: "#d4a017",
};

function pickTemplate(prompt: string): SiteConfig {
  for (const k of KEYWORDS) if (k.re.test(prompt)) return TEMPLATES.find((t) => t.id === k.id)!;
  return TEMPLATES[0];
}

function brandFromPrompt(prompt: string): string | null {
  const m =
    prompt.match(/(?:called|named|name(?:d)? is)\s+["“']?([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,3})["”']?/) ||
    prompt.match(/["“']([^"”']{2,30})["”']/);
  if (!m) return null;
  return m[1].replace(/\s+(with|for|that|and|in|on|targeting|about)\b.*$/i, "").trim() || null;
}

function accentFromPrompt(prompt: string): string | null {
  const p = prompt.toLowerCase();
  for (const [w, hex] of Object.entries(COLOR_WORDS)) if (p.includes(w)) return hex;
  const hex = p.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/);
  return hex ? `#${hex[1]}` : null;
}

/** Apply a small set of deterministic edits to existing HTML. */
function applyEdit(html: string, prompt: string): string {
  let out = html;
  const p = prompt.toLowerCase();
  const accent = accentFromPrompt(prompt);
  if (accent && /(colou?r|accent|button|theme|brand)/.test(p)) {
    const m = out.match(/--accent:(#[0-9a-fA-F]{3,8})/);
    if (m) out = out.split(m[1]).join(accent);
  }
  if (/\bdark\b/.test(p) && !/\blight\b/.test(p)) {
    out = out.replace(/--bg:#[0-9a-fA-F]{3,8}/, `--bg:${PALETTES.dark.bg}`).replace(/--text:#[0-9a-fA-F]{3,8}/, `--text:${PALETTES.dark.text}`).replace(/--surface:#[0-9a-fA-F]{3,8}/, `--surface:${PALETTES.dark.surface}`).replace(/--muted:#[0-9a-fA-F]{3,8}/, `--muted:${PALETTES.dark.muted}`).replace(/--border:#[0-9a-fA-F]{3,8}/, `--border:${PALETTES.dark.border}`);
    out = out.replace(/style="background:#[0-9a-fA-F]{6}cc;/g, `style="background:${PALETTES.dark.bg}cc;`);
  }
  if (/\blight\b/.test(p) && !/\bdark\b/.test(p)) {
    out = out.replace(/--bg:#[0-9a-fA-F]{3,8}/, `--bg:${PALETTES.light.bg}`).replace(/--text:#[0-9a-fA-F]{3,8}/, `--text:${PALETTES.light.text}`).replace(/--surface:#[0-9a-fA-F]{3,8}/, `--surface:${PALETTES.light.surface}`).replace(/--muted:#[0-9a-fA-F]{3,8}/, `--muted:${PALETTES.light.muted}`).replace(/--border:#[0-9a-fA-F]{3,8}/, `--border:${PALETTES.light.border}`);
  }
  const title = prompt.match(/(?:headline|title|heading)\s*(?:to|:|=)?\s*["“']([^"”']{3,120})["”']/i);
  if (title) out = out.replace(/(<h1[^>]*>)([\s\S]*?)(<\/h1>)/, `$1${title[1]}$3`);
  const cta = prompt.match(/(?:cta|button)\s*(?:text|label)?\s*(?:to|:|=)?\s*["“']([^"”']{2,40})["”']/i);
  if (cta) out = out.replace(/(glow"[^>]*>)([^<]*)(<\/a>)/, `$1${cta[1]}$3`);
  if (/remove (the )?(pricing|faq|testimonials|gallery|contact)/i.test(p)) {
    const id = p.match(/remove (?:the )?(pricing|faq|testimonials|gallery|contact)/)![1];
    out = out.replace(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`), "");
  }
  // Mark the edit so the user sees the change even if nothing matched.
  if (out === html) {
    out = out.replace("</head>", `<!-- IDÆVIA mock edit: "${prompt.replace(/-->/g, "")}" (connect an AI provider key for real edits) -->\n</head>`);
  }
  return out;
}

export async function mockGenerate(input: GenerateInput): Promise<string> {
  const last = input.messages[input.messages.length - 1]?.content ?? "";
  const isReport = /output (a )?markdown|markdown report|markdown plan|report|README|roadmap|checklist|QA report|audit/i.test(input.system) && !/Output ONLY the full HTML/i.test(input.system);

  if (isReport) {
    return `## Report (offline mode)

No AI provider key is configured, so this is a deterministic placeholder generated by IDÆVIA's offline engine.

**Task received:** ${last.slice(0, 200).replace(/\n/g, " ")}

### Findings
- Structure looks valid (single HTML document, Tailwind CDN, semantic landmarks).
- Add an \`ANTHROPIC_API_KEY\` or \`OPENAI_API_KEY\` in \`.env\` to get real agent output.

### Next steps
1. Connect a provider key.
2. Re-run this agent.
`;
  }

  // Multi-file React app mode
  if (/MULTI-FILE React/i.test(input.system)) {
    const { mockReactApp } = await import("./mock-app");
    const req = (last.match(/REQUEST[^\n]*\n([\s\S]*)$/)?.[1] ?? last).trim();
    const existing = Array.from(last.matchAll(/<<<FILE\s+([^\s>]+)\s*>>>\n([\s\S]*?)\n<<<END>>>/g)).map((m) => ({ path: m[1], content: m[2] }));
    let files = existing.length ? existing : mockReactApp(req);
    if (existing.length) {
      const accent = accentFromPrompt(req);
      if (accent) files = files.map((f) => ({ ...f, content: f.content.replace(/#6366f1/g, accent) }));
      const app = files.find((f) => f.path === "/App.tsx");
      if (app && !app.content.includes("IDÆVIA mock edit")) {
        app.content = `// IDÆVIA mock edit: "${req.replace(/\*\//g, "")}" (connect an AI provider key for real edits)\n` + app.content;
      }
    }
    return files.map((f) => `<<<FILE ${f.path}>>>\n${f.content}\n<<<END>>>`).join("\n");
  }

  const htmlMatch = last.match(/<<<HTML\n([\s\S]*?)\nHTML>>>/);
  const requestMatch = last.match(/REQUEST[^\n]*\n([\s\S]*)$/);
  const request = (requestMatch ? requestMatch[1] : last).trim();

  if (htmlMatch && htmlMatch[1].trim()) {
    return applyEdit(htmlMatch[1], request);
  }

  const base = pickTemplate(request);
  const cfg: SiteConfig = { ...base, palette: { ...base.palette } };
  const brand = brandFromPrompt(request);
  if (brand) cfg.brand = brand;
  const accent = accentFromPrompt(request);
  if (accent) cfg.palette.accent = accent;
  if (/\bdark\b/i.test(request)) cfg.palette = { ...PALETTES.dark, accent: cfg.palette.accent };
  if (/\blight\b/i.test(request)) cfg.palette = { ...PALETTES.light, accent: cfg.palette.accent };
  if (/macedonian|\bmk\b/i.test(request)) cfg.lang = "mk";
  return cfg.html ?? renderSite(cfg);
}
