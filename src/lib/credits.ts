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

export async function reserveCredits(userId: string, amount: number, reason: string, projectId?: string) {
  // Atomic conditional decrement: concurrent runs cannot spend the same credits twice.
  // Plan credits are spent first; purchased credits only once the plan allowance is gone.
  const rows = await db.$queryRaw<{ credits: number }[]>`
    UPDATE "User"
    SET "credits" = "credits" - ${amount},
        "purchasedCredits" = LEAST("purchasedCredits", "credits" - ${amount})
    WHERE "id" = ${userId} AND "credits" >= ${amount}
    RETURNING "credits"`;
  if (rows.length === 0) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } });
    throw new InsufficientCredits(amount, user?.credits ?? 0);
  }
  await db.creditLedger.create({ data: { userId, delta: -amount, reason, projectId } });
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

export async function refundCredits(userId: string, amount: number, reason: string, projectId?: string) {
  if (amount <= 0) return;
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: { increment: amount } } }),
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
