import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/share">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { shareLinks: { orderBy: { createdAt: "desc" } }, comments: { orderBy: { createdAt: "desc" } } } });
    if (!project) return error("Not found", 404);
    return json({ links: project.shareLinks.map((l) => ({ ...l, password: undefined, hasPassword: Boolean(l.password) })), comments: project.comments, clientStatus: project.clientStatus });
  });
}

/** Create a client portal link. */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/share">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const body = z.object({ label: z.string().max(60).optional(), password: z.string().max(60).optional(), canComment: z.boolean().default(true), canApprove: z.boolean().default(true) }).safeParse(await req.json().catch(() => ({})));
    if (!body.success) return error("Invalid input.");
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    const link = await db.shareLink.create({ data: { projectId: id, token: randomBytes(12).toString("base64url"), label: body.data.label, password: body.data.password || null, canComment: body.data.canComment, canApprove: body.data.canApprove } });
    if (project.clientStatus === "NONE") await db.project.update({ where: { id }, data: { clientStatus: "REVIEW" } });
    return json({ link: { ...link, password: undefined, hasPassword: Boolean(link.password) }, url: `/portal/${link.token}` });
  });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/projects/[id]/share">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const { linkId, commentId, resolve } = (await req.json().catch(() => ({}))) as { linkId?: string; commentId?: string; resolve?: boolean };
    const project = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return error("Not found", 404);
    if (linkId) await db.shareLink.deleteMany({ where: { id: linkId, projectId: id } });
    if (commentId) {
      if (resolve) await db.comment.updateMany({ where: { id: commentId, projectId: id }, data: { resolved: true } });
      else await db.comment.deleteMany({ where: { id: commentId, projectId: id } });
    }
    return json({ ok: true });
  });
}
