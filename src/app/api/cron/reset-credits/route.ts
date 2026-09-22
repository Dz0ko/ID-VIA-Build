import { db } from "@/lib/db";
import { renewCreditsIfDue } from "@/lib/credits";

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
    select: { id: true, plan: true, credits: true, purchasedCredits: true },
    take: 500,
  });

  let renewed = 0;
  for (const u of due) {
    if (await renewCreditsIfDue(u.id, now)) renewed++;
  }
  return Response.json({ ok: true, renewed, checkedAt: now.toISOString() });
}
