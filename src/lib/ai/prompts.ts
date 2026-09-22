import { designSkill } from "./design-skill";

export const BUILDER_SYSTEM = `You are IDÆVIA Build, an elite AI web engineer and designer.

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
- When REFERENCE IMAGES are attached, recreate their layout, hierarchy, spacing, typography and colour system faithfully as an original implementation; do not copy logos or protected content, use placeholders.
- Keep the document under ~1400 lines.

${designSkill("html")}`;

/**
 * Multi-file React app mode. The model returns a file manifest in a strict block format
 * that we parse into ProjectFile rows and render with an in-browser sandbox (Sandpack, react-ts).
 */
export const APP_BUILDER_SYSTEM = `You are IDÆVIA Build, an elite React engineer and product designer.

You create and edit a MULTI-FILE React + TypeScript application that runs in a browser sandbox (Vite-like, React 18, TypeScript). Tailwind is available through a CDN script already injected in the sandbox HTML, so use Tailwind utility classes freely.
Available packages: react, react-dom, lucide-react, recharts, framer-motion, clsx, zustand, date-fns.

OUTPUT FORMAT, return ONLY files in this exact block format, nothing else:
<<<FILE /App.tsx>>>
...file content...
<<<END>>>
<<<FILE /components/Button.tsx>>>
...
<<<END>>>

Rules:
- Always include /App.tsx (default export a React component). Never output /index.tsx or package.json, the sandbox provides them.
- Split UI into sensible files under /components, /lib, /pages. Keep each file focused.
- Use TypeScript, functional components, hooks. No server code, no Node APIs, no fetch to private APIs; mock data lives in /lib/data.ts.
- Design quality bar: premium, modern, responsive, accessible; real copy, no lorem ipsum.
- When EDITING: you receive the current files; return the COMPLETE set of files that should exist after the change (unchanged files may be omitted ONLY if you add a line "<<<KEEP /path>>>" for each file you want to keep as-is).

${designSkill("app")}`;

export function buildUserPrompt(opts: {
  request: string;
  html?: string;
  memory?: Record<string, unknown>;
  templateHint?: string;
}) {
  const parts: string[] = [];
  if (opts.memory && Object.keys(opts.memory).length) {
    parts.push(`PROJECT MEMORY (brand, design DNA, decisions, follow it):\n${JSON.stringify(opts.memory, null, 2)}`);
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

export function buildAppUserPrompt(opts: {
  request: string;
  files: { path: string; content: string }[];
  memory?: Record<string, unknown>;
}) {
  const parts: string[] = [];
  if (opts.memory && Object.keys(opts.memory).length) {
    parts.push(`PROJECT MEMORY:\n${JSON.stringify(opts.memory, null, 2)}`);
  }
  if (opts.files.length) {
    parts.push(
      `CURRENT FILES:\n${opts.files.map((f) => `<<<FILE ${f.path}>>>\n${f.content}\n<<<END>>>`).join("\n")}`,
    );
    parts.push(`REQUEST (edit the app; return the complete file set in the block format):\n${opts.request}`);
  } else {
    parts.push(`REQUEST (create the app from scratch; return all files in the block format):\n${opts.request}`);
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

/** Parse the <<<FILE path>>> … <<<END>>> manifest. */
export function parseFileManifest(text: string, existing: { path: string; content: string }[] = []) {
  const files = new Map<string, string>();
  const re = /<<<FILE\s+([^\s>]+)\s*>>>\n?([\s\S]*?)\n?<<<END>>>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const path = m[1].startsWith("/") ? m[1] : `/${m[1]}`;
    files.set(path, m[2].replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, ""));
  }
  const keepRe = /<<<KEEP\s+([^\s>]+)\s*>>>/g;
  while ((m = keepRe.exec(text))) {
    const path = m[1].startsWith("/") ? m[1] : `/${m[1]}`;
    const prev = existing.find((f) => f.path === path);
    if (prev && !files.has(path)) files.set(path, prev.content);
  }
  return Array.from(files, ([path, content]) => ({ path, content }));
}
