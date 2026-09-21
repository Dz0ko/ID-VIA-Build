import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanId } from "./plans";
import { CREDIT_PACKS, PLANS, isPlanId } from "./plans";

/**
 * Whop is the payment processor only. Sign-in is handled by ./oauth.ts
 * (Google, GitHub) and email + password.
 *
 * Nothing has to be created in the Whop dashboard: every plan, credit pack and
 * marketplace order is created on the fly through the Whop API
 * (`POST /api/v1/checkout_configurations` with an inline plan). Products are
 * upserted by `external_identifier`, so "IDÆVIA Pro" exists once in Whop and
 * every Pro checkout reuses it. Our user id and the purchased plan/pack travel
 * in `metadata`, which Whop copies onto the membership and payment webhooks.
 */
export function whopApiConfigured() {
  return Boolean(process.env.WHOP_API_KEY && process.env.WHOP_COMPANY_ID);
}

export function whopConfigured() {
  return whopApiConfigured() || Boolean(process.env.WHOP_APP_ID || process.env.WHOP_WEBHOOK_SECRET);
}

/** True when a plan can be bought: API checkout, or a static checkout link as a fallback. */
export function planPurchasable(plan: PlanId) {
  return plan !== "FREE" && (whopApiConfigured() || Boolean(checkoutUrl(plan)));
}

const WHOP_API_BASE = () => process.env.WHOP_API_BASE ?? "https://api.whop.com/api/v1";

export interface WhopCheckoutInput {
  mode?: "payment";
  plan: {
    plan_type: "renewal" | "one_time";
    billing_period?: number | null;
    initial_price: number;
    renewal_price: number;
    title: string;
    product: { external_identifier: string; title: string; description?: string; collect_shipping_address?: boolean };
  };
  metadata: Record<string, string | number>;
  redirect_url: string;
}

