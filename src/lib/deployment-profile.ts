import { runtimeProfile, type RuntimeFile } from "./runtime-profile";
export type DeploymentProfile = { supported: boolean; label: string; framework: string | null; rootDirectory?: string; reason?: string };
/** Never upload an unrecognized backend as a public static directory. */
export function deploymentProfile(files: RuntimeFile[]): DeploymentProfile {
  const detected = runtimeProfile(files.filter(f => f.path.replace(/^\/+/, "") !== ".idaevia/runtime.json"));
  const custom = files.find(f => f.path.replace(/^\/+/, "") === "vercel.json");
  if (custom) {
    try {
      const config = JSON.parse(custom.content);
      if (config.framework || config.builds || config.functions || config.outputDirectory || config.services) return { supported: true, label: "Project Vercel configuration", framework: null };
    } catch { return { supported: false, label: detected.label, framework: null, reason: "Fix invalid vercel.json before deploying." }; }
  }
  const supported = new Set(["nextjs", "nuxtjs", "sveltekit", "astro", "angular", "create-react-app", "remix", "vite", "react-sandbox", "express", "fastify", "nestjs", "fastapi", "flask", "django"]);
  if (detected.id === "static" || supported.has(detected.id)) return { supported: true, label: detected.label, framework: detected.id === "static" ? null : detected.id === "react-sandbox" ? "vite" : detected.id, ...(detected.root !== "." ? { rootDirectory: detected.root } : {}) };
  return { supported: false, label: detected.label, framework: null, reason: `${detected.label} needs a compatible hosting runtime. Push the complete project to GitHub or download it, then deploy it to a host with its required toolchain. For a Vercel-compatible adapter, add vercel.json with explicit functions/build/output settings. The temporary preview is not production hosting.` };
}
