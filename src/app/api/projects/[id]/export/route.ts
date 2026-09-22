import JSZip from "jszip";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { buildProjectFiles, readProjectEnv } from "@/lib/project-files";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/export">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (user.plan === "FREE")
    return Response.json({ error: `Code export is available from the ${PLANS.STARTER.name} plan.`, code: "PLAN" }, { status: 403 });
  const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { files: true } });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const zip = new JSZip();
  for (const f of buildProjectFiles(project, readProjectEnv(project))) zip.file(f.path, f.content);
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Response(buf, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${project.slug}.zip"` },
  });
}
