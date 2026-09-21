import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";
import { error } from "./api";

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
}

/**
 * Fixed-window rate limiter backed by the database, so it works across
 * serverless instances. Returns null when allowed, or a 429 response.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt <= now) {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now.getTime() + windowSeconds * 1000) },
      update: { count: 1, resetAt: new Date(now.getTime() + windowSeconds * 1000) },
    });
    return null;
  }
  if (row.count >= limit) {
    const retry = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000));
    return error("Too many requests. Please slow down.", 429, { retryAfter: retry });
  }
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return null;
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
