import { downloadName } from "@/lib/download-name";
import { fileBytes } from "@/lib/file-content";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { buildProjectFiles } from "@/lib/project-files";

export async function GET(req: Request, ctx: RouteContext<"/api/projects/[id]/export">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (user.plan === "FREE")
    return Response.json({ error: `Code export is available from the ${PLANS.STARTER.name} plan.`, code: "PLAN" }, { status: 403 });
  const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { files: true } });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const params = new URL(req.url).searchParams;
  const name = downloadName(params.get("name") || project.name);
  const folder = params.get("folder") === "1" ? name + "/" : "";
  const zip = new JSZip();
  for (const f of buildProjectFiles(project).filter(f => !/(^|\/)\.env(?:\.|$)/.test(f.path) || /(^|\/)\.env\.example$/.test(f.path))) zip.file(folder + f.path, fileBytes(f.content));
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Response(buf, {
    headers: { "Content-Type": "application/zip", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="project.zip"; filename*=UTF-8''${encodeURIComponent(name)}.zip` },
  });
}
