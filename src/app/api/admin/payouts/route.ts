import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { describePayout, parsePayoutDetails } from "@/lib/wallet";

function admin<T>(fn: (adminEmail: string) => Promise<T>) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    return fn(user.email);
  });
}

/** Payout requests to approve, sellers with balances, recent sales, affiliate balances. */
export async function GET() {
  return admin(async () => {
    const [requests, sellers, sales, affiliates] = await Promise.all([
      db.payoutRequest.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200, include: { user: { select: { email: true, name: true } } } }),
      db.user.findMany({
        where: { OR: [{ sellerBalanceCents: { gt: 0 } }, { sellerPaidOutCents: { gt: 0 } }] },
        orderBy: { sellerBalanceCents: "desc" },
        select: { id: true, email: true, name: true, sellerBalanceCents: true, sellerPaidOutCents: true, payoutMethod: true, payoutDetails: true, _count: { select: { sales: true } } },
      }),
      db.purchase.findMany({ where: { status: { in: ["PAID", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 100, include: { item: { select: { title: true } }, buyer: { select: { email: true } }, seller: { select: { email: true } } } }),
      db.affiliate.findMany({ include: { commissions: { select: { commissionCents: true, status: true } } } }),
    ]);
    return json({
      requests: requests.map((r) => {
        const d = parsePayoutDetails(r.method, r.details);
        return { id: r.id, seller: r.user.name ?? r.user.email, email: r.user.email, amountCents: r.amountCents, method: r.method, destination: describePayout(d), details: d, status: r.status, note: r.note, createdAt: r.createdAt, resolvedAt: r.resolvedAt };
      }),
      sellers: sellers.map((s) => ({ id: s.id, email: s.email, name: s.name, owedCents: s.sellerBalanceCents, paidCents: s.sellerPaidOutCents, sales: s._count.sales, destination: describePayout(parsePayoutDetails(s.payoutMethod, s.payoutDetails)) })),
      sales: sales.map((p) => ({ id: p.id, item: p.item.title, buyer: p.buyer.email, seller: p.seller.email, priceCents: p.priceCents, sellerCents: p.sellerCents, feeCents: p.feeCents, status: p.status, paidAt: p.paidAt, createdAt: p.createdAt })),
      affiliates: affiliates.map((a) => ({
        id: a.id, name: a.name, code: a.code, contact: a.contact,
        owedCents: a.commissions.filter((c) => c.status === "PENDING").reduce((s, c) => s + c.commissionCents, 0),
        paidCents: a.commissions.filter((c) => c.status === "PAID").reduce((s, c) => s + c.commissionCents, 0),
      })),
    });
  });
}

const schema = z.object({
  requestId: z.string().max(64).optional(),
  action: z.enum(["approve", "reject"]).optional(),
  note: z.string().trim().max(300).optional(),
  affiliateId: z.string().max(64).optional(),
});

/** Approve (money sent) or reject (balance returned) a payout request; or mark affiliate commissions paid. */
export async function PATCH(req: Request) {
  return admin(async (adminEmail) => {
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    const { requestId, action, note, affiliateId } = body.data;

    if (requestId && action) {
      const r = await db.payoutRequest.findUnique({ where: { id: requestId } });
      if (!r) return error("Request not found", 404);
      if (r.status !== "PENDING") return error("This request was already resolved.", 409);
      // Status flip is the guard against double approval.
      const flipped = await db.payoutRequest.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: action === "approve" ? "PAID" : "REJECTED", note: note || null, resolvedAt: new Date() } });
      if (flipped.count !== 1) return error("This request was already resolved.", 409);
      if (action === "approve") {
        await db.user.update({ where: { id: r.userId }, data: { sellerPaidOutCents: { increment: r.amountCents } } });
      } else {
        await db.user.update({ where: { id: r.userId }, data: { sellerBalanceCents: { increment: r.amountCents } } });
      }
      console.info(`[admin] ${adminEmail} ${action}d payout ${r.id} (${r.amountCents}c) for user ${r.userId}`);
      return json({ ok: true, status: action === "approve" ? "PAID" : "REJECTED" });
    }
    if (affiliateId) {
      const res = await db.affiliateCommission.updateMany({ where: { affiliateId, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() } });
      console.info(`[admin] ${adminEmail} marked ${res.count} affiliate commissions paid for ${affiliateId}`);
      return json({ ok: true, count: res.count });
    }
    return error("requestId + action, or affiliateId required");
  });
}
