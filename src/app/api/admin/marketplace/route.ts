import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

function admin<T>(fn: () => Promise<T>) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    return fn();
  });
}

export async function GET() {
  return admin(async () => {
    const [items, orders] = await Promise.all([
      db.marketItem.findMany({ orderBy: { createdAt: "desc" }, take: 300, select: { id: true, type: true, title: true, category: true, price: true, authorName: true, authorId: true, installs: true, sales: true, published: true, createdAt: true } }),
      db.purchase.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { item: { select: { title: true } }, buyer: { select: { email: true } }, seller: { select: { email: true } } } }),
    ]);
    return json({
      items,
      orders: orders.map((o) => ({ id: o.id, item: o.item.title, buyer: o.buyer.email, seller: o.seller.email, priceCents: o.priceCents, feeCents: o.feeCents, sellerCents: o.sellerCents, status: o.status, createdAt: o.createdAt, paidAt: o.paidAt })),
    });
  });
}

export async function PATCH(req: Request) {
  return admin(async () => {
    const body = z.object({ id: z.string(), published: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    await db.marketItem.update({ where: { id: body.data.id }, data: { published: body.data.published } });
    return json({ ok: true });
  });
}
