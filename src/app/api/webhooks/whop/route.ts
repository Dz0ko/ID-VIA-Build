import { db } from "@/lib/db";
import { PLANS, isPlanId } from "@/lib/plans";
import { extractWhop, verifyWhopSignature, whopPlanMap, type WhopWebhookEvent } from "@/lib/whop";
import { grantCredits } from "@/lib/credits";

/**
 * Whop webhook receiver.
 * Events handled: membership.activated / membership.went_valid → upgrade plan
 *                 membership.deactivated / membership.went_invalid → downgrade to FREE
 *                 payment.succeeded → (credit top-up packs via metadata.credits)
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.WHOP_WEBHOOK_SECRET ?? "";
  const id = req.headers.get("webhook-id");
  const ok = verifyWhopSignature({
    id,
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
    rawBody: raw,
    secret,
  });
  if (!ok) return new Response("invalid signature", { status: 401 });

  let event: WhopWebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Idempotency
  const eventId = id ?? event.id ?? `${event.type}:${Date.now()}`;
  const seen = await db.webhookEvent.findUnique({ where: { id: eventId } });
  if (seen) return Response.json({ ok: true, duplicate: true });
  await db.webhookEvent.create({ data: { id: eventId, type: event.type, payload: raw } });

  const { membershipId, planId, userId: whopUserId, email, status, valid } = extractWhop(event);
  const map = whopPlanMap();
  const mapped = planId ? map[planId] : undefined;

  // Find our user by Whop id, then by email.
  let user = whopUserId ? await db.user.findUnique({ where: { whopUserId } }) : null;
  if (!user && email) user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user && email) {
    // Pre-create the account so the plan is ready when they sign in with Whop.
    user = await db.user.create({
      data: { email: email.toLowerCase(), whopUserId: whopUserId ?? undefined, plan: "FREE", credits: PLANS.FREE.credits },
    });
  }
  if (!user) return Response.json({ ok: true, ignored: "no user match" });
  if (whopUserId && !user.whopUserId) {
    user = await db.user.update({ where: { id: user.id }, data: { whopUserId } });
  }

  const type = event.type;
  const activated = /membership\.(activated|went_valid|created)/.test(type) || (type.startsWith("membership.") && valid === true && status !== "canceled");
  const deactivated = /membership\.(deactivated|went_invalid|canceled|expired)/.test(type) || (type.startsWith("membership.") && valid === false);

  if (activated && membershipId) {
    const plan = mapped && isPlanId(mapped) ? mapped : "STARTER";
    await db.membership.upsert({
      where: { whopMembershipId: membershipId },
      create: { userId: user.id, whopMembershipId: membershipId, whopPlanId: planId ?? "", plan, status: "active", raw },
      update: { plan, status: "active", raw, whopPlanId: planId ?? "" },
    });
    if (user.plan !== plan) {
      await db.user.update({ where: { id: user.id }, data: { plan } });
      const delta = Math.max(0, PLANS[plan].credits - PLANS[isPlanId(user.plan) ? user.plan : "FREE"].credits);
      if (delta > 0) await grantCredits(user.id, delta, `upgrade:${plan}`);
    }
  } else if (deactivated && membershipId) {
    await db.membership.updateMany({ where: { whopMembershipId: membershipId }, data: { status: "inactive", raw } });
    const stillActive = await db.membership.findFirst({ where: { userId: user.id, status: "active" }, orderBy: { updatedAt: "desc" } });
    await db.user.update({ where: { id: user.id }, data: { plan: stillActive?.plan ?? "FREE" } });
  } else if (type === "payment.succeeded") {
    const meta = (event.data?.metadata ?? {}) as Record<string, unknown>;
    const credits = Number(meta.credits ?? 0);
    if (credits > 0) await grantCredits(user.id, credits, "credit_pack");
  }

  return Response.json({ ok: true });
}
