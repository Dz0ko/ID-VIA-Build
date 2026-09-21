import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { PLANS, isPlanId } from "@/lib/plans";
import { grantCredits } from "@/lib/credits";
import { whopConfigured } from "@/lib/whop";
import { onPaidConversion } from "@/lib/referrals";

/**
 * Development helper: switch the current user's plan without Whop.
 * Only enabled when Whop is NOT configured (local/demo mode) or for admins.
 */
export async function POST(req: Request) {
  return withUser(async (user) => {
    if (whopConfigured() && user.role !== "ADMIN") return error("Plan changes are handled by Whop.", 403);
    const body = z.object({ plan: z.string() }).safeParse(await req.json().catch(() => null));
    if (!body.success || !isPlanId(body.data.plan)) return error("Invalid plan.");
    const plan = body.data.plan;
    await db.user.update({ where: { id: user.id }, data: { plan } });
    const delta = PLANS[plan].credits - PLANS[user.plan].credits;
    if (delta > 0) await grantCredits(user.id, delta, `dev_upgrade:${plan}`);
    if (plan !== "FREE" && plan !== user.plan) await onPaidConversion(user.id, { plan, reason: `dev_upgrade:${plan}` });
    return json({ ok: true, plan });
  });
}
