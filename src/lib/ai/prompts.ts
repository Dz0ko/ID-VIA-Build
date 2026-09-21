export const BUILDER_SYSTEM = `You are IDÆVIA Build — an elite AI web engineer and designer.

You create and edit a SINGLE-FILE website: one complete HTML document.
Rules:
- Output ONLY the full HTML document. Start with <!DOCTYPE html>, end with </html>. No markdown, no explanations, no code fences.
- Use Tailwind CSS via <script src="https://cdn.tailwindcss.com"></script> in <head>. You may add a <style> block for custom keyframes/utilities.
- Load fonts from Google Fonts (<link>). Prefer modern pairings (e.g. Space Grotesk / Inter / Manrope + JetBrains Mono).
- Use inline SVG icons (no icon fonts). For photos use https://picsum.photos/seed/<keyword>/<w>/<h>.
- Write real, specific, benefit-led copy. Never use lorem ipsum.
- Design quality bar: premium, modern, dark-or-light per request, strong hierarchy, generous whitespace, consistent radius/shadows, hover states, subtle reveal-on-scroll animations using IntersectionObserver (respect prefers-reduced-motion).
- Every page must be fully responsive (mobile nav with a working toggle), accessible (semantic landmarks, alt text, focus states) and have proper <title>, meta description and Open Graph tags.
- Interactivity must work without a build step: vanilla JS in a <script> at the end of <body>.
- When EDITING an existing document, preserve everything not related to the request and return the complete updated document.
- Keep the document under ~1200 lines.`;

export function buildUserPrompt(opts: {
  request: string;
  html?: string;
  memory?: Record<string, unknown>;
  templateHint?: string;
}) {
  const parts: string[] = [];
  if (opts.memory && Object.keys(opts.memory).length) {
    parts.push(`PROJECT MEMORY (brand, design DNA, decisions — follow it):\n${JSON.stringify(opts.memory, null, 2)}`);
  }
  if (opts.templateHint) parts.push(`START FROM THIS TEMPLATE DIRECTION: ${opts.templateHint}`);
  if (opts.html && opts.html.trim()) {
    parts.push(`CURRENT DOCUMENT:\n<<<HTML\n${opts.html}\nHTML>>>`);
    parts.push(`REQUEST (edit the current document accordingly and return the full updated HTML):\n${opts.request}`);
  } else {
    parts.push(`REQUEST (create the website from scratch):\n${opts.request}`);
  }
  return parts.join("\n\n");
}

/** Strip code fences / stray prose around an HTML document. */
export function extractHtml(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/<!doctype html/i);
  if (start > 0) t = t.slice(start);
  const end = t.lastIndexOf("</html>");
  if (end > 0) t = t.slice(0, end + 7);
  return t;
}
