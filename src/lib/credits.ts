import { db } from "./db";
import { PLANS, isPlanId, type ModelTier } from "./plans";
import { getSettings } from "./settings";

export class InsufficientCredits extends Error {
  constructor(public needed: number, public have: number) {
    super(`Insufficient credits: need ${needed}, have ${have}`);
  }
}

/**
 * Estimate the credit cost of a task before running it.
 * Base cost by task class × agent multiplier × tier multiplier (admin-configurable).
 */
export async function estimateCredits(opts: {
  taskClass: "tiny" | "small" | "section" | "page" | "feature" | "fullstack";
  agentMultiplier: number;
  tier: ModelTier;
}) {
  const s = await getSettings();
  const base = s.creditBase[opts.taskClass];
  const tierMult = s.tierMultiplier[opts.tier];
  return Math.max(1, Math.round(base * opts.agentMultiplier * tierMult));
}

/**
 * Atomic conditional decrement: concurrent runs cannot spend the same credits twice.
 * Plan credits are spent first; purchased credits only once the plan allowance is gone.
 * Returns how many purchased credits this reservation consumed (so a refund can restore them).
 */
export async function reserveCredits(userId: string, amount: number, reason: string, projectId?: string): Promise<{ purchasedSpent: number }> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ credits: number; purchasedBefore: number; purchasedAfter: number }[]>`
      UPDATE "User" u
      SET "credits" = u."credits" - ${amount},
          "purchasedCredits" = LEAST(u."purchasedCredits", u."credits" - ${amount})
      FROM (SELECT "id", "purchasedCredits" AS before FROM "User" WHERE "id" = ${userId} FOR UPDATE) prev
      WHERE u."id" = prev."id" AND u."credits" >= ${amount}
      RETURNING u."credits", prev.before AS "purchasedBefore", u."purchasedCredits" AS "purchasedAfter"`;
    if (rows.length === 0) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
      throw new InsufficientCredits(amount, user?.credits ?? 0);
    }
    await tx.creditLedger.create({ data: { userId, delta: -amount, reason, projectId } });
    return { purchasedSpent: Math.max(0, Number(rows[0].purchasedBefore) - Number(rows[0].purchasedAfter)) };
  });
}

/**
 * Balance after a monthly renewal: plan allowance + rollover of unused plan credits
 * (rolloverPct, capped at one allowance) + all purchased credits, which never expire.
 */
export function renewalBalance(user: { plan: string; credits: number; purchasedCredits: number }) {
  const plan = PLANS[isPlanId(user.plan) ? user.plan : "FREE"];
  const purchased = Math.max(0, Math.min(user.purchasedCredits, user.credits));
  const unusedPlan = Math.max(0, user.credits - purchased);
  const rollover = Math.min(plan.credits, Math.floor((unusedPlan * plan.rolloverPct) / 100));
  return { plan, rollover, purchased, next: plan.credits + rollover + purchased };
}

export async function refundCredits(userId: string, amount: number, reason: string, projectId?: string, opts: { purchased?: number } = {}) {
  if (amount <= 0) return;
  const purchased = Math.max(0, Math.min(amount, opts.purchased ?? 0));
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: { increment: amount }, ...(purchased ? { purchasedCredits: { increment: purchased } } : {}) } }),
    db.creditLedger.create({ data: { userId, delta: amount, reason, projectId } }),
  ]);
}

export async function grantCredits(userId: string, amount: number, reason: string, opts: { purchased?: boolean } = {}) {
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { increment: amount }, ...(opts.purchased ? { purchasedCredits: { increment: amount } } : {}) },
    }),
    db.creditLedger.create({ data: { userId, delta: amount, reason } }),
  ]);
}
