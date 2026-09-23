import { BINARY_PREFIX } from "../file-content";
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
- This is a standalone customer project, not IDÆVIA itself. Never link to IDÆVIA paths such as /app, /login, /signup, /admin, /pricing or /api. Use working #section anchors and local interactions instead of sending visitors to the platform login.
- When EDITING an existing document, preserve everything not related to the request and return the complete updated document.
- When REFERENCE IMAGES are attached, recreate their layout, hierarchy, spacing, typography and colour system faithfully as an original implementation; do not copy logos or protected content, use placeholders.
- Keep the document under ~1400 lines.
- After </html>, add one line: <<<NOTE>>> one or two first-person sentences saying what you changed and why (no code) <<<END NOTE>>>

${designSkill("html")}`;

/**
 * Multi-file application mode. React uses the in-browser sandbox; other stacks are exported as complete source trees.
 */
export const APP_BUILDER_SYSTEM = `You are IDÆVIA Build, an elite software engineer and product designer.

You create and edit a MULTI-FILE application in the selected language/framework. React + TypeScript projects run in a browser sandbox; backend, mobile, desktop and other language projects must still be complete, conventional and exportable.

OUTPUT FORMAT, return ONLY files in this exact block format, nothing else:
<<<FILE /App.tsx>>>
...file content...
<<<END>>>
<<<FILE /components/Button.tsx>>>
...
<<<END>>>

Rules:
- For a frontend-only React + TypeScript app include /App.tsx and split UI into focused files under /components, /lib and /pages. The browser sandbox provides the React entrypoint and dependencies. For a full-stack or mixed-language project provide a complete conventional repository with its own package/build configuration instead.
- For every other stack include its conventional entrypoint, dependency/build configuration, environment example, schema or migrations when needed, API routes, tests and README instructions. Use that stack's idioms and folder structure.
- Keep frontend, backend, shared types and configuration in separate files. Never collapse a real application into index.html.
- Use real implementations and mock data only where an external service is not configured; never invent platform secrets.
- This is a standalone customer project. Implement its own routes (including /login, /signup and /api when needed); never send requests to the IDÆVIA platform or rely on its authentication.
- For SaaS requests implement the requested workflows end to end: frontend, backend, database schema and migrations, validation, authentication and authorization, tenant isolation where applicable, error states and tests. Connect UI actions to real persistence; do not present local state or mock dashboards as a complete SaaS.
- Honor every selected technology, including mixed frontend/backend languages. When only a frontend is specified for SaaS, add a compatible backend and database and document these choices. Include setup, build, test and deployment instructions plus environment variable examples with no secrets. External payments/email require explicit configuration; do not claim they are live or that tests ran.
- Any programming language may be requested. If a requested technology cannot implement a requirement, explain that limitation in the completion note instead of silently substituting React or HTML.
- Design quality bar: premium, modern, responsive, accessible; real copy, no lorem ipsum.
- When EDITING: you receive the current files; return the COMPLETE set of files that should exist after the change (unchanged files may be omitted ONLY if you add a line "<<<KEEP /path>>>" for each file you want to keep as-is).
- After the last file block, add one line: <<<NOTE>>> one or two first-person sentences saying what you changed and why (no code) <<<END NOTE>>>

${designSkill("app")}`;

export function buildUserPrompt(opts: {
  request: string;
  html?: string;
  memory?: Record<string, unknown>;
  templateHint?: string;
}) {
  const parts: string[] = [];
  if (opts.memory && Object.keys(opts.memory).length) {
    parts.push(`PROJECT MEMORY (previous decisions; the latest request overrides conflicting brand, domain, layout or requirements):\n${JSON.stringify(opts.memory, null, 2)}`);
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
    parts.push(`PROJECT MEMORY (previous decisions; the latest request overrides conflicting brand, domain, layout or requirements):\n${JSON.stringify(opts.memory, null, 2)}`);
  }
  if (opts.files.length) {
    parts.push(
      `CURRENT FILES:\n${opts.files.map((f) => `<<<FILE ${f.path}>>>\n${f.content.startsWith(BINARY_PREFIX) ? "[Binary asset preserved automatically. Reference its path; do not rewrite its contents.]" : f.content}\n<<<END>>>`).join("\n")}`,
    );
    parts.push(`REQUEST (edit the app; return the complete file set in the block format):\n${opts.request}`);
  } else {
    parts.push(`REQUEST (create the app from scratch; return all files in the block format):\n${opts.request}`);
  }
  return parts.join("\n\n");
}

/** Strip code fences / stray prose around an HTML document. */
/** The agent's first-person completion note, if the model wrote one. */
export function extractNote(text: string): string | null {
  const m = text.match(/<<<NOTE>>>\s*([\s\S]*?)\s*<<<END NOTE>>>/);
  const note = m?.[1]?.replace(/\s+/g, " ").trim();
  return note && note.length > 3 ? note.slice(0, 600) : null;
}

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
  if (files.size) for (const file of existing) if (file.content.startsWith(BINARY_PREFIX)) files.set(file.path, file.content);
  return Array.from(files, ([path, content]) => ({ path, content }));
}
