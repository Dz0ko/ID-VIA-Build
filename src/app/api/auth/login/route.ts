import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/security";
import { applyAttributionOnLogin } from "@/lib/referrals";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return error("Invalid input.");
  const email = body.data.email.toLowerCase();
  const ip = await clientIp();
  const limited = (await rateLimit(`login:ip:${ip}`, 30, 900)) ?? (await rateLimit(`login:email:${email}`, 8, 900));
  if (limited) return limited;
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await verifyPassword(body.data.password, user.passwordHash)))
    return error("Invalid email or password.", 401);
  await applyAttributionOnLogin(user.id);
  await createSession(user.id);
  return json({ ok: true });
}
