import { db } from "./db";
import { CRYPTO_PAYMENT_METHODS, createWhopCheckoutSession, rememberCheckout } from "./whop";

/** Platform commission on every marketplace sale, in percent. */
export const MARKETPLACE_FEE_PCT = 10;
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
  // Defence in depth: the preview is also served under a CSP that blocks all scripts,
  // frames, forms and navigation (USER_HTML_HEADERS + default-src 'none').
  let out = html;
  let prev = "";
  for (let i = 0; i < 5 && out !== prev; i++) {
    // Loop: removing a tag can reassemble another (<scr<script>ipt>), so repeat until stable.
    prev = out;
    out = out
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|iframe|object|embed|applet|base|link|meta|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<\/?(script|iframe|object|embed|applet|base|link|meta|noscript|template)\b[^>]*>/gi, "")
      .replace(/[\s/]on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
      .replace(/\s(href|src|action|formaction|xlink:href|data|poster|srcdoc)\s*=\s*("\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*'|(?:javascript|vbscript|data):[^\s>]+)/gi, ' $1="#"')
      .replace(/<a\b([^>]*)\shref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '<a$1 href="#"')
      .replace(/<form\b/gi, '<form action="#"')
      .replace(/url\(\s*["']?\s*(?:javascript|vbscript):[^)]*\)/gi, "none");
  }
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
  // Never on production: a missing Whop key must fail closed, not hand out free items.
  if (process.env.NODE_ENV === "production") return false;
  return true;
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
  const session = await createWhopCheckoutSession({
    plan: {
      plan_type: "one_time",
      billing_period: null,
      initial_price: priceCentsToUsd(opts.priceCents),
      renewal_price: 0,
      title: opts.title,
      product: { external_identifier: `idaevia-market-${opts.itemId}`, title: opts.title, description: opts.description.slice(0, 500), collect_shipping_address: false },
    },
    metadata: { purchase_id: opts.purchaseId, market_item_id: opts.itemId, idaevia_user_id: opts.buyerId, email: opts.buyerEmail },
    redirect_url: `${opts.appUrl}/app/marketplace?purchase=${opts.purchaseId}`,
    extraPaymentMethods: CRYPTO_PAYMENT_METHODS,
  });
  await rememberCheckout({ id: session.checkoutId, userId: opts.buyerId, kind: "market", purchaseId: opts.purchaseId });
  return session;
}

function priceCentsToUsd(cents: number) {
  return Math.round(cents) / 100;
}

/**
 * Mark a purchase paid: unlock for the buyer, credit the seller, count the sale. Idempotent.
 * When the paid amount is known it must cover the item price, so partial/test charges never unlock.
 */
export async function markPurchasePaid(purchaseId: string, whopPaymentId?: string | null, paidCents?: number | null) {
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return null;
  if (purchase.status === "PAID") return purchase;
  if (typeof paidCents === "number" && paidCents > 0 && paidCents + 1 < purchase.priceCents) {
    console.warn(`[marketplace] payment ${whopPaymentId} for ${purchaseId} was ${paidCents}c, expected ${purchase.priceCents}c; not unlocking`);
    return null;
  }
  // The status flip is the guard: only the first concurrent settlement credits the seller.
  const flipped = await db.purchase.updateMany({ where: { id: purchaseId, status: "PENDING" }, data: { status: "PAID", paidAt: new Date(), whopPaymentId: whopPaymentId ?? purchase.whopPaymentId } });
  if (flipped.count !== 1) return db.purchase.findUnique({ where: { id: purchaseId } });
  await db.$transaction([
    db.marketItem.update({ where: { id: purchase.itemId }, data: { sales: { increment: 1 }, installs: { increment: 1 } } }),
    db.user.update({ where: { id: purchase.sellerId }, data: { sellerBalanceCents: { increment: purchase.sellerCents } } }),
  ]);
  return db.purchase.findUnique({ where: { id: purchaseId } });
}

/** Reverse a paid purchase after a refund or chargeback: lock the item again and take the seller share back. Idempotent. */
export async function reversePurchase(whopPaymentId: string, reason: string) {
  const purchase = await db.purchase.findFirst({ where: { whopPaymentId, status: "PAID" } });
  if (!purchase) return null;
  const flipped = await db.purchase.updateMany({ where: { id: purchase.id, status: "PAID" }, data: { status: "REFUNDED" } });
  if (flipped.count !== 1) return null;
  await db.$transaction([
    db.marketItem.update({ where: { id: purchase.itemId }, data: { sales: { decrement: 1 } } }),
    // Never below zero: if the seller was already paid out, the negative is tracked in paidOut instead.
    db.$executeRaw`UPDATE "User" SET "sellerBalanceCents" = GREATEST(0, "sellerBalanceCents" - ${purchase.sellerCents}),
      "sellerPaidOutCents" = "sellerPaidOutCents" - GREATEST(0, ${purchase.sellerCents} - "sellerBalanceCents") WHERE "id" = ${purchase.sellerId}`,
  ]);
  console.warn(`[marketplace] purchase ${purchase.id} reversed (${reason})`);
  return db.purchase.findUnique({ where: { id: purchase.id } });
}

export async function hasPurchased(userId: string, itemId: string) {
  const p = await db.purchase.findFirst({ where: { buyerId: userId, itemId, status: "PAID" }, select: { id: true } });
  return Boolean(p);
}
