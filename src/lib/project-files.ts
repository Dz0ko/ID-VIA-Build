import type { Project, ProjectFile } from "@prisma/client";
import { decryptJson, encryptJson } from "./crypto";
import { db } from "./db";
import { legacyReactSource } from "./project-source";
import { protectProjectNavigation } from "./project-navigation";

export type FileMap = { path: string; content: string }[];

/** Per-project environment variables (encrypted at rest). */
export function readProjectEnv(project: { envEncrypted: string | null }): Record<string, string> {
  return decryptJson<Record<string, string>>(project.envEncrypted) ?? {};
}

export async function writeProjectEnv(projectId: string, env: Record<string, string>) {
  await db.project.update({ where: { id: projectId }, data: { envEncrypted: Object.keys(env).length ? encryptJson(env) : null } });
}

/**
 * The complete, deployable file tree for a project: the same layout the ZIP export,
 * `git push` and `deploy vercel` all use.
 */
export function buildProjectFiles(project: Project & { files: ProjectFile[] }, env: Record<string, string> = {}): FileMap {
  const out: FileMap = [];
  if (project.kind === "app") {
    const stack = (() => { try { return (JSON.parse(project.memory || "{}").stack as string | undefined) ?? "react-ts"; } catch { return "react-ts"; } })();
    if (!legacyReactSource(project.files, stack)) {
      for (const f of project.files) out.push({ path: f.path.replace(/^\/+/, ""), content: f.content });
      const envEntries = Object.entries(env).filter(([k]) => /^\w/.test(k));
      if (envEntries.length && !out.some((f) => f.path === ".env.example")) out.push({ path: ".env.example", content: envEntries.map(([k]) => `${k}=`).join("\n") + "\n" });
      if (!out.some((f) => f.path === ".gitignore")) out.push({ path: ".gitignore", content: "node_modules\ndist\n.env\n.env.local\n" });
      if (!out.some((f) => f.path === "README.md")) out.push({ path: "README.md", content: `# ${escapeHtml(project.name)}\n\nGenerated with IDÆVIA Build (${stack}).\n` });
      return out;
    }
    out.push({ path: "package.json", content: JSON.stringify({
      name: project.slug, private: true, version: "0.1.0", type: "module",
      scripts: { dev: "vite", build: "tsc -b && vite build", preview: "vite preview" },
      dependencies: { react: "^18.3.1", "react-dom": "^18.3.1", "lucide-react": "^0.460.0", recharts: "^2.12.7", "framer-motion": "^11.11.0", clsx: "^2.1.1", zustand: "^5.0.0", "date-fns": "^4.1.0", "@supabase/supabase-js": "^2.45.0" },
      devDependencies: { "@types/react": "^18.3.12", "@types/react-dom": "^18.3.1", "@vitejs/plugin-react": "^4.3.3", typescript: "^5.6.3", vite: "^5.4.10" },
    }, null, 2) + "\n" });
    out.push({ path: "index.html", content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>${escapeHtml(project.name)}</title>\n<script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body>\n<div id="root"></div>\n<script type="module" src="/src/index.tsx"></script>\n</body>\n</html>\n` });
    out.push({ path: "vite.config.ts", content: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });\n` });
    out.push({ path: "tsconfig.json", content: JSON.stringify({ compilerOptions: { target: "ES2020", lib: ["DOM", "DOM.Iterable", "ES2020"], module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", allowJs: true, strict: true, skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true }, include: ["src"] }, null, 2) + "\n" });
    out.push({ path: "src/index.tsx", content: `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\ncreateRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n` });
    for (const f of project.files) out.push({ path: `src/${f.path.replace(/^\/+/, "")}`, content: f.content });
    const vite = Object.entries(env).filter(([k]) => k.startsWith("VITE_"));
    if (vite.length) out.push({ path: ".env.production", content: vite.map(([k, v]) => `${k}=${v}`).join("\n") + "\n" });
    out.push({ path: ".gitignore", content: "node_modules\ndist\n.env\n.env.local\n" });
    out.push({ path: "README.md", content: `# ${project.name}\n\nBuilt with IDÆVIA Build (React + Vite).\n\n\`\`\`bash\nnpm install\nnpm run dev\nnpm run build   # → dist/\n\`\`\`\n` });
  } else {
    for (const f of project.files) { const path = f.path.replace(/^\/+/, ""); if (path !== "index.html") out.push({ path, content: f.content }); }
    out.push({ path: "index.html", content: protectProjectNavigation(project.html) });
    if (!out.some(f => f.path === "vercel.json")) out.push({ path: "vercel.json", content: JSON.stringify({ cleanUrls: true }, null, 2) + "\n" });
    if (!out.some(f => f.path === "README.md")) out.push({ path: "README.md", content: `# ${project.name}\n\nBuilt with IDÆVIA Build.\n\nStatic site: open \`index.html\` or deploy the folder to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).\n` });
  }
  return out;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
