import { runtimeResources } from "./runtime-resources";
import { reserveRuntimeCapacity, RuntimeCapacityError } from "./runtime-capacity";
import { preparePreviewEnvironment } from "./preview-environment";
import { fileBytes } from "./file-content";
import "server-only";
import { Sandbox, NotFoundError } from "e2b";
import { createHash, randomUUID } from "node:crypto";
import type { Project, ProjectFile } from "@prisma/client";
import { db } from "./db";
import { buildProjectFiles, readProjectEnv } from "./project-files";
import { runtimePath } from "./runtime-command";
import { SERVER, staticBuildScript } from "./runtime-build";

export const SHELL_TTL = 15 * 60_000;
export const SHELL_ROOT = "/home/user/project";
type Source = Project & { files: ProjectFile[] };
export type ShellState = { sandboxId: string; pid: number; expiresAt: number; previewPort?: number; runtimeVersion?: number; manifest?: Record<string, string> };
export class ShellError extends Error {}
const keyFor = (id: string) => `shell:${id}`;

export async function connectShell(projectId: string) {
  const row = await db.setting.findUnique({ where: { key: keyFor(projectId) } });
  if (!row) throw new ShellError("No active terminal. Connect to start a session.");
  const state = JSON.parse(row.value) as ShellState;
  if (state.expiresAt <= Date.now()) throw new ShellError("The terminal session expired. Connect again to start from your saved project.");
  try { return { sandbox: await Sandbox.connect(state.sandboxId), state }; }
  catch { throw new ShellError("The runtime is no longer available. Reconnect to start a new session."); }
}

const digest = (text: string) => createHash("sha256").update(text).digest("hex");
function sourceFiles(project: Source) {
  const files = buildProjectFiles(project).filter((f) => f.path !== ".env.production");
  if (project.kind !== "app") files.push(
    { path: ".preview.cjs", content: SERVER },
    { path: ".idaevia-static-build.cjs", content: staticBuildScript(files) },
    { path: "package.json", content: JSON.stringify({ name: "website-preview", private: true, scripts: { build: "node .idaevia-static-build.cjs", dev: "npm run build && node .preview.cjs", start: "npm run dev", preview: "node .preview.cjs" } }) },
  );
  const unique = [...new Map(files.map((f) => [f.path, f])).values()];
  unique.forEach((f) => runtimePath(f.path));
  return unique;
}
export function shellSourceMatches(state: ShellState, project: Source) {
  const files = sourceFiles(project);
  return Boolean(state.manifest) && files.length === Object.keys(state.manifest!).length && files.every(f => state.manifest![f.path] === digest(f.content));
}
export async function uploadShellSource(sandbox: Sandbox, project: Source) {
  const files = sourceFiles(project);
  await sandbox.commands.run(`mkdir -p ${SHELL_ROOT}`);
  await sandbox.files.write(files.map((f) => ({ path: runtimePath(f.path), data: new Uint8Array(fileBytes(f.content)).buffer })));
  return Object.fromEntries(files.map((f) => [f.path, digest(f.content)]));
}

/** Merge saved changes only; shell edits to unchanged files (e.g. npm dependencies) survive. */
export async function syncSavedShell(sandbox: Sandbox, state: ShellState, project: Source) {
  const files = sourceFiles(project);
  const next = Object.fromEntries(files.map((f) => [f.path, digest(f.content)]));
  const previous = state.manifest ?? {};
  const changed = files.filter((f) => previous[f.path] !== next[f.path]);
  const removed = Object.keys(previous).filter((path) => !(path in next));
  for (const path of [...changed.map((f) => f.path), ...removed]) {
    let current: string | undefined;
    try { current = digest(await sandbox.files.read(runtimePath(path))); }
    catch (e) { if (!(e instanceof NotFoundError)) throw e; }
    if (current !== undefined && current !== previous[path] && current !== next[path]) {
      throw new ShellError(`Both the editor and terminal changed ${path}. Download the runtime files and resolve the difference before syncing.`);
    }
  }
  if (changed.length) await sandbox.files.write(changed.map((f) => ({ path: runtimePath(f.path), data: new Uint8Array(fileBytes(f.content)).buffer })));
  for (const path of removed) {
    try { await sandbox.files.remove(runtimePath(path)); } catch (e) { if (!(e instanceof NotFoundError)) throw e; }
  }
  if (changed.length || removed.length) {
    const updated = { ...state, manifest: next };
    await db.setting.updateMany({ where: { key: keyFor(project.id), value: JSON.stringify(state) }, data: { value: JSON.stringify(updated) } });
  }
}

