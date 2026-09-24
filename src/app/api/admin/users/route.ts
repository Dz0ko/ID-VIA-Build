import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { isPlanId } from "@/lib/plans";
import { grantCredits } from "@/lib/credits";

export async function GET() {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, email: true, name: true, plan: true, credits: true, role: true, createdAt: true, whopUserId: true, googleId: true, githubId: true, sellerBalanceCents: true, _count: { select: { projects: true, referrals: true } } },
    });
    return json({ users });
  });
}

export async function PATCH(req: Request) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const body = z.object({ id: z.string().max(64), plan: z.string().optional(), addCredits: z.number().int().min(1).max(1_000_000).optional(), role: z.enum(["USER", "SUPPORTER", "ADMIN"]).optional() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    if (body.data.role && body.data.id === user.id) return error("You cannot change your own role.", 400);
    const data: Record<string, unknown> = {};
    if (body.data.plan && isPlanId(body.data.plan)) data.plan = body.data.plan;
    if (body.data.role) data.role = body.data.role;
    if (Object.keys(data).length || body.data.addCredits) {
      console.info(`[admin] ${user.email} updated user ${body.data.id}: ${JSON.stringify({ ...data, addCredits: body.data.addCredits })}`);
    }
    if (Object.keys(data).length) await db.user.update({ where: { id: body.data.id }, data });
    if (body.data.addCredits) await grantCredits(body.data.id, body.data.addCredits, "admin_grant", { purchased: true });
    return json({ ok: true });
  });
}
