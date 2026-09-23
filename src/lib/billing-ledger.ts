import { enqueueEmail, appUrl } from "./email";
import type { Prisma } from "@prisma/client";
import { CREDIT_PACKS, PLANS, isPlanId } from "./plans";
import { commissionFor, paymentAmounts, retainedRatio, usdCents } from "./payment-math";

type Tx = Prisma.TransactionClient;
export const objectId = (v: unknown): string | null => typeof v === "string" ? v : v && typeof v === "object" && "id" in v && typeof v.id === "string" ? v.id : null;

async function grant(tx: Tx, userId: string, amount: number, reason: string, purchased = false) {
  if (amount <= 0) return;
  await tx.user.update({ where: { id: userId }, data: { credits: { increment: amount }, ...(purchased ? { purchasedCredits: { increment: amount } } : {}) } });
  await tx.creditLedger.create({ data: { userId, delta: amount, reason } });
}

/** Only server-created checkouts / previously linked memberships establish ownership. */
export async function paymentOwner(tx: Tx, d: Record<string, unknown>) {
  const checkoutId = objectId(d.checkout_configuration_id ?? d.checkout_id);
  const checkout = checkoutId ? await tx.whopCheckout.findUnique({ where: { id: checkoutId } }) : null;
  if (checkout) return checkout;
  const membershipId = objectId(d.membership ?? d.membership_id);
  const membership = membershipId ? await tx.membership.findUnique({ where: { whopMembershipId: membershipId } }) : null;
  return membership ? { userId: membership.userId, kind: "plan", plan: membership.plan, credits: null, purchaseId: null } : null;
}

/** Caller owns the transaction and webhook idempotency record. */
export async function settlePayment(tx: Tx, d: Record<string, unknown>, paidBonus: number) {
  const id = objectId(d.id);
  if (!id) throw new Error("Payment ID missing");
  if (await tx.payment.findUnique({ where: { id } })) return { duplicate: true };
  if (d.status && !["paid", "succeeded"].includes(String(d.status))) throw new Error("Payment not paid");
  const owner = await paymentOwner(tx, d);
  if (!owner) throw new Error("Payment has no server-owned checkout or membership");
  // Serialise all balance changes and subscription events for this buyer.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${owner.userId} FOR UPDATE`;
  if (await tx.payment.findUnique({ where: { id } })) return { duplicate: true };
  const user = await tx.user.findUniqueOrThrow({ where: { id: owner.userId } });
  const { grossCents, feeCents } = paymentAmounts(d);
  const plan = owner.plan && isPlanId(owner.plan) ? owner.plan : null;
  const pack = owner.kind === "pack" ? CREDIT_PACKS.find((p) => p.credits === owner.credits) : null;
  const purchase = owner.purchaseId ? await tx.purchase.findUnique({ where: { id: owner.purchaseId } }) : null;
  const expected = owner.kind === "plan" && plan && plan !== "FREE" ? PLANS[plan].price * 100
    : pack ? pack.price * 100 : purchase?.priceCents;
  if (!expected || grossCents < expected) throw new Error("Payment does not cover the purchased product");
  if (owner.kind === "market" && (!purchase || purchase.buyerId !== user.id || purchase.status !== "PENDING")) throw new Error("Invalid marketplace purchase");
  const parsedDate = new Date(String(d.paid_at ?? d.created_at ?? new Date().toISOString()));
  const paidAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const membershipId = objectId(d.membership ?? d.membership_id);
  const providerDate = new Date(String(d.updated_at ?? ""));
  const providerUpdatedAt = Number.isNaN(providerDate.getTime()) ? null : providerDate;
  await tx.payment.create({ data: { id, userId: user.id, kind: owner.kind, plan, membershipId, purchaseId: owner.purchaseId, grossCents, feeCents, paidAt, providerUpdatedAt, creditsGranted: pack?.credits ?? 0, sellerCents: purchase?.sellerCents ?? 0 } });

  if (pack) await grant(tx, user.id, pack.credits, "credit_pack", true);
  if (purchase) {
    await tx.purchase.update({ where: { id: purchase.id }, data: { status: "PAID", paidAt, whopPaymentId: id } });
    await tx.marketItem.update({ where: { id: purchase.itemId }, data: { sales: { increment: 1 }, installs: { increment: 1 } } });
    await tx.user.update({ where: { id: purchase.sellerId }, data: { sellerBalanceCents: { increment: purchase.sellerCents } } });
  }
  if (owner.kind === "plan" && plan && plan !== "FREE") {
    if (membershipId) await tx.membership.upsert({ where: { whopMembershipId: membershipId }, create: { userId: user.id, whopMembershipId: membershipId, whopPlanId: objectId(d.plan ?? d.plan_id) ?? "", plan, status: "active" }, update: { status: "active", plan } });
    if (user.plan !== plan) {
      await tx.user.update({ where: { id: user.id }, data: { plan } });
      const creditsGranted = Math.max(0, PLANS[plan].credits - PLANS[isPlanId(user.plan) ? user.plan : "FREE"].credits);
      await grant(tx, user.id, creditsGranted, `upgrade:${plan}`);
      await tx.payment.update({ where: { id }, data: { creditsGranted } });
    }
    // Friend attribution wins, so a later partner login cannot stack commissions.
    if (user.referredById && user.referredById !== user.id) {
      const commissionCents = commissionFor(grossCents);
      await tx.referralCommission.create({ data: { paymentId: id, referrerId: user.referredById, buyerId: user.id, amountCents: grossCents, commissionCents } });
      await tx.user.update({ where: { id: user.referredById }, data: { sellerBalanceCents: { increment: commissionCents } } });
      await tx.payment.update({ where: { id }, data: { referralCommissionCents: commissionCents } });
      if (!user.referralPaidRewarded) {
        await tx.user.update({ where: { id: user.id }, data: { referralPaidRewarded: true } });
        await grant(tx, user.referredById, paidBonus, "referral_paid", true);
        await tx.payment.update({ where: { id }, data: { referralBonusCredits: paidBonus } });
      }
    } else if (user.affiliateId) {
      const affiliate = await tx.affiliate.findUnique({ where: { id: user.affiliateId } });
      if (affiliate?.active) {
        const commissionCents = commissionFor(grossCents, affiliate.commissionPct);
        await tx.affiliateCommission.create({ data: { affiliateId: affiliate.id, userId: user.id, amountCents: grossCents, commissionCents, pct: affiliate.commissionPct, reason: `payment:${id}` } });
        await tx.payment.update({ where: { id }, data: { affiliateCommissionCents: commissionCents } });
      }
    }
  }
  await enqueueEmail(tx, { eventKey: `payment:${id}`, userId: user.id, kind: owner.kind === "plan" ? "plan" : "purchase", subject: owner.kind === "plan" && plan ? `Your IDÆVIA ${PLANS[plan].name} plan payment is confirmed` : "Your IDÆVIA purchase is confirmed", body: `We received your payment of $${(grossCents / 100).toFixed(2)} USD${plan ? ` for the ${PLANS[plan].name} plan` : pack ? ` for ${pack.credits.toLocaleString()} credits` : " for your marketplace purchase"}.\n\nPayment reference: ${id}\n\nYou can review your plan, credits and purchases in your account. Keep your payment provider's receipt for tax and payment details.`, ctaLabel: "Open your account", ctaUrl: appUrl("/app/profile?section=plan") });
  return { payment: id };
}