/** Ownership is checked by every route before accessing this session. */
export async function ensureShell(project: Source) {
  if (!process.env.E2B_API_KEY) throw new ShellError("Add E2B_API_KEY to the platform's server environment and redeploy to enable the terminal.");
  const lockKey = `${keyFor(project.id)}:lock`;
  const token = randomUUID();
  await db.setting.deleteMany({ where: { key: lockKey, updatedAt: { lt: new Date(Date.now() - 90_000) } } });
  try { await db.setting.create({ data: { key: lockKey, value: token } }); }
  catch { throw new ShellError("Another connection is starting. Try Connect again in a moment."); }
  let releaseCapacity: (() => Promise<unknown>) | undefined;
  const resources = runtimeResources(project.kind);
  let created: Sandbox | undefined;
  let previous: Awaited<ReturnType<typeof connectShell>> | undefined;
  let archive: Uint8Array | undefined;
  try {
    try {
      const active = await connectShell(project.id);
      const processes = await active.sandbox.commands.list();
      if (processes.some((p) => p.pid === active.state.pid)) {
        const info = await active.sandbox.getInfo();
        if (info.memoryMB >= resources.memoryMB && active.state.runtimeVersion === 3) return active.state;
        // Preserve shell-only edits when upgrading memory or preview-host configuration.
        await active.sandbox.commands.run("tar -czf /tmp/idaevia-upgrade.tar.gz --exclude=node_modules --exclude=.next --exclude=.git -C /home/user/project .", { timeoutMs: 30_000 });
        const size = await active.sandbox.commands.run("stat -c %s /tmp/idaevia-upgrade.tar.gz", { timeoutMs: 5000 });
        if (Number(size.stdout.trim()) > 20_000_000) throw new Error("Download your runtime files before upgrading this large terminal session.");
        archive = await active.sandbox.files.read("/tmp/idaevia-upgrade.tar.gz", { format: "bytes" });
        previous = active;
      } else await active.sandbox.kill();
    } catch (e) { if (!(e instanceof ShellError)) throw e; }
    try { releaseCapacity = await reserveRuntimeCapacity(project.userId, keyFor(project.id)); } catch (e) { if (e instanceof RuntimeCapacityError) throw new ShellError(e.message); throw e; }
    created = await Sandbox.create(resources.template, { timeoutMs: SHELL_TTL, metadata: { projectId: project.id, purpose: "terminal" }, network: { allowPublicTraffic: true } });
    const info = await created.getInfo();
    if (info.memoryMB < resources.memoryMB) throw new ShellError(`The configured runtime template needs at least ${resources.memoryMB} MiB RAM.`);
    const manifest = await uploadShellSource(created, project);
    if (archive) {
      await created.files.write("/tmp/idaevia-upgrade.tar.gz", new Uint8Array(archive).buffer);
      await created.commands.run(`tar -xzf /tmp/idaevia-upgrade.tar.gz -C ${SHELL_ROOT}`, { timeoutMs: 30_000 });
    }
    const envs = await preparePreviewEnvironment(created, buildProjectFiles(project), readProjectEnv(project), resources.memoryMB);
    const handle = await created.pty.create({ cwd: SHELL_ROOT, cols: 100, rows: 28, timeoutMs: 0, envs: { ...envs, TERM: "xterm-256color", PS1: "\\w $ " }, onData: () => {} });
    const state = { sandboxId: created.sandboxId, runtimeVersion: 3, pid: handle.pid, manifest: previous?.state.manifest ?? manifest, expiresAt: Date.now() + SHELL_TTL };
    await db.setting.upsert({ where: { key: keyFor(project.id) }, create: { key: keyFor(project.id), value: JSON.stringify(state) }, update: { value: JSON.stringify(state) } });
    await handle.disconnect();
    created = undefined;
    await previous?.sandbox.kill().catch(() => {});
    return state;
  } finally {
    await created?.kill().catch(() => {});
    await releaseCapacity?.();
    await db.setting.deleteMany({ where: { key: lockKey, value: token } });
  }
}

export async function stopShell(projectId: string) {
  const { sandbox, state } = await connectShell(projectId);
  await sandbox.kill();
  await db.setting.deleteMany({ where: { key: keyFor(projectId), value: JSON.stringify(state) } });
}

export async function refreshShellTimeout(projectId: string, sandbox: Sandbox, state: ShellState) {
  await sandbox.setTimeout(SHELL_TTL);
  const expiresAt = Date.now() + SHELL_TTL;
  // Avoid replacing the state if another request has stopped/replaced the session.
  await db.setting.updateMany({ where: { key: keyFor(projectId), value: JSON.stringify(state) }, data: { value: JSON.stringify({ ...state, expiresAt }) } });
}
