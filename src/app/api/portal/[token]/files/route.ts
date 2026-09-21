import { db } from "@/lib/db";

/** Public: files of an app project for the client portal sandbox. */
export async function GET(req: Request, ctx: RouteContext<"/api/portal/[token]/files">) {
  const { token } = await ctx.params;
  const link = await db.shareLink.findUnique({ where: { token }, include: { project: { include: { files: { select: { path: true, content: true } } } } } });
  if (!link) return Response.json({ error: "Not found" }, { status: 404 });
  if (link.password && link.password !== req.headers.get("x-portal-password")) return Response.json({ error: "Password required" }, { status: 401 });
  return Response.json({ files: link.project.files });
}
