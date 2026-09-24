import "server-only";
import { recordPlatformError } from "./platform-errors";
import { createHash } from "node:crypto";
import { db } from "./db";
import type { RuntimeReport } from "./runtime-report";
type Source = { id: string; kind: string; html: string; files: { path: string; content: string }[] };
export function sourceFingerprint(project: Source) {
  return createHash("sha256").update(JSON.stringify({ kind: project.kind, html: project.html, files: [...project.files].map(f => ({ path: f.path, content: f.content })).sort((a,b) => a.path.localeCompare(b.path)) })).digest("hex");
}
export async function readRuntimeReport(project: Source): Promise<RuntimeReport | null> {
  const row = await db.setting.findUnique({ where: { key: `runtime-report:${project.id}` } });
  if (!row) return null;
  try {
    const report = JSON.parse(row.value);
    if (report.status === "running" && Date.now() - new Date(report.startedAt).getTime() > 360000) {
      report.status = "error";
      report.log += "\nThe build ended without a completion signal. Retry Build to verify the saved source.";
      const changed = await db.setting.updateMany({ where: { key: row.key, value: row.value }, data: { value: JSON.stringify(report) } });
      if (changed.count) {
        const owner = await db.project.findUnique({ where: { id: project.id }, select: { userId: true } });
        await recordPlatformError(new Error("Build timed out without a completion signal. Check hosting execution limits and the runtime."), { source: "build", projectId: project.id, userId: owner?.userId });
      }
    }
    return { ...report, current: report.fingerprint === sourceFingerprint(project) };
  } catch { return null; }
}
export async function saveRuntimeReport(projectId: string, report: RuntimeReport) {
  const key = `runtime-report:${projectId}`, value = JSON.stringify(report);
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Read-only sharing never starts a paid runtime or exposes backend source/configuration. */
export async function availableProjectPreview(project: Source & { status: string }): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: `runtime:${project.id}` } });
  if (row) {
    try {
      const state = JSON.parse(row.value), url = new URL(state.url);
      if (state.expiresAt > Date.now() && state.fingerprint === sourceFingerprint(project) && url.protocol === "https:" && url.hostname.endsWith(".e2b.app")) return url.href;
    } catch { /* Invalid/expired snapshots are not shared. */ }
  }
  if (project.status === "PUBLISHED") {
    const deployment = await db.deployment.findFirst({ where: { projectId: project.id, provider: "vercel", status: "READY" }, orderBy: { createdAt: "desc" }, select: { url: true } });
    try { const url = new URL(deployment?.url ?? ""); if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) return url.href; } catch { /* Not deployed. */ }
  }
  return null;
}
