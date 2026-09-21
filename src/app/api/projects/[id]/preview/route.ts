import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Renders the current (draft) HTML of a project for the owner. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/preview">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const project = await db.project.findFirst({ where: { id, userId: user.id }, select: { html: true } });
  if (!project) return new Response("Not found", { status: 404 });
  const html =
    project.html.trim() ||
    `<!DOCTYPE html><html><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0a0a0b;color:#8a8a93;font-size:14px">Empty project — describe what to build.</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
