import { renderTemplate } from "@/lib/templates";

/** Public HTML preview of a template. */
export async function GET(_req: Request, ctx: RouteContext<"/api/templates/[id]">) {
  const { id } = await ctx.params;
  const html = renderTemplate(id);
  if (!html) return new Response("Not found", { status: 404 });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
