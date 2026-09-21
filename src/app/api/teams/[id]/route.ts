import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

const ROLES = ["OWNER", "ADMIN", "DEVELOPER", "DESIGNER", "EDITOR", "VIEWER"] as const;

async function requireRole(teamId: string, userId: string, roles: readonly string[]) {
  const m = await db.teamMember.findFirst({ where: { teamId, userId, status: "ACTIVE" } });
  return m && roles.includes(m.role) ? m : null;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/teams/[id]">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const m = await db.teamMember.findFirst({ where: { teamId: id, userId: user.id } });
    if (!m) return error("Not found", 404);
    const team = await db.team.findUnique({ where: { id }, include: { members: { orderBy: { createdAt: "asc" } }, projects: { select: { id: true, name: true, status: true, clientStatus: true, slug: true, updatedAt: true } } } });
    if (!team) return error("Not found", 404);
    return json({ team: { ...team, whiteLabel: JSON.parse(team.whiteLabel || "{}"), myRole: m.role } });
  });
}

/** Update name / white-label; add or remove members; attach projects. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/teams/[id]">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const me = await requireRole(id, user.id, ["OWNER", "ADMIN"]);
    if (!me) return error("Forbidden", 403);
    const body = z
      .object({
        name: z.string().min(2).max(60).optional(),
        whiteLabel: z.object({ brandName: z.string().max(60).optional(), logoUrl: z.string().max(500).optional(), accent: z.string().max(20).optional(), hideIdaevia: z.boolean().optional(), portalWelcome: z.string().max(500).optional() }).optional(),
        invite: z.object({ email: z.string().email(), role: z.enum(ROLES).default("EDITOR") }).optional(),
        removeEmail: z.string().email().optional(),
        setRole: z.object({ email: z.string().email(), role: z.enum(ROLES) }).optional(),
        attachProjectId: z.string().optional(),
        detachProjectId: z.string().optional(),
      })
      .safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    const d = body.data;
    if (d.name || d.whiteLabel) {
      const team = await db.team.findUniqueOrThrow({ where: { id } });
      const wl = { ...JSON.parse(team.whiteLabel || "{}"), ...(d.whiteLabel ?? {}) };
      await db.team.update({ where: { id }, data: { name: d.name ?? team.name, whiteLabel: JSON.stringify(wl) } });
    }
    if (d.invite) {
      const email = d.invite.email.toLowerCase();
      const existing = await db.user.findUnique({ where: { email } });
      await db.teamMember.upsert({
        where: { teamId_email: { teamId: id, email } },
        create: { teamId: id, email, userId: existing?.id, role: d.invite.role, status: existing ? "ACTIVE" : "PENDING" },
        update: { role: d.invite.role },
      });
    }
    if (d.removeEmail) {
      const target = await db.teamMember.findUnique({ where: { teamId_email: { teamId: id, email: d.removeEmail.toLowerCase() } } });
      if (target?.role === "OWNER") return error("The owner cannot be removed.");
      if (target) await db.teamMember.delete({ where: { id: target.id } });
    }
    if (d.setRole) {
      const target = await db.teamMember.findUnique({ where: { teamId_email: { teamId: id, email: d.setRole.email.toLowerCase() } } });
      if (target && target.role !== "OWNER") await db.teamMember.update({ where: { id: target.id }, data: { role: d.setRole.role } });
    }
    if (d.attachProjectId) {
      const p = await db.project.findFirst({ where: { id: d.attachProjectId, userId: user.id } });
      if (p) await db.project.update({ where: { id: p.id }, data: { teamId: id } });
    }
    if (d.detachProjectId) {
      await db.project.updateMany({ where: { id: d.detachProjectId, teamId: id }, data: { teamId: null } });
    }
    return json({ ok: true });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/teams/[id]">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const team = await db.team.findUnique({ where: { id } });
    if (!team || team.ownerId !== user.id) return error("Only the owner can delete a team.", 403);
    await db.team.delete({ where: { id } });
    return json({ ok: true });
  });
}
