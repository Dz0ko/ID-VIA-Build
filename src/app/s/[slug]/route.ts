import { db } from "@/lib/db";
import { USER_HTML_HEADERS } from "@/lib/security";

/** IDÆVIA hosting: serves the published version of a project at /s/<slug>. */
export async function GET(_req: Request, ctx: RouteContext<"/s/[slug]">) {
  const { slug } = await ctx.params;
  const project = await db.project.findUnique({ where: { slug }, select: { publishedHtml: true, status: true, name: true } });
  if (!project || project.status !== "PUBLISHED" || !project.publishedHtml) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not published</title></head><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0a0a0b;color:#c9c9cf"><div style="text-align:center"><div style="font-size:40px">Æ</div><p>This site is not published.</p></div></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  return new Response(project.publishedHtml, {
    headers: { ...USER_HTML_HEADERS, "X-Robots-Tag": "all", "Cache-Control": "public, max-age=60" },
  });
}
