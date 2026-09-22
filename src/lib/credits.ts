import { db } from "./db";
import { PLANS, isPlanId, type ModelTier } from "./plans";
import { getSettings } from "./settings";
import { estimateUsd } from "./ai/cost";

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
  /** Concrete model that will run (for the cost floor). */
  model?: string;
  /** Size of the current document/files in tokens (≈ chars / 4). Rewrites re-emit it all. */
  docTokens?: number;
  mode?: "rewrite" | "report";
}) {
  const s = await getSettings();
  const base = s.creditBase[opts.taskClass];
  const tierMult = s.tierMultiplier[opts.tier];
  const byClass = Math.max(1, Math.round(base * opts.agentMultiplier * tierMult));
  if (!opts.model) return byClass;
  // Cost floor: what this run will most likely cost at the provider, converted to credits.
  const doc = Math.max(0, opts.docTokens ?? 0);
  const inputTokens = 6000 + doc; // system prompt + design skill + the document itself
  const outputTokens = opts.mode === "report" ? 2500 : Math.max(doc, opts.taskClass === "fullstack" || opts.taskClass === "feature" ? 14000 : 10000);
  const usd = estimateUsd(opts.model, { inputTokens, outputTokens });
  const floor = Math.ceil(usd * (s.creditsPerUsd ?? 150));
  return Math.max(byClass, floor);
}

/**
 * After a run: if the real provider cost, converted to credits, exceeds what was charged,
 * charge the difference (never below a zero balance). Guarantees no run is sold at a loss.
 * Returns the extra credits charged.
 */
export async function settleCredits(userId: string, charged: number, costUsd: number, reason: string, projectId?: string): Promise<number> {
  const s = await getSettings();
  const due = Math.ceil(costUsd * (s.creditsPerUsd ?? 150));
  const extra = due - charged;
  if (extra <= 0) return 0;
  const rows = await db.$queryRaw<{ taken: number }[]>`
    UPDATE "User" SET "credits" = GREATEST(0, "credits" - ${extra}),
      "purchasedCredits" = LEAST("purchasedCredits", GREATEST(0, "credits" - ${extra}))
    WHERE "id" = ${userId}
    RETURNING LEAST(${extra}, (SELECT "credits" FROM "User" u2 WHERE u2."id" = ${userId})) AS taken`;
  const taken = Number(rows[0]?.taken ?? 0);
  if (taken > 0) await db.creditLedger.create({ data: { userId, delta: -taken, reason: `${reason}:usage`, projectId } });
  return taken;
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
