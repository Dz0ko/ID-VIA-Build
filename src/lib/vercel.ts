import { deploymentProfile } from "./deployment-profile";
import { redactRuntimeLog } from "./runtime-report";
import { fileBytes } from "./file-content";
import type { FileMap } from "./project-files";

const API = "https://api.vercel.com";

function q(teamId?: string) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

export interface VercelDeployResult { id: string; url: string; state: string; inspectorUrl?: string }

/**
 * Deploy a detected, Vercel-compatible project and wait for the build,
 * streaming state changes and build log lines through `log`.
 */
export async function deployToVercel(opts: { token: string; teamId?: string; name: string; files: FileMap; env: Record<string, string>; log: (line: string) => void }): Promise<VercelDeployResult> {
  const { token, teamId } = opts;
  const profile = deploymentProfile(opts.files);
  if (!profile.supported) throw new Error(profile.reason);
  const log = (line: string) => opts.log(redactRuntimeLog(line, Object.values(opts.env)));
  const files = opts.files.filter(f => !/(?:^|\/)\.env(?:\.|$)/.test(f.path) && !/\.(?:pem|key)$/.test(f.path));
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const name = opts.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "idaevia-site";

  // Save encrypted project variables BEFORE creating the deployment that consumes them.
  const existing = await fetch(`${API}/v9/projects/${encodeURIComponent(name)}${q(teamId)}`, { headers, signal: AbortSignal.timeout(20000) });
  if (!existing.ok && existing.status !== 404) throw new Error(`Could not access the Vercel project (${existing.status}).`);
  if (existing.status === 404) {
    const created = await fetch(`${API}/v11/projects${q(teamId)}`, { method: "POST", headers, body: JSON.stringify({ name, framework: profile.framework }), signal: AbortSignal.timeout(20000) });
    if (!created.ok) throw new Error(`Could not create the Vercel project (${created.status}).`);
  }
  const envEntries = Object.entries(opts.env);
  if (envEntries.length) {
    const r = await fetch(`${API}/v10/projects/${encodeURIComponent(name)}/env${q(teamId)}${teamId ? "&" : "?"}upsert=true`, {
      method: "POST", headers, body: JSON.stringify(envEntries.map(([key, value]) => ({ key, value, type: "encrypted", target: ["production", "preview", "development"] }))), signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`Could not save deployment environment variables (${r.status}). Deployment was not started.`);
    log(`${envEntries.length} encrypted environment variable(s) configured.`);
  }
  log(`→ Creating deployment "${name}" on Vercel (${files.length} files · ${profile.label})…`);
  const res = await fetch(`${API}/v13/deployments${q(teamId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      target: "production",
      project: name,
      files: files.map((f) => ({ file: f.path, data: fileBytes(f.content).toString("base64"), encoding: "base64" })),
      projectSettings: { framework: profile.framework, ...(profile.rootDirectory ? { rootDirectory: profile.rootDirectory } : {}), buildCommand: null, outputDirectory: null, installCommand: null },
      meta: { builtWith: "idaevia.app" },
    }),
    signal: AbortSignal.timeout(60000),
  });
  const data = (await res.json()) as { id?: string; url?: string; readyState?: string; inspectorUrl?: string; error?: { code?: string; message?: string } };
  if (!res.ok || !data.id) throw new Error(`Vercel refused the deployment: ${data.error?.message ?? data.error?.code ?? res.status}`);
  log(`  Deployment ${data.id} queued → https://${data.url}`);
  if (data.inspectorUrl) log(`  Inspect: ${data.inspectorUrl}`);

  let state = data.readyState ?? "QUEUED";
  let lastLog = 0;
  const started = Date.now();
  while (!["READY", "ERROR", "CANCELED"].includes(state) && Date.now() - started < 4 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(`${API}/v13/deployments/${data.id}${q(teamId)}`, { headers, signal: AbortSignal.timeout(20000) });
    const sd = (await s.json().catch(() => ({}))) as { readyState?: string; errorMessage?: string };
    if (sd.readyState && sd.readyState !== state) { state = sd.readyState; log(`  state: ${state}`); }
    {
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
  else if (state === "CANCELED") throw new Error("The Vercel deployment was canceled.");
  else if (state === "ERROR") throw new Error("The Vercel build failed. See the log above or the inspector link.");
  else log("  ! Still building after 4 minutes; check the Vercel dashboard.");
  return { id: data.id, url: `https://${data.url}`, state, inspectorUrl: data.inspectorUrl };
}
