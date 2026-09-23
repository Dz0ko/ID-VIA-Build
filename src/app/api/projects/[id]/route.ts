import { withProjectWrite } from "@/lib/project-lock";
import { publicProject } from "@/lib/public-project";
import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  html: z.string().max(2_000_000).optional(),
  memory: z.record(z.string(), z.unknown()).optional(),
  saveVersion: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const project = await db.project.findFirst({
      where: { id, userId: user.id },
      include: {
        versions: { orderBy: { number: "desc" }, select: { id: true, number: true, message: true, createdAt: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 200 },
        agentRuns: { orderBy: { startedAt: "desc" }, take: 30 },
      },
    });
    if (!project) return error("Not found", 404);
    return json({ project: publicProject(project) });
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return withUser(async (user) => withProjectWrite(id, user.id, async () => {
    const body = patchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    const data: Record<string, unknown> = {};
    if (body.data.name !== undefined) data.name = body.data.name;
    if (body.data.description !== undefined) data.description = body.data.description;
    if (body.data.html !== undefined) data.html = body.data.html;
    if (body.data.memory !== undefined) data.memory = JSON.stringify(body.data.memory);
    return db.$transaction(async (tx) => {
      const updated = await tx.project.update({ where: { id }, data });
      let versionNumber: number | undefined;
      if (body.data.saveVersion && body.data.html !== undefined) {
        const last = await tx.version.findFirst({ where: { projectId: id }, orderBy: { number: "desc" } });
        versionNumber = (last?.number ?? 0) + 1;
        await tx.version.create({ data: { projectId: id, number: versionNumber, html: body.data.html, message: "Manual edit" } });
      }
      return json({ project: publicProject(updated), versionNumber });
    });
  }));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return withUser(async (user) => withProjectWrite(id, user.id, async () => {
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    await db.project.delete({ where: { id } });
    return json({ ok: true });
  }));
}
