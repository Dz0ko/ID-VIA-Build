import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanId } from "./plans";
import { isPlanId } from "./plans";

export const WHOP_AUTHORIZE_URL = "https://api.whop.com/oauth/authorize";
export const WHOP_TOKEN_URL = "https://api.whop.com/oauth/token";
export const WHOP_USERINFO_URL = "https://api.whop.com/oauth/userinfo";

export function whopConfigured() {
  return Boolean(process.env.WHOP_APP_ID);
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
