import { hashPassword, isCurrentPasswordHash, verifyPassword } from "./password";
import { db } from "./db";
import { clientIp, rateLimit, safeEqual } from "./security";

export type PortalDenied = { status: 404 | 410 | 401 | 429; message: string };

/** Validate a client-portal share link: existence, expiry and password (constant-time). */
export async function checkPortalLink(token: string, password: string | null): Promise<PortalDenied | null> {
  const link = await db.shareLink.findUnique({ where: { token }, select: { password: true, expiresAt: true } });
  if (!link) return { status: 404, message: "This link is invalid or was removed." };
  if (link.expiresAt && link.expiresAt < new Date()) return { status: 410, message: "This link has expired." };
  if (link.password) {
    // Brute-force guard: 20 attempts per 10 minutes per link and IP.
    const limited = await rateLimit(`portal:${token}:${await clientIp()}`, 20, 600);
    if (limited) return { status: 429, message: "Too many attempts. Try again in a few minutes." };
    const current = isCurrentPasswordHash(link.password);
    const valid = current ? await verifyPassword(password || "", link.password) : safeEqual(link.password, password);
    if (!valid) return { status: 401, message: "Password required." };
    // Upgrade legacy portal passwords without breaking existing shared links.
    if (!current) await db.shareLink.updateMany({ where: { token, password: link.password }, data: { password: await hashPassword(password!) } });
  }
  return null;
}
