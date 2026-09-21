import JSZip from "jszip";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/export">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (user.plan === "FREE")
    return Response.json({ error: `Code export is available from the ${PLANS.STARTER.name} plan.`, code: "PLAN" }, { status: 403 });
  const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { files: true } });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const zip = new JSZip();
  if (project.kind === "app") {
    // Vite + React + TS scaffold around the sandbox files
    zip.file("package.json", JSON.stringify({
      name: project.slug, private: true, version: "0.1.0", type: "module",
      scripts: { dev: "vite", build: "tsc -b && vite build", preview: "vite preview" },
      dependencies: { react: "^18.3.1", "react-dom": "^18.3.1", "lucide-react": "^0.460.0", recharts: "^2.12.7", "framer-motion": "^11.11.0", clsx: "^2.1.1", zustand: "^5.0.0", "date-fns": "^4.1.0" },
      devDependencies: { "@types/react": "^18.3.12", "@types/react-dom": "^18.3.1", "@vitejs/plugin-react": "^4.3.3", typescript: "^5.6.3", vite: "^5.4.10" },
    }, null, 2));
    zip.file("index.html", `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>${project.name}</title>\n<script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body>\n<div id="root"></div>\n<script type="module" src="/src/index.tsx"></script>\n</body>\n</html>\n`);
    zip.file("vite.config.ts", `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });\n`);
    zip.file("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2020", lib: ["DOM", "DOM.Iterable", "ES2020"], module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true }, include: ["src"] }, null, 2));
    zip.file("src/index.tsx", `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\ncreateRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);\n`);
    for (const f of project.files) zip.file(`src${f.path}`, f.content);
    zip.file("README.md", `# ${project.name}\n\nExported from IDÆVIA Build (React + Vite).\n\n\`\`\`bash\nnpm install\nnpm run dev\nnpm run build   # → dist/ (deploy to Vercel, Netlify, Cloudflare Pages)\n\`\`\`\n`);
  } else {
    zip.file("index.html", project.html);
    zip.file("README.md", `# ${project.name}\n\nExported from IDÆVIA Build.\n\n- Open \`index.html\` in a browser, or deploy the folder to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).\n- The page uses Tailwind CSS via CDN and Google Fonts; no build step required.\n`);
    zip.file("vercel.json", JSON.stringify({ cleanUrls: true }, null, 2));
  }
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Response(buf, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${project.slug}.zip"` },
  });
}
