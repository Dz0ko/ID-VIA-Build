import { readRequestJson } from "@/lib/request-body";
import { DUMMY_PASSWORD_HASH, hashPassword, isCurrentPasswordHash } from "@/lib/password";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/security";
import { applyAttributionOnLogin } from "@/lib/referrals";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const body = schema.safeParse(await readRequestJson(req, 16384).catch(() => null));
  if (!body.success) return error("Invalid input.");
  const email = body.data.email.toLowerCase();
  const ip = await clientIp();
  const limited = (await rateLimit(`login:ip:${ip}`, 30, 900)) ?? (await rateLimit(`login:email:${email}`, 8, 900));
  if (limited) return limited;
  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(body.data.password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user || !user.passwordHash || !valid)
    return error("Invalid email or password.", 401);
  if (!isCurrentPasswordHash(user.passwordHash)) {
    const upgraded = await db.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash, sessionVersion: user.sessionVersion }, data: { passwordHash: await hashPassword(body.data.password) } });
    if (!upgraded.count) return error("Account credentials changed. Please sign in again.", 401);
  }
  await applyAttributionOnLogin(user.id);
  await createSession(user.id, user.sessionVersion);
  return json({ ok: true });
}
