import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * Script-free, watermarked render of a website listing for signed-in users.
 * The original code is never served here; buyers get it through /install.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/marketplace/[id]/preview">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to preview marketplace items.", { status: 401 });
  const item = await db.marketItem.findUnique({ where: { id }, select: { previewHtml: true, published: true } });
  if (!item || !item.published || !item.previewHtml) return new Response("No preview available.", { status: 404 });
  return new Response(item.previewHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy": "default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline' https:; font-src * data:; media-src *; frame-ancestors 'self'",
      "Referrer-Policy": "no-referrer",
    },
  });
}
