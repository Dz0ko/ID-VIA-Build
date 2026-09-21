import { db } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { MARKETPLACE_FEE_PCT } from "@/lib/marketplace";

/** Seller dashboard + buyer history for the signed-in user. */
export async function GET() {
  return withUser(async (user) => {
    const [me, listings, sales, purchases] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sellerBalanceCents: true, sellerPaidOutCents: true } }),
      db.marketItem.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, type: true, title: true, price: true, sales: true, installs: true, published: true, createdAt: true } }),
      db.purchase.findMany({ where: { sellerId: user.id, status: "PAID" }, orderBy: { paidAt: "desc" }, take: 50, include: { item: { select: { title: true } }, buyer: { select: { email: true, name: true } } } }),
      db.purchase.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { item: { select: { id: true, title: true, type: true } } } }),
    ]);
    const grossCents = sales.reduce((s, p) => s + p.priceCents, 0);
    const earnedCents = sales.reduce((s, p) => s + p.sellerCents, 0);
    return json({
      feePct: MARKETPLACE_FEE_PCT,
      balanceCents: me.sellerBalanceCents,
      paidOutCents: me.sellerPaidOutCents,
      grossCents,
      earnedCents,
      listings,
      sales: sales.map((p) => ({ id: p.id, item: p.item.title, buyer: p.buyer.name ?? p.buyer.email, priceCents: p.priceCents, sellerCents: p.sellerCents, paidAt: p.paidAt })),
      purchases: purchases.map((p) => ({ id: p.id, itemId: p.item.id, item: p.item.title, type: p.item.type, priceCents: p.priceCents, status: p.status, createdAt: p.createdAt })),
    });
  });
}
