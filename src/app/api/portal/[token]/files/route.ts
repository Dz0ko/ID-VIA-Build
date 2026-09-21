import { db } from "@/lib/db";
import { checkPortalLink } from "@/lib/portal";

/** Public: files of an app project for the client portal sandbox (same checks as the portal itself). */
export async function GET(req: Request, ctx: RouteContext<"/api/portal/[token]/files">) {
  const { token } = await ctx.params;
  const denied = await checkPortalLink(token, req.headers.get("x-portal-password"));
  if (denied) return Response.json({ error: denied.message }, { status: denied.status });
  const link = await db.shareLink.findUniqueOrThrow({ where: { token }, include: { project: { include: { files: { select: { path: true, content: true } } } } } });
  return Response.json({ files: link.project.files }, { headers: { "Cache-Control": "no-store" } });
}
