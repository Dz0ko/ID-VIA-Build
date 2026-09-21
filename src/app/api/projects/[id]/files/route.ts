import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

const schema = z.object({
  files: z.array(z.object({ path: z.string().regex(/^\/[\w\-./]+$/), content: z.string().max(300_000) })).max(80),
  saveVersion: z.boolean().optional(),
  message: z.string().max(120).optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/files">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { files: { orderBy: { path: "asc" } } } });
    if (!project) return error("Not found", 404);
    return json({ files: project.files.map((f) => ({ path: f.path, content: f.content })) });
  });
}

/** Replace the full file set (manual edits from the code editor). */
export async function PUT(req: Request, ctx: RouteContext<"/api/projects/[id]/files">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid files payload.");
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.projectFile.deleteMany({ where: { projectId: id } }),
      ...body.data.files.map((f) => db.projectFile.create({ data: { projectId: id, path: f.path, content: f.content } })),
    ];
    let versionNumber: number | undefined;
    if (body.data.saveVersion) {
      const last = await db.version.findFirst({ where: { projectId: id }, orderBy: { number: "desc" } });
      versionNumber = (last?.number ?? 0) + 1;
      ops.push(db.version.create({ data: { projectId: id, number: versionNumber, html: JSON.stringify(body.data.files), message: body.data.message ?? "Manual edit" } }));
    }
    await db.$transaction(ops);
    return json({ ok: true, versionNumber });
  });
}
