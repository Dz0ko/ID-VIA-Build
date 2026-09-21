import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { rateLimit } from "@/lib/security";
import { createWhopCheckout, hasPurchased, simulatedPaymentsEnabled, splitPrice, whopPaymentsConfigured } from "@/lib/marketplace";

/**
 * Start a purchase. Creates a PENDING order and returns the Whop checkout URL.
 * Without Whop keys (local dev) it returns a simulated-payment URL instead.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/marketplace/[id]/buy">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const item = await db.marketItem.findUnique({ where: { id } });
    if (!item || !item.published) return error("Item not found", 404);
    if (item.price <= 0) return error("This item is free. Use install instead.");
    if (item.authorId === user.id) return error("You own this item.");
    if (await hasPurchased(user.id, id)) return json({ alreadyOwned: true });
    const limited = await rateLimit(`buy:user:${user.id}`, 10, 3600);
    if (limited) return limited;

    const { feeCents, sellerCents } = splitPrice(item.price);
    const purchase = await db.purchase.create({
      data: { itemId: id, buyerId: user.id, sellerId: item.authorId, priceCents: item.price, feeCents, sellerCents },
    });
    const appUrl = process.env.APP_URL ?? new URL(req.url).origin;

    if (!whopPaymentsConfigured()) {
      if (!simulatedPaymentsEnabled()) {
        await db.purchase.delete({ where: { id: purchase.id } });
        return error("Payments are not configured yet. Set WHOP_API_KEY and WHOP_COMPANY_ID.", 503);
      }
      return json({ purchaseId: purchase.id, url: `/api/marketplace/purchases/${purchase.id}/dev-pay`, simulated: true });
    }
    try {
      const { checkoutId, url } = await createWhopCheckout({
        purchaseId: purchase.id, itemId: item.id, title: item.title, description: item.description, priceCents: item.price,
        buyerId: user.id, buyerEmail: user.email, appUrl,
      });
      await db.purchase.update({ where: { id: purchase.id }, data: { whopCheckoutId: checkoutId } });
      return json({ purchaseId: purchase.id, url });
    } catch (e) {
      await db.purchase.delete({ where: { id: purchase.id } });
      console.error("[marketplace] checkout", e);
      return error("Could not start checkout. Please try again.", 502);
    }
  });
}