/** Low-level: create a hosted Whop checkout and return its URL. */
export async function createWhopCheckoutSession(input: WhopCheckoutInput): Promise<{ checkoutId: string; url: string }> {
  if (!whopApiConfigured()) throw new Error("Whop API is not configured (WHOP_API_KEY, WHOP_COMPANY_ID).");
  const res = await fetch(`${WHOP_API_BASE()}/checkout_configurations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: input.mode ?? "payment",
      plan: { company_id: process.env.WHOP_COMPANY_ID, currency: "usd", ...input.plan },
      metadata: input.metadata,
      redirect_url: input.redirect_url,
    }),
  });
  if (!res.ok) throw new Error(`Whop checkout failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { id: string; purchase_url?: string };
  const url = data.purchase_url
    ? data.purchase_url.startsWith("http") ? data.purchase_url : `https://whop.com${data.purchase_url}`
    : `https://whop.com/checkout/${data.id}/`;
  return { checkoutId: data.id, url };
}

/** Monthly subscription checkout for a paid plan. */
export async function createPlanCheckout(opts: { plan: PlanId; userId: string; email: string; appUrl: string }) {
  const p = PLANS[opts.plan];
  if (opts.plan === "FREE" || p.price <= 0) throw new Error("Free plan needs no checkout.");
  return createWhopCheckoutSession({
    plan: {
      plan_type: "renewal",
      billing_period: 30,
      initial_price: p.price,
      renewal_price: p.price,
      title: `IDÆVIA ${p.name} · monthly`,
      product: {
        external_identifier: `idaevia-plan-${opts.plan.toLowerCase()}`,
        title: `IDÆVIA Build ${p.name}`,
        description: `${p.credits.toLocaleString()} AI credits every month, ${p.agentLimit === "all" ? "all" : p.agentLimit} agents.`,
        collect_shipping_address: false,
      },
    },
    metadata: { idaevia_user_id: opts.userId, idaevia_plan: opts.plan, email: opts.email },
    redirect_url: `${opts.appUrl}/app/settings?checkout=plan&plan=${opts.plan}`,
  });
}

/** One-time checkout for a credit pack (credits granted by the webhook from metadata.credits). */
export async function createPackCheckout(opts: { credits: number; userId: string; email: string; appUrl: string }) {
  const pack = CREDIT_PACKS.find((c) => c.credits === opts.credits);
  if (!pack) throw new Error("Unknown credit pack.");
  return createWhopCheckoutSession({
    plan: {
      plan_type: "one_time",
      billing_period: null,
      initial_price: pack.price,
      renewal_price: 0,
      title: `${pack.credits.toLocaleString()} IDÆVIA credits`,
      product: {
        external_identifier: `idaevia-pack-${pack.credits}`,
        title: `IDÆVIA Build · ${pack.credits.toLocaleString()} credits`,
        description: "One-time AI credit top-up for IDÆVIA Build.",
        collect_shipping_address: false,
      },
    },
    metadata: { idaevia_user_id: opts.userId, credits: pack.credits, email: opts.email },
    redirect_url: `${opts.appUrl}/app/settings?checkout=pack&credits=${pack.credits}`,
  });
}

export function whopPlanMap(): Record<string, PlanId> {
  try {
    const raw = process.env.WHOP_PLAN_MAP;
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, PlanId> = {};
    for (const [k, v] of Object.entries(obj)) if (isPlanId(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export function checkoutUrl(plan: PlanId): string | null {
  const map: Record<string, string | undefined> = {
    STARTER: process.env.WHOP_CHECKOUT_STARTER,
    PRO: process.env.WHOP_CHECKOUT_PRO,
    MAX: process.env.WHOP_CHECKOUT_MAX,
    AGENCY: process.env.WHOP_CHECKOUT_AGENCY,
  };
  return map[plan] || null;
}

/**
 * Verify a Whop webhook (Standard Webhooks spec).
 * Signed string: `${webhook-id}.${webhook-timestamp}.${rawBody}` with HMAC-SHA256.
 * Header `webhook-signature` contains one or more `v1,<base64>` entries.
 */
export function verifyWhopSignature(opts: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  secret: string;
}): boolean {
  const { id, timestamp, signature, rawBody, secret } = opts;
  if (!id || !timestamp || !signature || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  // reject if older than 5 minutes
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // Standard Webhooks secrets may be prefixed (whsec_/ws_) and base64 encoded.
  const candidates: Buffer[] = [];
  const stripped = secret.replace(/^(whsec_|ws_)/, "");
  candidates.push(Buffer.from(secret, "utf8"));
  candidates.push(Buffer.from(stripped, "utf8"));
  try {
    candidates.push(Buffer.from(stripped, "base64"));
  } catch {
    /* ignore */
  }

  const toSign = `${id}.${timestamp}.${rawBody}`;
  const provided = signature
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.includes(",") ? s.split(",")[1] : s));

  for (const key of candidates) {
    const expected = createHmac("sha256", key).update(toSign).digest("base64");
    for (const p of provided) {
      const a = Buffer.from(expected);
      const b = Buffer.from(p);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}

export interface WhopWebhookEvent {
  id?: string;
  type: string;
  timestamp?: string | number;
  data: {
    id?: string;
    status?: string;
    valid?: boolean;
    plan_id?: string;
    plan?: { id?: string } | string;
    user_id?: string;
    user?: { id?: string; email?: string; username?: string; name?: string } | string;
    email?: string;
    metadata?: Record<string, unknown>;
    [k: string]: unknown;
  };
}

export function extractWhop(ev: WhopWebhookEvent) {
  const d = ev.data ?? {};
  const planId =
    d.plan_id ?? (typeof d.plan === "string" ? d.plan : d.plan?.id) ?? undefined;
  const userId =
    d.user_id ?? (typeof d.user === "string" ? d.user : d.user?.id) ?? undefined;
  const email =
    d.email ?? (typeof d.user === "object" && d.user ? d.user.email : undefined);
  return { membershipId: d.id, planId, userId, email, status: d.status, valid: d.valid };
}
