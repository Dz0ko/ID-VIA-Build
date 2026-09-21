import { db } from "./db";

/** Platform commission on every marketplace sale, in percent. */
export const MARKETPLACE_FEE_PCT = 5;
/** Sellers must price paid items at least this much (USD cents) so fees stay meaningful. */
export const MARKETPLACE_MIN_PRICE_CENTS = 500;
export const MARKETPLACE_MAX_PRICE_CENTS = 500_000;

export function splitPrice(priceCents: number) {
  const feeCents = Math.round((priceCents * MARKETPLACE_FEE_PCT) / 100);
  return { feeCents, sellerCents: priceCents - feeCents };
}

export const TYPE_LABELS: Record<string, string> = {
  template: "Website / app",
  prompt: "Prompt",
  component: "Component",
  agent: "Agent",
};

/**
 * Build the public preview of a website listing: the page as it looks, with
 * every script, handler, form and link removed, text selection disabled and a
 * watermark. Buyers receive the untouched original after purchase.
 */
export function buildPreviewHtml(html: string) {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\shref\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, ' href="#"')
    .replace(/<a\b([^>]*)\shref\s*=\s*("[^"]*"|'[^']*')/gi, '<a$1 href="#"')
    .replace(/<form\b/gi, '<form onsubmit="return false"')
    .replace(/<!--[\s\S]*?-->/g, "");
  const guard = `<meta name="robots" content="noindex,nofollow"><style>html,body{user-select:none!important;-webkit-user-select:none!important}a,button,input,select,textarea{pointer-events:none!important}#idaevia-wm{position:fixed;right:12px;bottom:12px;z-index:2147483647;font:600 11px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:7px 11px;letter-spacing:.04em;pointer-events:none;backdrop-filter:blur(6px)}</style>`;
  const wm = `<div id="idaevia-wm">PREVIEW · IDÆVIA Marketplace</div>`;
  out = /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (m) => `${m}${guard}`) : `${guard}${out}`;
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${wm}</body>`) : `${out}${wm}`;
  return out;
}

/* ---------------- Whop payments ---------------- */

export function whopPaymentsConfigured() {
  return Boolean(process.env.WHOP_API_KEY && process.env.WHOP_COMPANY_ID);
}

/**
 * Simulated checkout for local testing: enabled outside production, or when
 * MARKETPLACE_DEV_PAYMENTS=1 is set explicitly (e.g. `npm run start` on a laptop).
 * Never active once real Whop keys are configured.
 */
export function simulatedPaymentsEnabled() {
  if (whopPaymentsConfigured()) return false;
  return process.env.NODE_ENV !== "production" || process.env.MARKETPLACE_DEV_PAYMENTS === "1";
}

/**
 * Create a one-time Whop checkout for a purchase. Metadata carries the purchase id,
 * which the `payment.succeeded` webhook returns unchanged.
 * Docs: https://docs.whop.com/api-reference/checkout-configurations/create-checkout-configuration
 */
export async function createWhopCheckout(opts: {
  purchaseId: string;
  itemId: string;
  title: string;
  description: string;
  priceCents: number;
  buyerId: string;
  buyerEmail: string;
  appUrl: string;
}): Promise<{ checkoutId: string; url: string }> {
  const base = process.env.WHOP_API_BASE ?? "https://api.whop.com/api/v1";
  const res = await fetch(`${base}/checkout_configurations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "payment",
      plan: {
        company_id: process.env.WHOP_COMPANY_ID,
        currency: "usd",
        plan_type: "one_time",
        initial_price: priceCentsToUsd(opts.priceCents),
        renewal_price: 0,
        title: opts.title,
        product: { external_identifier: `idaevia-market-${opts.itemId}`, title: opts.title, description: opts.description.slice(0, 500), collect_shipping_address: false },
      },
      metadata: { purchase_id: opts.purchaseId, market_item_id: opts.itemId, idaevia_user_id: opts.buyerId, email: opts.buyerEmail },
      redirect_url: `${opts.appUrl}/app/marketplace?purchase=${opts.purchaseId}`,
    }),
  });
  if (!res.ok) throw new Error(`Whop checkout failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { id: string; purchase_url?: string };
  const url = data.purchase_url ? (data.purchase_url.startsWith("http") ? data.purchase_url : `https://whop.com${data.purchase_url}`) : `https://whop.com/checkout/${data.id}/`;
  return { checkoutId: data.id, url };
}

function priceCentsToUsd(cents: number) {
  return Math.round(cents) / 100;
}

/** Mark a purchase paid: unlock for the buyer, credit the seller, count the sale. Idempotent. */
export async function markPurchasePaid(purchaseId: string, whopPaymentId?: string | null) {
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return null;
  if (purchase.status === "PAID") return purchase;
  const [updated] = await db.$transaction([
    db.purchase.update({ where: { id: purchaseId }, data: { status: "PAID", paidAt: new Date(), whopPaymentId: whopPaymentId ?? purchase.whopPaymentId } }),
    db.marketItem.update({ where: { id: purchase.itemId }, data: { sales: { increment: 1 }, installs: { increment: 1 } } }),
    db.user.update({ where: { id: purchase.sellerId }, data: { sellerBalanceCents: { increment: purchase.sellerCents } } }),
  ]);
  return updated;
}

export async function hasPurchased(userId: string, itemId: string) {
  const p = await db.purchase.findFirst({ where: { buyerId: userId, itemId, status: "PAID" }, select: { id: true } });
  return Boolean(p);
}
