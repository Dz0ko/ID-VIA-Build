import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { applyReferralOnSignup } from "@/lib/referrals";
import { clientIp, rateLimit } from "@/lib/security";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return error("Invalid input: email and a password of 8+ characters are required.");
  const limited = await rateLimit(`signup:ip:${await clientIp()}`, 5, 3600);
  if (limited) return limited;
  const email = body.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return error("An account with this email already exists.", 409);
  const user = await db.user.create({
    data: {
      email,
      name: body.data.name ?? email.split("@")[0],
      passwordHash: await hashPassword(body.data.password),
      plan: "FREE",
      credits: PLANS.FREE.credits,
    },
  });
  await db.creditLedger.create({ data: { userId: user.id, delta: PLANS.FREE.credits, reason: "signup" } });
  await applyReferralOnSignup(user.id);
  await createSession(user.id);
  return json({ ok: true });
}
