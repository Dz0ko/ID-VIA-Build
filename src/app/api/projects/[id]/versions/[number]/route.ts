import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/versions/[number]">) {
  const { id, number } = await ctx.params;
  return withUser(async (user) => {
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    const v = await db.version.findUnique({ where: { projectId_number: { projectId: id, number: Number(number) } } });
    if (!v) return error("Version not found", 404);
    return json({ version: v });
  });
}

/** Restore this version as the current document (creates a new version entry). */
export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/versions/[number]">) {
  const { id, number } = await ctx.params;
  return withUser(async (user) => {
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    const v = await db.version.findUnique({ where: { projectId_number: { projectId: id, number: Number(number) } } });
    if (!v) return error("Version not found", 404);
    const last = await db.version.findFirst({ where: { projectId: id }, orderBy: { number: "desc" } });
    const next = (last?.number ?? 0) + 1;
    await db.$transaction([
      db.project.update({ where: { id }, data: { html: v.html } }),
      db.version.create({ data: { projectId: id, number: next, html: v.html, message: `Restored v${v.number}` } }),
    ]);
    return json({ ok: true, html: v.html, versionNumber: next });
  });
}
