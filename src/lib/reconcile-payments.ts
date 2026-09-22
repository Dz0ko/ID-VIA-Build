import { db } from "./db";
import { objectId, paymentOwner } from "./billing-ledger";
import { paymentAmounts, retainedRatio, usdCents } from "./payment-math";
import { retrieveWhopPayment } from "./whop";

/** Import legacy accounting only. Never re-grant credits, commissions or wallet balances. */
export async function reconcileLegacyPayments() {
  const events = await db.webhookEvent.findMany({ where: { type: "payment.succeeded", NOT: { payload: { contains: '"processed":true' } } }, orderBy: { createdAt: "asc" }, take: 10 });
  let imported = 0;
  const unresolved: string[] = [];
  for (const event of events) {
    try {
      const payload = JSON.parse(event.payload);
      const id = objectId(payload.data?.id);
      if (!id) throw new Error("Legacy payment ID missing");
      const data = await retrieveWhopPayment(id);
      const { grossCents, feeCents } = paymentAmounts(data);
      if (data.status !== "paid" && data.status !== "succeeded") throw new Error("Legacy payment is not paid");
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`whop:${id}`}))`;
        if (!await tx.payment.findUnique({ where: { id } })) {
          const owner = await paymentOwner(tx, data);
          if (!owner) throw new Error("Legacy payment has no checkout or membership");
          const purchase = owner.purchaseId ? await tx.purchase.findUnique({ where: { id: owner.purchaseId } }) : null;
          const commissions = await tx.affiliateCommission.findMany({ where: { reason: { in: [`payment:${id}`, `adjustment:${id}`] } } });
          const refundedCents = Math.min(grossCents, Math.max(0, (usdCents(data.refunded_amount) ?? 0) - (usdCents(data.tax_refunded_amount) ?? 0)));
          const disputes = Array.isArray(data.disputes) ? data.disputes as { status?: string; amount?: unknown }[] : [];
          const disputedCents = Math.min(grossCents, disputes.filter((d) => !["won", "warning_closed", "closed"].includes(d.status ?? "")).reduce((s, d) => s + (usdCents(d.amount) ?? grossCents), 0));
          const ratio = retainedRatio(grossCents, refundedCents, disputedCents);
          const parsedDate = new Date(String(data.paid_at ?? data.created_at));
          await tx.payment.create({ data: { id, userId: owner.userId, kind: owner.kind, plan: owner.plan, membershipId: objectId(data.membership ?? data.membership_id), purchaseId: owner.purchaseId, creditsGranted: owner.kind === "pack" ? owner.credits ?? 0 : 0, grossCents, feeCents, refundedCents, disputedCents, sellerCents: purchase ? Math.round(purchase.sellerCents * ratio) : 0, affiliateCommissionCents: commissions.reduce((s, c) => s + c.commissionCents, 0), paidAt: Number.isNaN(parsedDate.getTime()) ? event.createdAt : parsedDate } });
        }
        await tx.webhookEvent.update({ where: { id: event.id }, data: { payload: JSON.stringify({ resourceId: id, processed: true, reconciled: true }) } });
      });
      imported++;
    } catch { unresolved.push(event.id); }
  }
  return { imported, unresolved, remaining: await db.webhookEvent.count({ where: { type: "payment.succeeded", NOT: { payload: { contains: '"processed":true' } } } }) };
}
