import { recordPlatformError, resolveProjectIncidents } from "./platform-errors";
import { diagnosticExcerpt } from "./platform-error-details";
import { previewResponseReady } from "./preview-readiness";
import { runtimeResources } from "./runtime-resources";
import { reserveRuntimeCapacity } from "./runtime-capacity";
import { preparePreviewEnvironment } from "./preview-environment";
import { fileBytes } from "./file-content";
import { recordProjectRelease } from "./project-releases";
import "server-only";
import { Sandbox } from "e2b";
import { randomUUID } from "node:crypto";
import type { Project, ProjectFile } from "@prisma/client";
import { db } from "./db";
import { buildProjectFiles, readProjectEnv } from "./project-files";
import { runtimePath } from "./runtime-command";
import { executeLanguageBuild, SERVER, staticBuildScript } from "./runtime-build";
import { runtimeProfile } from "./runtime-profile";
import { redactRuntimeLog, type RuntimeReport } from "./runtime-report";
import { sourceFingerprint, saveRuntimeReport } from "./runtime-report-store";

const LIFETIME = 15 * 60_000;
const ROOT = "/home/user/project";

/** Ownership must be checked before entry. Each build gets a fresh isolated VM. */
export async function runProjectBuild(project: Project & { files: ProjectFile[] }, emit: (line: string) => void, signal: AbortSignal) {
  if (!process.env.E2B_API_KEY) throw new Error("Build runtime is not configured. The platform owner must add E2B_API_KEY to Vercel and redeploy.");
  const key = `runtime:${project.id}`;
  const leaseKey = `${key}:lock`;
  const lease = JSON.stringify({ token: randomUUID() });
  // Expired leases can be recovered after a terminated serverless request.
  await db.setting.deleteMany({ where: { key: leaseKey, updatedAt: { lt: new Date(Date.now() - 360_000) } } });
  try { await db.setting.create({ data: { key: leaseKey, value: lease } }); }
  catch { throw new Error("A build is already running for this project. Wait for it to finish."); }
  const resources = runtimeResources(project.kind);
  let releaseCapacity: (() => Promise<unknown>) | undefined;
  let sandbox: Sandbox | undefined;
  let ready = false;
  let secrets: string[] = [];
  // Until the project's own build command runs, a failure is the platform's (capacity, sandbox, upload); from then on it is the project's.
  let phase: "setup" | "build" = "setup";
  const report: RuntimeReport = { status: "running", label: "Project", log: "", startedAt: new Date().toISOString(), fingerprint: sourceFingerprint(project) };
  const output = (line: string) => { const safe = redactRuntimeLog(line, secrets); report.log = (report.log + safe + "\n").slice(-48000); emit(safe); };
  const cancel = () => { void sandbox?.kill().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    const settings = readProjectEnv(project);
    secrets = Object.values(settings);
    const files = buildProjectFiles(project).filter((f) => f.path !== ".env.production");
    for (const file of files.filter(f => /(?:^|\/)\.env(?:\.|$)/.test(f.path))) {
      for (const line of file.content.split("\n")) { const value = line.match(/^[A-Za-z_][A-Za-z0-9_]*=(.*)$/)?.[1]?.replace(/^["']|["']$/g, ""); if (value) secrets.push(value); }
    }
    files.forEach((f) => runtimePath(f.path));
    if (project.kind !== "app" && !project.html.trim()) throw new Error("There is no website to build yet.");
    const profile = runtimeProfile(files);
    report.label = profile.label;
    if (profile.issue) throw new Error(profile.issue);
    await saveRuntimeReport(project.id, report);
    releaseCapacity = await reserveRuntimeCapacity(project.userId, key);
    // A VM that is still alive from the previous build or preview keeps its installed dependencies and caches, so the
    // next build takes seconds instead of a fresh install; anything else starts clean.
    const reused = await reuseProjectRuntime(project.id);
    if (reused) {
      sandbox = reused;
      emit("Reusing the running environment (dependencies already installed)…");
      await sandbox.commands.run("fuser -k 3000/tcp >/dev/null 2>&1; pkill -f 'next|vite|node ' >/dev/null 2>&1; true", { cwd: ROOT, timeoutMs: 20_000 }).catch(() => {});
    } else {
      await stopProjectRuntime(project.id);
      emit("Creating an isolated build environment…");
      sandbox = await Sandbox.create(resources.template, { timeoutMs: LIFETIME, metadata: { projectId: project.id }, network: { allowPublicTraffic: true } });
      const info = await sandbox.getInfo();
      if (info.memoryMB < resources.memoryMB) throw new Error(`The configured build template needs at least ${resources.memoryMB} MiB RAM.`);
    }
    signal.throwIfAborted();
    emit(`Uploading ${files.length} project files…`);
    await sandbox.files.write(files.map((f) => ({ path: runtimePath(f.path), data: new Uint8Array(fileBytes(f.content)).buffer })));
    if (reused) {
      // Files deleted in the editor must not linger in the reused VM.
      await sandbox.files.write("/tmp/idaevia-keep.txt", files.map((f) => f.path).join("\n") + "\n");
      await sandbox.commands.run(`cd ${ROOT} && find . -type f -not -path './node_modules/*' -not -path './.next/*' -not -path './dist/*' -not -path './build/*' -not -path './.git/*' -not -path './.venv/*' -not -path './vendor/*' -not -name '.idaevia-*' -not -name '.preview.cjs' | sed 's#^\./##' | grep -vxFf /tmp/idaevia-keep.txt | xargs -r rm -f`, { timeoutMs: 30_000 }).catch(() => {});
    }
    // Only this project's settings enter its VM. The platform environment never does.
    const envs = await preparePreviewEnvironment(sandbox, files, settings, resources.memoryMB);
    secrets.push(...Object.values(envs).filter(v => v.length > 20));
    if (profile.id === "static") {
      await sandbox.files.write(`${ROOT}/.idaevia-static-build.cjs`, staticBuildScript(files));
      await sandbox.files.write(`${ROOT}/.preview.cjs`, SERVER);
    }
    const activeSandbox = sandbox;
    phase = "build";
    await executeLanguageBuild({
      command: async (command, timeoutMs) => {
        try { await activeSandbox.commands.run(command, { cwd: ROOT, envs, timeoutMs, onStdout: output, onStderr: output }); }
        catch (error) { if (await activeSandbox.files.exists("/tmp/idaevia-build-preview.log")) output(await activeSandbox.files.read("/tmp/idaevia-build-preview.log").then(s => s.slice(-12000))); throw error; }
      },
      start: async (command) => {
        const handle = await activeSandbox.commands.run(`(\n${command}\n) > /tmp/idaevia-build-preview.log 2>&1`, { cwd: ROOT, envs, background: true, timeoutMs: 0, onStdout: output, onStderr: output });
        await handle.disconnect();
      },
    }, profile, output, signal);
    signal.throwIfAborted();
    const url = profile.previewPort ? `https://${sandbox.getHost(profile.previewPort)}` : null;
    const expiresAt = Date.now() + LIFETIME;
    if (url) {
      const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
      if (!previewResponseReady(response.status)) throw new Error(`The external preview returned HTTP ${response.status}. Check allowed hosts and application configuration. ${redactRuntimeLog((await response.text()).slice(0, 1500), secrets)}`);
      await sandbox.setTimeout(LIFETIME);
      await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify({ sandboxId: sandbox.sandboxId, url, expiresAt, fingerprint: report.fingerprint }) }, update: { value: JSON.stringify({ sandboxId: sandbox.sandboxId, url, expiresAt, fingerprint: report.fingerprint }) } });
    }
    const release = await recordProjectRelease(project);
    output(`Build version v${release.number} ready.`);
    ready = Boolean(url);
    report.status = "success";
    output(url ? "Build succeeded. Temporary preview expires within 15 minutes." : "Build succeeded. Run this project in Terminal to see its output.");
    await resolveProjectIncidents(project.id, ["build", "shell"], "Resolved automatically: a later build of this project succeeded");
    return { url, expiresAt };
  } catch (error) {
    report.status = "error";
    const message = error instanceof Error ? error.message : "Build failed";
    report.origin = phase === "build" || /^(?:Invalid \.idaevia\/runtime\.json|There is no website to build|No automatic runtime detected|Required runtime tool is unavailable|No build script|No dev\/start\/preview script)/.test(message) ? "project" : "platform";
    output(message);
    await recordPlatformError(error, { source: "build", userId: project.userId, projectId: project.id, details: diagnosticExcerpt(report.log), secrets });
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    await saveRuntimeReport(project.id, report).catch(() => {});
    signal.removeEventListener("abort", cancel);
    if (!ready) await sandbox?.kill().catch(() => {});
    await releaseCapacity?.();
    await db.setting.deleteMany({ where: { key: leaseKey, value: lease } });
  }
}

/** The project's live VM when it is still running; null when it expired, was stopped or cannot be reached. */
async function reuseProjectRuntime(projectId: string): Promise<Sandbox | null> {
  const row = await db.setting.findUnique({ where: { key: `runtime:${projectId}` } });
  if (!row) return null;
  try {
    const state = JSON.parse(row.value) as { sandboxId?: string; expiresAt?: number };
    if (!state.sandboxId || !state.expiresAt || state.expiresAt < Date.now() + 60_000) return null;
    const sandbox = await Sandbox.connect(state.sandboxId);
    await sandbox.setTimeout(LIFETIME);
    return sandbox;
  } catch { return null; }
}

export async function stopProjectRuntime(projectId: string) {
  const key = `runtime:${projectId}`;
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return;
  const state = JSON.parse(row.value) as { sandboxId: string; expiresAt: number };
  if (state.expiresAt > Date.now()) {
    try { await Sandbox.kill(state.sandboxId); }
    catch (error) { if (!(error instanceof Error && /not found|404/i.test(error.message))) throw new Error("Could not stop the previous runtime. Try again."); }
  }
  await db.setting.deleteMany({ where: { key, value: row.value } });
}
