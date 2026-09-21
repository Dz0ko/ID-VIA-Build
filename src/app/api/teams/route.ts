import { z } from "zod";
import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { error, json, slugify, withUser } from "@/lib/api";
import { planAtLeast } from "@/lib/agents";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 5);

export async function GET() {
  return withUser(async (user) => {
    const memberships = await db.teamMember.findMany({ where: { OR: [{ userId: user.id }, { email: user.email, status: "PENDING" }] }, include: { team: { include: { members: true, _count: { select: { projects: true } } } } } });
    return json({ teams: memberships.map((m) => ({ ...m.team, myRole: m.role, myStatus: m.status, whiteLabel: JSON.parse(m.team.whiteLabel || "{}") })) });
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    if (!planAtLeast(user.plan, "AGENCY")) return error("Teams are available on the Agency plan.", 403, { code: "PLAN", minPlan: "AGENCY" });
    const body = z.object({ name: z.string().min(2).max(60) }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Team name is required.");
    const team = await db.team.create({ data: { name: body.data.name, slug: `${slugify(body.data.name)}-${nanoid()}`, ownerId: user.id } });
    await db.teamMember.create({ data: { teamId: team.id, userId: user.id, email: user.email, role: "OWNER", status: "ACTIVE" } });
    return json({ team });
  });
}
