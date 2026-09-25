import { previewResponseReady } from "./preview-readiness";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Project, ProjectFile } from "@prisma/client";
import { Sandbox } from "e2b";
import { buildProjectFiles } from "./project-files";
import { db } from "./db";
import { reserveRuntimeCapacity } from "./runtime-capacity";
import { runtimeResources } from "./runtime-resources";
import { runtimeProfile } from "./runtime-profile";
import { preparePreviewEnvironment } from "./preview-environment";
import { uploadShellSource, SHELL_ROOT, SHELL_TTL } from "./shell-session";

type Source = Project & { files: ProjectFile[] };
type State = { sandboxId: string; port: number; fingerprint: string; expiresAt: number };
const keyFor = (adminId: string, projectId: string) => `admin-preview:${adminId}:${projectId}`;
export class AdminPreviewError extends Error {}
/** The sandbox proxy answers 502/503 while nothing listens; any other status means the project's server is up (a dev server renders its own error page). */
const serverAnswers = (status: number) => previewResponseReady(status) || (status >= 400 && status !== 502 && status !== 503);
async function logTail(sandbox: Sandbox, envs: Record<string, string>, bytes = 2000) {
  try {
    const output = await sandbox.commands.run(`tail -c ${bytes} /tmp/idaevia-admin-preview.log 2>/dev/null || true`, { timeoutMs: 5000 });
    let details = output.stdout.replace(/\u001b\[[0-9;]*m/g, "").replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[preview database]");
    for (const [name, value] of Object.entries(envs)) if (/secret|token|password/i.test(name) && value) details = details.replaceAll(value, "[redacted]");
    return details.trim();
  } catch { return ""; }
}

/** Inspect saved code in a separate VM without the owner's integration credentials or terminal. */
export function adminPreviewSource(project: Source): Source {
  return { ...project, envEncrypted: null, files: project.files.filter(f => !/(?:^|\/)\.env(?:\.|$)/.test(f.path) || /(?:^|\/)\.env\.(?:example|sample)$/.test(f.path)) };
}
function fingerprint(project: Source) {
  return createHash("sha256").update(JSON.stringify({ kind: project.kind, html: project.html, memory: project.memory, files: project.files.map(f => ({ path: f.path, content: f.content })).sort((a,b) => a.path.localeCompare(b.path)) })).digest("hex");
}
async function readState(key: string): Promise<State | null> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}
export async function adminPreviewStatus(adminId: string, source: Source) {
  const state = await readState(keyFor(adminId, source.id));
  if (!state || state.expiresAt <= Date.now() || state.fingerprint !== fingerprint(adminPreviewSource(source))) return { ready: false as const };
  try {
    const sandbox = await Sandbox.connect(state.sandboxId);
    const url = `https://${sandbox.getHost(state.port)}`;
    const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (serverAnswers(response.status)) return { ready: true as const, url, expiresAt: state.expiresAt, ...(response.status >= 500 ? { warning: `The project server answers with HTTP ${response.status}; its own error page is shown.` } : {}) };
  } catch { /* An expired VM can be recreated from the saved snapshot. */ }
  return { ready: false as const };
}
async function lock(key: string) {
  const lease = `${key}:lock`, value = randomUUID();
  await db.setting.deleteMany({ where: { key: lease, updatedAt: { lt: new Date(Date.now() - 330_000) } } });
  try { await db.setting.create({ data: { key: lease, value } }); }
  catch { throw new AdminPreviewError("This admin preview is already starting. Wait for it to finish."); }
  return () => db.setting.deleteMany({ where: { key: lease, value } });
}
export async function stopAdminPreview(adminId: string, projectId: string) {
  const key = keyFor(adminId, projectId), release = await lock(key);
  try {
    const state = await readState(key);
    if (state) {
      await Sandbox.kill(state.sandboxId).catch(() => {});
      await db.setting.deleteMany({ where: { key, value: JSON.stringify(state) } });
    }
  } finally { await release(); }
}
export async function startAdminPreview(adminId: string, source: Source, emit: (message: string) => void, signal: AbortSignal) {
  const project = adminPreviewSource(source);
  let stack = "React + TypeScript";
  try { stack = JSON.parse(project.memory || "{}").stack || stack; } catch { /* Detect from files. */ }
  const sourceFiles = buildProjectFiles(project);
  const profile = runtimeProfile(sourceFiles, stack);
  if (profile.issue) throw new AdminPreviewError(profile.issue);
  if (!profile.previewPort) throw new AdminPreviewError("This project has no browser server. Inspect its source files; command-line and native apps do not have a web preview.");
  if (!project.files.length) throw new AdminPreviewError("This project has no source files to preview.");
  if (!process.env.E2B_API_KEY) throw new AdminPreviewError("The preview service is not configured. Set E2B_API_KEY in the server environment.");
  const key = keyFor(adminId, source.id), release = await lock(key);
  let releaseCapacity: (() => Promise<unknown>) | undefined;
  let sandbox: Sandbox | undefined;
  let keep = false;
  try {
    signal.throwIfAborted();
    const existing = await adminPreviewStatus(adminId, source);
    if (existing.ready) return existing;
    releaseCapacity = await reserveRuntimeCapacity(adminId, key);
    const old = await readState(key);
    if (old) {
      await Sandbox.kill(old.sandboxId).catch(() => {});
      await db.setting.deleteMany({ where: { key, value: JSON.stringify(old) } });
    }
    emit("Creating a separate preview environment…");
    const resources = runtimeResources("app");
    sandbox = await Sandbox.create(resources.template, { timeoutMs: SHELL_TTL, metadata: { projectId: source.id, adminId, purpose: "admin-preview" }, network: { allowPublicTraffic: true } });
    if ((await sandbox.getInfo()).memoryMB < resources.memoryMB) throw new AdminPreviewError("The preview template needs at least 4 GB RAM.");
    signal.throwIfAborted();
    await uploadShellSource(sandbox, project);
    emit("Preparing project dependencies and temporary preview data…");
    const envs = await preparePreviewEnvironment(sandbox, sourceFiles, {}, resources.memoryMB);
    const command = await sandbox.commands.run(`(\n${profile.preview}\n) > /tmp/idaevia-admin-preview.log 2>&1; echo $? > /tmp/idaevia-admin-preview.exit`, { cwd: SHELL_ROOT, envs, background: true, timeoutMs: 0 });
    await command.disconnect();
    const url = `https://${sandbox.getHost(profile.previewPort)}`;
    emit(`Starting ${profile.label}. This can take a few minutes on the first run…`);
    const deadline = Date.now() + 210_000;
    let lastNotice = Date.now();
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      try {
        const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
        if (serverAnswers(response.status)) {
          await sandbox.setTimeout(SHELL_TTL);
          const state: State = { sandboxId: sandbox.sandboxId, port: profile.previewPort, fingerprint: fingerprint(project), expiresAt: Date.now() + SHELL_TTL };
          await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(state) }, update: { value: JSON.stringify(state) } });
          keep = true;
          const warning = response.status >= 500 ? `The project server is up but answers with HTTP ${response.status}: a problem in the project's code, shown on its own error page. Last output: ${(await logTail(sandbox, envs, 1200)) || "(none)"}` : undefined;
          return { ready: true as const, url, expiresAt: state.expiresAt, ...(warning ? { warning } : {}) };
        }
      } catch { signal.throwIfAborted(); }
      const exited = await sandbox.files.exists("/tmp/idaevia-admin-preview.exit");
      if (exited) {
        const details = await logTail(sandbox, envs);
        throw new AdminPreviewError(`The project server exited before Preview was ready (a problem in the project's code or configuration, not the platform). ${details || "Check its saved dependencies and startup command."}`);
      }
      if (Date.now() - lastNotice > 15_000) {
        const tail = (await logTail(sandbox, envs, 400)).split("\n").filter(Boolean).slice(-2).join(" · ");
        emit(`Still preparing the project and waiting for its web server (${Math.round((Date.now() - (deadline - 210_000)) / 1000)} s)…${tail ? ` Last output: ${tail}` : ""}`);
        lastNotice = Date.now();
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    const details = await logTail(sandbox, envs);
    throw new AdminPreviewError(`Preview startup timed out after 210 s: the project's server never answered on port ${profile.previewPort}. ${details ? `Last output: ${details}` : "It printed nothing; check its start command and port."}`);
  } finally {
    if (!keep) await sandbox?.kill().catch(() => {});
    await releaseCapacity?.();
    await release();
  }
}
