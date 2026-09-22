import { rateLimit, clientIp } from "@/lib/security";
import { checkPortalLink } from "@/lib/portal";
import { z } from "zod";
import { db } from "@/lib/db";
import { error, json } from "@/lib/api";

async function loadLink(token: string, password: string | null) {
  const denied = await checkPortalLink(token, password);
  if (denied) return { err: error(denied.message, denied.status, denied.status === 401 ? { code: "PASSWORD" } : undefined) };
  const link = await db.shareLink.findUniqueOrThrow({ where: { token }, include: { project: { include: { team: true, comments: { orderBy: { createdAt: "asc" } } } } } });
  return { link };
}

/** Public: client portal data (project preview, comments, status, white-label). */
export async function GET(req: Request, ctx: RouteContext<"/api/portal/[token]">) {
  const { token } = await ctx.params;
  const { link, err } = await loadLink(token, req.headers.get("x-portal-password"));
  if (err) return err;
  const p = link!.project;
  const wl = p.team ? JSON.parse(p.team.whiteLabel || "{}") : {};
  return json({
    project: { name: p.name, kind: p.kind, status: p.status, clientStatus: p.clientStatus, updatedAt: p.updatedAt, hasContent: p.kind === "app" ? true : Boolean(p.html) },
    comments: p.comments,
    permissions: { canComment: link!.canComment, canApprove: link!.canApprove },
    brand: { name: wl.brandName || (wl.hideIdaevia ? p.team?.name : "IDÆVIA Build"), logoUrl: wl.logoUrl || null, accent: wl.accent || "#5b5cff", hideIdaevia: Boolean(wl.hideIdaevia), welcome: wl.portalWelcome || null, teamName: p.team?.name ?? null },
  });
}

/** Public: leave a comment / change request / approval. */
export async function POST(req: Request, ctx: RouteContext<"/api/portal/[token]">) {
  const limited = await rateLimit(`portal:ip:${await clientIp()}`, 40, 600);
  if (limited) return limited;
  const { token } = await ctx.params;
  const { link, err } = await loadLink(token, req.headers.get("x-portal-password"));
  if (err) return err;
  const body = z.object({ name: z.string().min(1).max(60), body: z.string().max(2000).default(""), kind: z.enum(["COMMENT", "CHANGE_REQUEST", "APPROVAL"]).default("COMMENT") }).safeParse(await req.json().catch(() => null));
  if (!body.success) return error("Name is required.");
  if (body.data.kind === "APPROVAL" && !link!.canApprove) return error("Approval is not enabled for this link.", 403);
  if (body.data.kind !== "APPROVAL" && !link!.canComment) return error("Comments are not enabled for this link.", 403);
  if (body.data.kind !== "APPROVAL" && !body.data.body.trim()) return error("Write a comment.");
  const comment = await db.comment.create({ data: { projectId: link!.projectId, authorName: body.data.name, body: body.data.body || "Approved ✓", kind: body.data.kind } });
  const clientStatus = body.data.kind === "APPROVAL" ? "APPROVED" : body.data.kind === "CHANGE_REQUEST" ? "CHANGES_REQUESTED" : undefined;
  if (clientStatus) await db.project.update({ where: { id: link!.projectId }, data: { clientStatus } });
  return json({ comment, clientStatus });
}
