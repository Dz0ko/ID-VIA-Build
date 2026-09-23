import { readRequestJson } from "@/lib/request-body";
import { enqueueWelcome } from "@/lib/email";
import { dispatchEmails } from "@/lib/email-dispatch";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { applyReferralOnSignup } from "@/lib/referrals";
import { clientIp, rateLimit } from "@/lib/security";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  marketingEmails: z.boolean().default(false),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await readRequestJson(req, 16384).catch(() => null));
  if (!body.success) return error("Invalid input: email and a password of 8+ characters are required.");
  const limited = await rateLimit(`signup:ip:${await clientIp()}`, 5, 3600);
  if (limited) return limited;
  const email = body.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return error("An account with this email already exists.", 409);
  const passwordHash = await hashPassword(body.data.password);
  const user = await db.$transaction(async tx => {
    const created = await tx.user.create({ data: { email, name: body.data.name ?? email.split("@")[0], passwordHash, plan: "FREE", credits: PLANS.FREE.credits, marketingEmails: body.data.marketingEmails, marketingConsentAt: body.data.marketingEmails ? new Date() : null } });
    await tx.creditLedger.create({ data: { userId: created.id, delta: PLANS.FREE.credits, reason: "signup" } });
    await enqueueWelcome(tx, created);
    return created;
  });
  dispatchEmails();
  await applyReferralOnSignup(user.id);
  await createSession(user.id);
  return json({ ok: true });
}
