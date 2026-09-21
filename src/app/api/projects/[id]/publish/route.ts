import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/publish">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    if (project.kind === "app") return error("React app projects are deployed by exporting the ZIP (Vite project) to Vercel/Netlify/Cloudflare. One-click hosting for apps is coming.", 400, { code: "APP_EXPORT" });
    if (!project.html.trim()) return error("Nothing to publish yet: generate the site first.");
    let html = project.html;
    if (user.plan === "FREE") {
      html = html.replace(
        "</body>",
        `<a href="${process.env.APP_URL ?? ""}" target="_blank" rel="noopener" style="position:fixed;bottom:12px;right:12px;z-index:9999;font:500 11px/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;background:#0a0a0b;color:#f5f5f7;border:1px solid #1c1c1f;border-radius:999px;padding:8px 12px;text-decoration:none">Made with IDÆVIA</a></body>`,
      );
    }
    const updated = await db.project.update({
      where: { id },
      data: { status: "PUBLISHED", publishedHtml: html, publishedAt: new Date() },
    });
    return json({ ok: true, url: `/s/${updated.slug}`, publishedAt: updated.publishedAt });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]/publish">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    await db.project.update({ where: { id }, data: { status: "DRAFT", publishedHtml: null } });
    return json({ ok: true });
  });
}
