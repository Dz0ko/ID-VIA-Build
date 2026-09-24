import { previewResponseReady } from "@/lib/preview-readiness";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readRuntimeReport, sourceFingerprint } from "@/lib/runtime-report-store";
import { runtimeProfile } from "@/lib/runtime-profile";
import { buildProjectFiles } from "@/lib/project-files";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const project = await db.project.findFirst({ where: { id: (await ctx.params).id, userId: user.id }, include: { files: true } });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  const report = await readRuntimeReport(project);
  let preview: { url: string; expiresAt: number } | null = null;
  const row = await db.setting.findUnique({ where: { key: `runtime:${project.id}` } });
  if (row) {
    try {
      const state = JSON.parse(row.value), url = new URL(state.url);
      if (state.fingerprint === sourceFingerprint(project) && state.expiresAt > Date.now() && url.protocol === "https:" && url.hostname.endsWith(".e2b.app")) {
        const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(4000) });
        if (previewResponseReady(response.status)) preview = { url: url.href, expiresAt: state.expiresAt };
      }
    } catch { /* Expired or stopped runtimes are recreated from saved code. */ }
  }
  return Response.json({ preview, profile: runtimeProfile(buildProjectFiles(project)), report }, { headers: { "Cache-Control": "private, no-store" } });
}