/** Cancel any unsent payout before reclaiming earnings. Negative balances offset future earnings. */
async function reclaimWallet(tx: Tx, userId: string, amount: number) {
  if (!amount) return;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const pending = await tx.payoutRequest.findMany({ where: { userId, status: "PENDING" } });
  let returned = 0;
  for (const p of pending) {
    const changed = await tx.payoutRequest.updateMany({ where: { id: p.id, status: "PENDING" }, data: { status: "REJECTED", note: "Balance adjusted after a refund or dispute. Please request again.", resolvedAt: new Date() } });
    if (changed.count) returned += p.amountCents;
  }
  await tx.user.update({ where: { id: userId }, data: { sellerBalanceCents: { increment: returned - amount } } });
}

/** Uses the current payment from Whop, not a single refund event's delta. Safe out of order. */
export async function adjustPayment(tx: Tx, d: Record<string, unknown>) {
  const id = objectId(d.id);
  if (!id) throw new Error("Payment ID missing");
  await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id} FOR UPDATE`;
  const p = await tx.payment.findUnique({ where: { id } });
  if (!p) throw new Error("Payment must be reconciled before its refund");
  const providerDate = new Date(String(d.updated_at ?? ""));
  const providerUpdatedAt = Number.isNaN(providerDate.getTime()) ? null : providerDate;
  if (providerUpdatedAt && p.providerUpdatedAt && providerUpdatedAt < p.providerUpdatedAt) return { stale: true };
  const taxRefund = usdCents(d.tax_refunded_amount) ?? 0;
  const refundedCents = Math.min(p.grossCents, Math.max(0, (usdCents(d.refunded_amount) ?? 0) - taxRefund));
  const disputes = Array.isArray(d.disputes) ? d.disputes as { status?: string; amount?: unknown }[] : [];
  const disputedCents = Math.min(p.grossCents, disputes.filter((x) => !["won", "warning_closed", "closed"].includes(x.status ?? "")).reduce((n, x) => n + (usdCents(x.amount) ?? p.grossCents), 0));
  const before = retainedRatio(p.grossCents, p.refundedCents, p.disputedCents);
  const after = retainedRatio(p.grossCents, refundedCents, disputedCents);
  const referral = await tx.referralCommission.findUnique({ where: { paymentId: id } });
  let referralCommissionCents = p.referralCommissionCents;
  if (referral) {
    referralCommissionCents = Math.round(referral.commissionCents * after);
    await reclaimWallet(tx, referral.referrerId, p.referralCommissionCents - referralCommissionCents);
    const bonusDelta = Math.round(p.referralBonusCredits * after) - Math.round(p.referralBonusCredits * before);
    if (bonusDelta) {
      await tx.$executeRaw`UPDATE "User" SET "credits" = "credits" + ${bonusDelta}, "purchasedCredits" = GREATEST(0, LEAST("purchasedCredits" + ${bonusDelta}, "credits" + ${bonusDelta})) WHERE "id" = ${referral.referrerId}`;
      await tx.creditLedger.create({ data: { userId: referral.referrerId, delta: bonusDelta, reason: "referral_adjustment", note: "Paid referral bonus adjusted after refund / dispute" } });
    }
    await tx.referralCommission.update({ where: { paymentId: id }, data: { reversedCents: referral.commissionCents - referralCommissionCents } });
  }
  const affiliateRows = await tx.affiliateCommission.findMany({ where: { reason: { in: [`payment:${id}`, `adjustment:${id}`] } } });
  let affiliateCommissionCents = p.affiliateCommissionCents;
  const original = affiliateRows.find((c) => c.reason === `payment:${id}`);
  if (original) {
    affiliateCommissionCents = Math.round(commissionFor(p.grossCents, original.pct) * after);
    const delta = affiliateCommissionCents - p.affiliateCommissionCents;
    if (delta) await tx.affiliateCommission.create({ data: { affiliateId: original.affiliateId, userId: original.userId, amountCents: 0, commissionCents: delta, pct: original.pct, reason: `adjustment:${id}` } });
  }
  let sellerCents = p.sellerCents;
  if (p.purchaseId) {
    const purchase = await tx.purchase.findUniqueOrThrow({ where: { id: p.purchaseId } });
    sellerCents = Math.round(purchase.sellerCents * after);
    await reclaimWallet(tx, purchase.sellerId, p.sellerCents - sellerCents);
    if (after === 0 && purchase.status === "PAID") {
      await tx.purchase.update({ where: { id: purchase.id }, data: { status: "REFUNDED" } });
      await tx.marketItem.update({ where: { id: purchase.itemId }, data: { sales: { decrement: 1 } } });
    } else if (after > 0 && purchase.status === "REFUNDED") {
      await tx.purchase.update({ where: { id: purchase.id }, data: { status: "PAID" } });
      await tx.marketItem.update({ where: { id: purchase.itemId }, data: { sales: { increment: 1 } } });
    }
  }
  if (p.creditsGranted > 0 && after !== before) {
    const delta = Math.round(p.creditsGranted * after) - Math.round(p.creditsGranted * before);
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${p.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: p.userId } });
    if (user) {
      // Retain debt if already spent: later top-ups cannot bypass a refunded balance.
      const next = user.credits + delta;
      const purchasedCredits = Math.max(0, Math.min(Math.max(0, next), user.purchasedCredits + (p.kind === "pack" ? delta : 0)));
      await tx.user.update({ where: { id: p.userId }, data: { credits: next, purchasedCredits } });
      await tx.creditLedger.create({ data: { userId: p.userId, delta, reason: p.kind === "pack" ? "refund_pack" : "refund_plan", note: `Payment ${id}: refund / dispute adjustment` } });
    }
  }
  if (p.kind === "plan" && after === 0 && p.membershipId) {
    await tx.membership.updateMany({ where: { whopMembershipId: p.membershipId }, data: { status: "inactive" } });
    const active = await tx.membership.findFirst({ where: { userId: p.userId, status: "active" }, orderBy: { updatedAt: "desc" } });
    await tx.user.updateMany({ where: { id: p.userId }, data: { plan: active?.plan ?? "FREE" } });
  }
  const reportedFees = Array.isArray(d.fees) ? paymentAmounts(d).feeCents : null;
  await tx.payment.update({ where: { id }, data: { ...(reportedFees !== null ? { feeCents: reportedFees } : {}), refundedCents, disputedCents, sellerCents, referralCommissionCents, affiliateCommissionCents, ...(providerUpdatedAt ? { providerUpdatedAt } : {}) } });
  return { adjusted: id };
}
