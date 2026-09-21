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
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.credits < amount) throw new InsufficientCredits(amount, user.credits);
  // Plan credits are spent first; purchased credits only once the plan allowance is gone.
  const remaining = user.credits - amount;
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: remaining, purchasedCredits: Math.min(user.purchasedCredits, remaining) } }),
    db.creditLedger.create({ data: { userId, delta: -amount, reason, projectId } }),
  ]);
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
