import { availableProjectPreview } from "@/lib/runtime-report-store";
import { USER_HTML_HEADERS } from "@/lib/security";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Renders the current (draft) HTML of a project for the owner. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/preview">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { files: true } });
  if (!project) return new Response("Not found", { status: 404 });
  if (project.kind === "app") {
    const url = await availableProjectPreview(project);
    if (url) return new Response(null, { status: 307, headers: { Location: url, "Cache-Control": "private, no-store" } });
    return new Response('<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;font:18px system-ui;background:#101014;color:#c9c9cf;text-align:center"><div>Application project<br><small>Open the workspace to build and preview.</small></div></body></html>', { headers: { ...USER_HTML_HEADERS, "Cache-Control": "no-store" } });
  }
  const html =
    project.html.trim() ||
    `<!DOCTYPE html><html><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0a0a0b;color:#8a8a93;font-size:14px">Empty project: describe what to build.</body></html>`;
  return new Response(html, { headers: { ...USER_HTML_HEADERS, "Cache-Control": "no-store" } });
}
