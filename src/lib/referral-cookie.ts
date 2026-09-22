import { createHmac, timingSafeEqual } from "node:crypto";
function signature(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET is required for referral attribution");
  return createHmac("sha256", secret).update(`referral:${value}`).digest("hex");
}
export function signReferral(kind: "affiliate" | "user", id: string, now = Date.now()) {
  const value = `${kind === "affiliate" ? "a" : "u"}:${id}:${now + 30 * 86400000}`;
  return `${value}:${signature(value)}`;
}
export function verifyReferral(raw: string | undefined, now = Date.now()) {
  if (!raw) return null;
  const [kind, id, expires, sig, extra] = raw.split(":");
  if (extra || !id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || !["a", "u"].includes(kind) || !sig || !Number.isFinite(Number(expires)) || Number(expires) <= now) return null;
  const expected = Buffer.from(signature(`${kind}:${id}:${expires}`));
  const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { kind: kind === "a" ? "affiliate" as const : "user" as const, id };
}
