import { PREVIEW_TEMPLATE, PREVIEW_SYSTEM_ENV } from "./preview-environment";
import { fileBytes } from "./file-content";
import { recordProjectRelease } from "./project-releases";
import "server-only";
import { Sandbox } from "e2b";
import { randomUUID } from "node:crypto";
import type { Project, ProjectFile } from "@prisma/client";
import { db } from "./db";
import { buildProjectFiles, readProjectEnv } from "./project-files";
import { runtimePath } from "./runtime-command";
import { executeProjectBuild } from "./runtime-build";

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
  let sandbox: Sandbox | undefined;
  let ready = false;
  const cancel = () => { void sandbox?.kill().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    // Validate all paths before provisioning a paid runtime.
    const files = buildProjectFiles(project, readProjectEnv(project)).filter((f) => f.path !== ".env.production");
    files.forEach((f) => runtimePath(f.path));
    if (project.kind === "app" && !files.some((f) => f.path === "src/App.tsx")) throw new Error("Automatic preview currently supports static websites and frontend React projects. Export this project and follow its setup instructions to run its selected stack.");
    if (project.kind !== "app" && !project.html.trim()) throw new Error("There is no website to build yet.");
    await stopProjectRuntime(project.id);
    emit("Creating an isolated build environment…");
    sandbox = await Sandbox.create(PREVIEW_TEMPLATE, { timeoutMs: LIFETIME, metadata: { projectId: project.id }, network: { allowPublicTraffic: true } });
    signal.throwIfAborted();
    emit(`Uploading ${files.length} project files…`);
    await sandbox.files.write(files.map((f) => ({ path: runtimePath(f.path), data: new Uint8Array(fileBytes(f.content)).buffer })));
    // Only explicitly public browser config is passed. Platform secrets never enter the VM.
    const publicEnv = Object.fromEntries(Object.entries(readProjectEnv(project)).filter(([k]) => /^VITE_[A-Z0-9_]+$/.test(k)));
    const activeSandbox = sandbox;
    await executeProjectBuild({
      command: async (command, timeoutMs) => { await activeSandbox.commands.run(command, { cwd: ROOT, envs: { ...publicEnv, ...PREVIEW_SYSTEM_ENV }, timeoutMs, onStdout: emit, onStderr: emit }); },
      writeServer: async (source) => { await activeSandbox.files.write(`${ROOT}/.preview.cjs`, source); },
      startServer: async () => { await activeSandbox.commands.run("node .preview.cjs", { cwd: ROOT, background: true, timeoutMs: 0 }); },
    }, project.kind === "app", emit, signal);
    signal.throwIfAborted();
    const url = `https://${sandbox.getHost(3000)}`;
    const expiresAt = Date.now() + LIFETIME;
    await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify({ sandboxId: sandbox.sandboxId, url, expiresAt }) }, update: { value: JSON.stringify({ sandboxId: sandbox.sandboxId, url, expiresAt }) } });
    const release = await recordProjectRelease(project);
    emit(`Build version v${release.number} ready.`);
    ready = true;
    emit("Build exited successfully. Temporary preview is ready; anyone with its link can view it. It expires within 15 minutes.");
    return { url, expiresAt };
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!ready) await sandbox?.kill().catch(() => {});
    await db.setting.deleteMany({ where: { key: leaseKey, value: lease } });
  }
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
