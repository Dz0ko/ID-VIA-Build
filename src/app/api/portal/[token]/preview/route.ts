import { db } from "@/lib/db";

/** Public: renders the project's current HTML for the client portal iframe. */
export async function GET(req: Request, ctx: RouteContext<"/api/portal/[token]/preview">) {
  const { token } = await ctx.params;
  const link = await db.shareLink.findUnique({ where: { token }, include: { project: { select: { html: true, kind: true, name: true } } } });
  if (!link) return new Response("Not found", { status: 404 });
  const pw = new URL(req.url).searchParams.get("pw");
  if (link.password && link.password !== pw) return new Response("Password required", { status: 401 });
  if (link.project.kind === "app") {
    return new Response(`<!DOCTYPE html><html><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0a0a0b;color:#c9c9cf;text-align:center"><div>App project: open the shared sandbox link from the portal to interact.</div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return new Response(link.project.html || "<!DOCTYPE html><html><body></body></html>", { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
