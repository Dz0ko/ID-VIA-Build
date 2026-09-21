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
    const body = z.object({ id: z.string(), plan: z.string().optional(), addCredits: z.number().int().optional(), role: z.enum(["USER", "ADMIN"]).optional() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    const data: Record<string, unknown> = {};
    if (body.data.plan && isPlanId(body.data.plan)) data.plan = body.data.plan;
    if (body.data.role) data.role = body.data.role;
    if (Object.keys(data).length) await db.user.update({ where: { id: body.data.id }, data });
    if (body.data.addCredits) await grantCredits(body.data.id, body.data.addCredits, "admin_grant");
    return json({ ok: true });
  });
}
