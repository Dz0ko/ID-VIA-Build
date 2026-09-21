import { db } from "@/lib/db";
import { CREDIT_PACKS, PLANS, isPlanId } from "@/lib/plans";
import { extractWhop, findCheckout, verifyWhopSignature, whopPlanMap, type WhopWebhookEvent } from "@/lib/whop";
import { grantCredits } from "@/lib/credits";
import { markPurchasePaid, reversePurchase } from "@/lib/marketplace";
import { onPaidConversion } from "@/lib/referrals";

/**
 * Whop webhook receiver.
 * Events handled: membership.activated / membership.went_valid → upgrade plan
 *                 membership.deactivated / membership.went_invalid → downgrade to FREE
 *                 payment.succeeded → (credit top-up packs via metadata.credits)
 */
const HANDLED = new Set([
  "membership.activated", "membership.went_valid", "membership.created",
  "membership.deactivated", "membership.went_invalid", "membership.canceled", "membership.expired",
  "payment.succeeded",
  "refund.created", "refund.succeeded", "refund.updated", "dispute.created", "dispute.updated", "payment.refunded", "payment.disputed",
]);

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.WHOP_WEBHOOK_SECRET ?? "";
  const id = req.headers.get("webhook-id");
  const ok = verifyWhopSignature({
    id,
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
    rawBody: raw,
    secret,
  });
  if (!ok) return new Response("invalid signature", { status: 401 });

  let event: WhopWebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Only the events we act on; anything else (ads, cards, disputes, …) is acknowledged and ignored.
  if (!HANDLED.has(event.type)) return Response.json({ ok: true, ignored: event.type });

  // Idempotency
  const eventId = id ?? event.id ?? `${event.type}:${Date.now()}`;
  const seen = await db.webhookEvent.findUnique({ where: { id: eventId } });
  if (seen) return Response.json({ ok: true, duplicate: true });
  await db.webhookEvent.create({ data: { id: eventId, type: event.type, payload: raw } });

  const d = (event.data ?? {}) as Record<string, unknown>;
  const meta = (d.metadata ?? {}) as Record<string, unknown>;
  // The checkout we created for this purchase (plans, packs, marketplace) — the most reliable link to our user.
  const checkoutId = typeof d.checkout_configuration_id === "string" ? d.checkout_configuration_id
    : typeof d.checkout_id === "string" ? d.checkout_id : null;
  const checkout = await findCheckout(checkoutId);

  const paidUsd = Number(d.total ?? d.subtotal ?? d.final_amount ?? d.amount_after_fees ?? d.amount ?? 0);
  const paidCents = Number.isFinite(paidUsd) && paidUsd > 0 ? Math.round(paidUsd * 100) : null;

  // Refunds / chargebacks: reverse marketplace orders so sellers are not paid for returned money.
  if (/^(refund\.(created|succeeded|updated)|dispute\.(created|updated)|payment\.(refunded|disputed))$/.test(event.type)) {
    const pid = (typeof d.payment_id === "string" ? d.payment_id : typeof (d.payment as { id?: string })?.id === "string" ? (d.payment as { id: string }).id : typeof d.id === "string" ? d.id : null);
    const reversed = pid ? await reversePurchase(pid, event.type) : null;
    return Response.json({ ok: true, reversed: reversed?.id ?? null });
  }

  // Marketplace orders: settle them before any user matching (the paid amount must cover the price).
  if (event.type === "payment.succeeded") {
    const purchaseId = typeof meta.purchase_id === "string" ? meta.purchase_id : checkout?.purchaseId ?? null;
    if (purchaseId) {
      const paid = await markPurchasePaid(purchaseId, d.id as string | undefined ?? null, paidCents);
      return Response.json({ ok: true, purchase: paid?.id ?? null });
    }
  }

  const { membershipId, planId, userId: whopUserId, email, status, valid } = extractWhop(event);
  // Plan: from our checkout record, then checkout metadata, then the static plan-id map (checkout links).
  const map = whopPlanMap();
  const metaPlan = typeof meta.idaevia_plan === "string" && isPlanId(meta.idaevia_plan) ? meta.idaevia_plan : undefined;
  const recordPlan = checkout?.plan && isPlanId(checkout.plan) ? checkout.plan : undefined;
  const mapped = recordPlan ?? metaPlan ?? (planId ? map[planId] : undefined);

  // Find our user: by our checkout record, then our id from metadata, then Whop id, then email.
  let user = checkout ? await db.user.findUnique({ where: { id: checkout.userId } }) : null;
  if (!user && typeof meta.idaevia_user_id === "string") user = await db.user.findUnique({ where: { id: meta.idaevia_user_id } });
  if (!user && whopUserId) user = await db.user.findUnique({ where: { whopUserId } });
  if (!user && email) user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  // Never create accounts from webhook data: every purchase starts from a signed-in user's checkout.
  if (!user) {
    console.warn(`[whop] ${event.type} could not be matched to a user (checkout=${checkoutId ?? "-"}, membership=${membershipId ?? "-"})`);
    return Response.json({ ok: true, ignored: "no user match" });
  }
  if (whopUserId && !user.whopUserId) {
    user = await db.user.update({ where: { id: user.id }, data: { whopUserId } });
  }

  const type = event.type;
  const activated = /membership\.(activated|went_valid|created)/.test(type) || (type.startsWith("membership.") && valid === true && status !== "canceled");
  const deactivated = /membership\.(deactivated|went_invalid|canceled|expired)/.test(type) || (type.startsWith("membership.") && valid === false);

  if (activated && membershipId) {
    // Only memberships we can map to one of our plans grant anything; unknown Whop products are ignored.
    if (!mapped || !isPlanId(mapped) || mapped === "FREE") {
      console.warn(`[whop] membership ${membershipId} activated with unknown plan (${planId ?? "-"}); ignored`);
      return Response.json({ ok: true, ignored: "unknown plan" });
    }
    const plan = mapped;
    await db.membership.upsert({
      where: { whopMembershipId: membershipId },
      create: { userId: user.id, whopMembershipId: membershipId, whopPlanId: planId ?? "", plan, status: "active", raw },
      update: { plan, status: "active", raw, whopPlanId: planId ?? "" },
    });
    if (user.plan !== plan) {
      await db.user.update({ where: { id: user.id }, data: { plan } });
      const delta = Math.max(0, PLANS[plan].credits - PLANS[isPlanId(user.plan) ? user.plan : "FREE"].credits);
      if (delta > 0) await grantCredits(user.id, delta, `upgrade:${plan}`);
    }
  } else if (deactivated && membershipId) {
    await db.membership.updateMany({ where: { whopMembershipId: membershipId }, data: { status: "inactive", raw } });
    const stillActive = await db.membership.findFirst({ where: { userId: user.id, status: "active" }, orderBy: { updatedAt: "desc" } });
    await db.user.update({ where: { id: user.id }, data: { plan: stillActive?.plan ?? "FREE" } });
  } else if (type === "payment.succeeded") {
    const credits = Number(checkout?.credits ?? meta.credits ?? 0);
    const pack = CREDIT_PACKS.find((c) => c.credits === credits);
    if (credits > 0 && !pack) return Response.json({ ok: true, ignored: "unknown pack" });
    if (pack && paidCents && paidCents + 1 < pack.price * 100) {
      console.warn(`[whop] pack payment ${d.id} was ${paidCents}c, expected ${pack.price * 100}c; not granting`);
      return Response.json({ ok: true, ignored: "underpaid" });
    }
    if (pack) await grantCredits(user.id, pack.credits, "credit_pack", { purchased: true });
    // Plan payments (subscriptions, renewals) earn affiliate commission and the referral paid bonus.
    if (credits === 0 && paidCents) await onPaidConversion(user.id, { amountCents: paidCents, reason: `payment:${d.id ?? eventId}` });
  }

  return Response.json({ ok: true });
}
