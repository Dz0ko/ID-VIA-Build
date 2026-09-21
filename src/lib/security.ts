import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";
import { error } from "./api";

/**
 * Client IP. On Vercel the platform overwrites `x-vercel-forwarded-for` and `x-real-ip`
 * with the true client address, so clients cannot spoof them; `x-forwarded-for` is the
 * last resort for other hosts.
 */
export async function clientIp() {
  const h = await headers();
  const v = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  return v.trim().slice(0, 64);
}

/**
 * Fixed-window rate limiter backed by the database, so it works across serverless
 * instances. One atomic upsert per call: concurrent requests cannot slip past the limit.
 * Returns null when allowed, or a 429 response.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const reset = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${reset})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${reset} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (row && row.count > limit) {
    const retry = Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - now.getTime()) / 1000));
    return error("Too many requests. Please slow down.", 429, { retryAfter: retry });
  }
  return null;
}

/**
 * Only allow same-site relative paths for redirects: "/app", never "//evil.com",
 * "/\evil.com", "javascript:" or absolute URLs.
 */
export function safePath(input: string | null | undefined, fallback = "/app") {
  if (!input) return fallback;
  const s = input.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || /[\r\n]/.test(s)) return fallback;
  try {
    const u = new URL(s, "https://idaevia.app");
    if (u.origin !== "https://idaevia.app") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** Constant-time string comparison for secrets / passwords stored in plain form (portal links). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Headers for HTML that users generated (published sites, previews, portal).
 * `sandbox` without `allow-same-origin` gives the document an opaque origin:
 * its scripts cannot read our cookies, call our API as the visitor, or touch
 * localStorage of idaevia.app. Sites still render and run their own JS.
 */
export const USER_HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock allow-presentation",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
} as const;
