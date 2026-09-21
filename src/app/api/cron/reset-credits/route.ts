import { db } from "@/lib/db";
import { PLANS, isPlanId } from "@/lib/plans";

/**
 * Monthly credit renewal. Runs daily (Vercel Cron, see vercel.json) and renews
 * every user whose billing month has elapsed:
 *   new balance = plan allowance + rollover (rolloverPct of unused, capped at one allowance).
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 1);

  const due = await db.user.findMany({
    where: { creditsResetAt: { lte: cutoff } },
    select: { id: true, plan: true, credits: true },
    take: 500,
  });

  let renewed = 0;
  for (const u of due) {
    const plan = PLANS[isPlanId(u.plan) ? u.plan : "FREE"];
    const rollover = Math.min(plan.credits, Math.floor((Math.max(0, u.credits) * plan.rolloverPct) / 100));
    const next = plan.credits + rollover;
    await db.$transaction([
      db.user.update({ where: { id: u.id }, data: { credits: next, creditsResetAt: now } }),
      db.creditLedger.create({ data: { userId: u.id, delta: next - u.credits, reason: `renewal:${plan.id}${rollover ? `+rollover:${rollover}` : ""}` } }),
    ]);
    renewed++;
  }
  return Response.json({ ok: true, renewed, checkedAt: now.toISOString() });
}
