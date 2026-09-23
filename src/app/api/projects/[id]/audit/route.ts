import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { auditProject } from "@/lib/audit";

export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/audit">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { files: true } });
    if (!project) return error("Not found", 404);
    const result = auditProject(project);
    await db.project.update({ where: { id }, data: { health: JSON.stringify(result) } });
    return json({ audit: result });
  });
}
