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
  return (await estimateCreditsDetailed(opts)).credits;
}

/** How much hidden "thinking"/reasoning output a model typically adds (billed as output tokens). */
function thinkingTokens(model: string, taskClass: string) {
  const heavy = taskClass === "fullstack" || taskClass === "feature" || taskClass === "page";
  if (/fable|mythos|astra/.test(model)) return heavy ? 12000 : 5000;
  if (/opus|sol/.test(model)) return heavy ? 8000 : 3000;
  if (/sonnet|terra/.test(model)) return heavy ? 3000 : 1000;
  return 0;
}

/** Credits charged per $1 of provider cost for a tier (base × tier margin multiplier). */
export async function creditsPerUsdFor(tier: ModelTier) {
  const s = await getSettings();
  return Math.round((s.creditsPerUsd ?? 150) * (s.floorMultiplier?.[tier] ?? 1));
}

export interface CreditEstimate { credits: number; hold: number; estimatedUsd: number; byClass: number; k: number }

/**
 * Credits to charge (floor = provider cost × per-tier credits-per-dollar) and the larger amount to
 * HOLD while the run is in flight, so a long frontier answer can never leave the account in deficit.
 * The unused part of the hold is released right after the run.
 */
export async function estimateCreditsDetailed(opts: Parameters<typeof estimateCredits>[0]): Promise<CreditEstimate> {
  const s = await getSettings();
  const base = s.creditBase[opts.taskClass];
  const tierMult = s.tierMultiplier[opts.tier];
  const byClass = Math.max(1, Math.round(base * opts.agentMultiplier * tierMult));
  const k = await creditsPerUsdFor(opts.tier);
  if (!opts.model) return { credits: byClass, hold: byClass, estimatedUsd: 0, byClass, k };
  const doc = Math.max(0, opts.docTokens ?? 0);
  const inputTokens = 6000 + doc; // system prompt + design skill + the document itself (system part is cache-priced after the first run)
  const visible = opts.mode === "report" ? 2500 : Math.max(doc, opts.taskClass === "fullstack" || opts.taskClass === "feature" ? 14000 : 10000);
  const outputTokens = visible + thinkingTokens(opts.model, opts.taskClass);
  const usd = estimateUsd(opts.model, { inputTokens, outputTokens });
  const credits = Math.max(byClass, Math.ceil(usd * k));
  const buffer = /fable|mythos|astra/.test(opts.model) ? 1.6 : /opus|sol/.test(opts.model) ? 1.4 : 1.2;
  return { credits, hold: Math.ceil(credits * buffer), estimatedUsd: usd, byClass, k };
}

/**
 * Final charge for a finished run: max(class price, real provider cost × k). The single ledger row
 * created by reserveCredits is updated to the final amount with a human-readable note, and the
 * balance is corrected by the difference (release when under the hold, extra charge when over).
 */
export async function finalizeCredits(opts: { userId: string; ledgerId: string; hold: number; byClassCredits: number; costUsd: number; k: number; purchasedHeld?: number; note: string; meta: Record<string, unknown> }): Promise<number> {
  return settleCredits(opts, Math.max(opts.byClassCredits, Math.ceil(opts.costUsd * opts.k)), "final", opts.meta);
}

/** Settle against the ledger's CURRENT debit, not the original hold. Retrying or
 * failing after finalization can never return the same reserved credits twice. */
async function settleCredits(opts: { userId: string; ledgerId: string; purchasedHeld?: number; note: string }, target: number, status: "final" | "refunded", meta: Record<string, unknown> = {}) {
  if (!Number.isSafeInteger(target) || target < 0) throw new Error("Invalid credit settlement");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${opts.userId} FOR UPDATE`;
    const row = await tx.creditLedger.findFirstOrThrow({ where: { id: opts.ledgerId, userId: opts.userId } });
    const previous = JSON.parse(row.meta ?? "{}") as Record<string, unknown>;
    const spent = Math.max(0, -row.delta);
    if (previous.settlement === "refunded" || (status === "final" && previous.settlement === "final")) return spent;
    const user = await tx.user.findUniqueOrThrow({ where: { id: opts.userId } });
    const due = Math.min(target, spent + Math.max(0, user.credits));
    const diff = spent - due;
    const purchasedUsed = typeof previous.purchasedUsed === "number" ? previous.purchasedUsed : opts.purchasedHeld ?? 0;
    const restored = diff > 0 ? Math.min(purchasedUsed, diff) : 0;
    const credits = user.credits + diff;
    const purchasedCredits = Math.max(0, Math.min(Math.max(0, credits), user.purchasedCredits + restored));
    await tx.user.update({ where: { id: user.id }, data: { credits, purchasedCredits } });
    await tx.creditLedger.update({ where: { id: row.id }, data: { delta: -due, note: opts.note, meta: JSON.stringify({ ...previous, ...meta, finalCredits: due, settlement: status, purchasedUsed: purchasedUsed - restored + Math.max(0, user.purchasedCredits - purchasedCredits) }) } });
    return due;
  });
}

export async function releaseCredits(opts: { userId: string; ledgerId: string; hold: number; keep: number; purchasedHeld?: number; note: string }) {
  return settleCredits(opts, opts.keep, "refunded");
}

/**
 * Atomic conditional decrement: concurrent runs cannot spend the same credits twice.
 * Plan credits are spent first; purchased credits only once the plan allowance is gone.
 * Returns how many purchased credits this reservation consumed (so a refund can restore them).
 */
export async function reserveCredits(userId: string, amount: number, reason: string, projectId?: string, note?: string): Promise<{ purchasedSpent: number; ledgerId: string }> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid credit amount");
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
    const purchasedSpent = Math.max(0, Number(rows[0].purchasedBefore) - Number(rows[0].purchasedAfter));
    // Recorded on the row so a refund after a lost server process still restores purchased credits.
    const row = await tx.creditLedger.create({ data: { userId, delta: -amount, reason, projectId, note, meta: JSON.stringify({ purchasedUsed: purchasedSpent }) } });
    return { purchasedSpent, ledgerId: row.id };
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
  return { plan, rollover, purchased, next: plan.credits + rollover + purchased + Math.min(0, user.credits) };
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

/** Renewal and its audit row share the user lock with spending/top-ups. */
export async function renewCreditsIfDue(userId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const next = new Date(user.creditsResetAt);
    next.setMonth(next.getMonth() + 1);
    if (now < next) return false;
    const r = renewalBalance(user);
    await tx.user.update({ where: { id: userId }, data: { credits: r.next, purchasedCredits: r.purchased, creditsResetAt: now } });
    await tx.creditLedger.create({ data: { userId, delta: r.next - user.credits, reason: `renewal:${r.plan.id}${r.rollover ? `+rollover:${r.rollover}` : ""}` } });
    return true;
  });
}
