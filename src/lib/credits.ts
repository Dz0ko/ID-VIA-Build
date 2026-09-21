import { db } from "./db";
import type { ModelTier } from "./plans";
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
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: { decrement: amount } } }),
    db.creditLedger.create({ data: { userId, delta: -amount, reason, projectId } }),
  ]);
}

export async function refundCredits(userId: string, amount: number, reason: string, projectId?: string) {
  if (amount <= 0) return;
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: { increment: amount } } }),
    db.creditLedger.create({ data: { userId, delta: amount, reason, projectId } }),
  ]);
}

export async function grantCredits(userId: string, amount: number, reason: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: { increment: amount } } }),
    db.creditLedger.create({ data: { userId, delta: amount, reason } }),
  ]);
}
