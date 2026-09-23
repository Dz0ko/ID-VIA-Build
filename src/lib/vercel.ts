import { fileBytes } from "./file-content";
import type { FileMap } from "./project-files";

const API = "https://api.vercel.com";

function q(teamId?: string) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

export interface VercelDeployResult { id: string; url: string; state: string; inspectorUrl?: string }

/**
 * Deploy a file tree to Vercel (static site or Vite app) and wait for the build,
 * streaming state changes and build log lines through `log`.
 */
export async function deployToVercel(opts: { token: string; teamId?: string; name: string; files: FileMap; framework: "vite" | null; env: Record<string, string>; log: (line: string) => void }): Promise<VercelDeployResult> {
  const { token, teamId, log } = opts;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const name = opts.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "idaevia-site";

  log(`→ Creating deployment "${name}" on Vercel (${opts.files.length} files)…`);
  const res = await fetch(`${API}/v13/deployments${q(teamId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      target: "production",
      files: opts.files.map((f) => ({ file: f.path, data: fileBytes(f.content).toString("base64"), encoding: "base64" })),
      projectSettings: opts.framework === "vite"
        ? { framework: "vite", buildCommand: "npm run build", outputDirectory: "dist", installCommand: "npm install" }
        : { framework: null, buildCommand: null, outputDirectory: null, installCommand: null },
      meta: { builtWith: "idaevia.app" },
    }),
    signal: AbortSignal.timeout(60000),
  });
  const data = (await res.json()) as { id?: string; url?: string; readyState?: string; inspectorUrl?: string; error?: { code?: string; message?: string } };
  if (!res.ok || !data.id) throw new Error(`Vercel refused the deployment: ${data.error?.message ?? data.error?.code ?? res.status}`);
  log(`  Deployment ${data.id} queued → https://${data.url}`);
  if (data.inspectorUrl) log(`  Inspect: ${data.inspectorUrl}`);

  // Environment variables live on the project; set them so the next builds have them too.
  const envEntries = Object.entries(opts.env);
  if (envEntries.length) {
    const r = await fetch(`${API}/v10/projects/${encodeURIComponent(name)}/env${q(teamId)}${teamId ? "&" : "?"}upsert=true`, {
      method: "POST", headers, body: JSON.stringify(envEntries.map(([key, value]) => ({ key, value, type: "encrypted", target: ["production", "preview", "development"] }))), signal: AbortSignal.timeout(20000),
    });
    log(r.ok ? `  ${envEntries.length} environment variable(s) saved on the Vercel project` : `  ! Could not save environment variables (${r.status}); the deploy continues`);
  }

  let state = data.readyState ?? "QUEUED";
  let lastLog = 0;
  const started = Date.now();
  while (!["READY", "ERROR", "CANCELED"].includes(state) && Date.now() - started < 4 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(`${API}/v13/deployments/${data.id}${q(teamId)}`, { headers, signal: AbortSignal.timeout(20000) });
    const sd = (await s.json().catch(() => ({}))) as { readyState?: string; errorMessage?: string };
    if (sd.readyState && sd.readyState !== state) { state = sd.readyState; log(`  state: ${state}`); }
    if (opts.framework === "vite") {
      const ev = await fetch(`${API}/v3/deployments/${data.id}/events${q(teamId)}${teamId ? "&" : "?"}builds=1&limit=100`, { headers, signal: AbortSignal.timeout(20000) });
      const events = (await ev.json().catch(() => [])) as { created?: number; type?: string; payload?: { text?: string } }[];
      if (Array.isArray(events)) {
        for (const e of events) {
          if ((e.created ?? 0) > lastLog && e.payload?.text && /stdout|stderr|command|error/i.test(e.type ?? "")) {
            log(`  │ ${e.payload.text.replace(/\s+$/, "")}`);
            lastLog = e.created ?? lastLog;
          }
        }
      }
    }
    if (state === "ERROR" && sd.errorMessage) log(`  ✗ ${sd.errorMessage}`);
  }
  if (state === "READY") log(`✓ Live at https://${data.url}`);
  else if (state === "ERROR") throw new Error("The Vercel build failed. See the log above or the inspector link.");
  else log("  ! Still building after 4 minutes; check the Vercel dashboard.");
  return { id: data.id, url: `https://${data.url}`, state, inspectorUrl: data.inspectorUrl };
}
