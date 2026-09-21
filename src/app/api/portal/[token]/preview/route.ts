import { USER_HTML_HEADERS } from "@/lib/security";
import { db } from "@/lib/db";
import { checkPortalLink } from "@/lib/portal";

/** Public: renders the project's current HTML for the client portal iframe (same checks as the portal itself). */
export async function GET(req: Request, ctx: RouteContext<"/api/portal/[token]/preview">) {
  const { token } = await ctx.params;
  const pw = req.headers.get("x-portal-password") ?? new URL(req.url).searchParams.get("pw");
  const denied = await checkPortalLink(token, pw);
  if (denied) return new Response(denied.message, { status: denied.status, headers: { "Cache-Control": "no-store" } });
  const link = await db.shareLink.findUniqueOrThrow({ where: { token }, include: { project: { select: { html: true, kind: true, name: true } } } });
  if (link.project.kind === "app") {
    return new Response(`<!DOCTYPE html><html><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0a0a0b;color:#c9c9cf;text-align:center"><div>App project: open the shared sandbox link from the portal to interact.</div></body></html>`, { headers: USER_HTML_HEADERS });
  }
  return new Response(link.project.html || "<!DOCTYPE html><html><body></body></html>", { headers: { ...USER_HTML_HEADERS, "Cache-Control": "no-store" } });
}
