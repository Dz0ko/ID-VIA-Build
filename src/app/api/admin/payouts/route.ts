import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

function admin<T>(fn: () => Promise<T>) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    return fn();
  });
}

/** Sellers with money owed or paid, plus affiliate balances. */
export async function GET() {
  return admin(async () => {
    const [sellers, affiliates] = await Promise.all([
      db.user.findMany({
        where: { OR: [{ sellerBalanceCents: { gt: 0 } }, { sellerPaidOutCents: { gt: 0 } }] },
        orderBy: { sellerBalanceCents: "desc" },
        select: { id: true, email: true, name: true, sellerBalanceCents: true, sellerPaidOutCents: true, _count: { select: { sales: true } } },
      }),
      db.affiliate.findMany({ include: { commissions: { select: { commissionCents: true, status: true } } } }),
    ]);
    return json({
      sellers: sellers.map((s) => ({ id: s.id, email: s.email, name: s.name, owedCents: s.sellerBalanceCents, paidCents: s.sellerPaidOutCents, sales: s._count.sales })),
      affiliates: affiliates.map((a) => ({
        id: a.id, name: a.name, code: a.code, contact: a.contact,
        owedCents: a.commissions.filter((c) => c.status === "PENDING").reduce((s, c) => s + c.commissionCents, 0),
        paidCents: a.commissions.filter((c) => c.status === "PAID").reduce((s, c) => s + c.commissionCents, 0),
      })),
    });
  });
}

/** Record a payout: seller balance → paid out, or all pending affiliate commissions → paid. */
export async function PATCH(req: Request) {
  return admin(async () => {
    const body = z.object({ sellerId: z.string().optional(), affiliateId: z.string().optional() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    if (body.data.sellerId) {
      const u = await db.user.findUnique({ where: { id: body.data.sellerId }, select: { sellerBalanceCents: true } });
      if (!u) return error("Seller not found", 404);
      await db.user.update({ where: { id: body.data.sellerId }, data: { sellerBalanceCents: 0, sellerPaidOutCents: { increment: u.sellerBalanceCents } } });
      return json({ ok: true, paidCents: u.sellerBalanceCents });
    }
    if (body.data.affiliateId) {
      const r = await db.affiliateCommission.updateMany({ where: { affiliateId: body.data.affiliateId, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() } });
      return json({ ok: true, count: r.count });
    }
    return error("sellerId or affiliateId required");
  });
}
