import { readRequestText, RequestBodyError } from "@/lib/request-body";
import { dispatchEmails } from "@/lib/email-dispatch";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { retrieveWhopPayment, verifyWhopSignature, type WhopWebhookEvent } from "@/lib/whop";
import { getSettings } from "@/lib/settings";
import { adjustPayment, objectId, settlePayment } from "@/lib/billing-ledger";

const MEMBERSHIP_EVENTS = new Set(["membership.activated", "membership.went_valid", "membership.created", "membership.deactivated", "membership.went_invalid", "membership.canceled", "membership.expired"]);
const ADJUSTMENT = /^(refund\.(created|succeeded|updated)|dispute\.(created|updated)|payment\.(refunded|disputed))$/;

export async function POST(req: Request) {
  const id = req.headers.get("webhook-id");
  if (!id || !req.headers.get("webhook-signature") || !req.headers.get("webhook-timestamp")) return new Response("invalid signature", { status: 401 });
  let raw: string;
  try { raw = await readRequestText(req, 256_000); }
  catch (e) { return new Response("Invalid webhook body", { status: e instanceof RequestBodyError ? e.status : 400 }); }
  if (!verifyWhopSignature({ id, timestamp: req.headers.get("webhook-timestamp"), signature: req.headers.get("webhook-signature"), rawBody: raw, secret: process.env.WHOP_WEBHOOK_SECRET ?? "" })) return new Response("invalid signature", { status: 401 });
  let event: WhopWebhookEvent;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  if (!event || typeof event.type !== "string" || !event.data || typeof event.data !== "object") return new Response("bad event", { status: 400 });
  if (!MEMBERSHIP_EVENTS.has(event.type) && event.type !== "payment.succeeded" && !ADJUSTMENT.test(event.type)) return Response.json({ ok: true, ignored: true });
  if (await db.webhookEvent.findUnique({ where: { id: id! } })) return Response.json({ ok: true, duplicate: true });
  try {
    const adjustment = ADJUSTMENT.test(event.type);
    let data: Record<string, unknown> = event.data;
    // Re-fetch financial events from Whop. Return 503 on failure so Whop retries;
    // never acknowledge an event before its financial effects commit.
    if (adjustment || event.type === "payment.succeeded") {
      const paymentId = adjustment && !event.type.startsWith("payment.") ? objectId(data.payment ?? data.payment_id) : objectId(data.id);
      if (!paymentId) throw new Error("Missing payment reference");
      data = await retrieveWhopPayment(paymentId);
      if (objectId(data.id) !== paymentId) throw new Error("Payment ID mismatch");
      if (objectId(data.company ?? data.company_id) !== process.env.WHOP_COMPANY_ID) throw new Error("Payment company mismatch");
    }
    const settings = await getSettings();
    const result = await db.$transaction(async (tx) => {
      // Serialises payment delivery + corrections, including different webhook IDs.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`whop:${objectId(data.id)}`}))`;
      if (await tx.webhookEvent.findUnique({ where: { id: id! } })) return { duplicate: true };
      let outcome: Record<string, unknown> = {};
      if (event.type === "payment.succeeded") {
        outcome = await settlePayment(tx, data, settings.referral.referrerPaidCredits);
        if (Number(data.refunded_amount) > 0 || (Array.isArray(data.disputes) && data.disputes.length)) await adjustPayment(tx, data);
      } else if (adjustment) {
        if (!await tx.payment.findUnique({ where: { id: objectId(data.id)! } })) {
          // Let payment.succeeded establish the original first. Legacy payments
          // must be imported by reconciliation, never granted a second time.
          throw new Error("Original payment is not recorded yet; retry or reconcile legacy history");
        }
        outcome = await adjustPayment(tx, data);
      } else {
        const membershipId = objectId(data.id);
        if (!membershipId) throw new Error("Membership ID missing");
        const existing = await tx.membership.findUnique({ where: { whopMembershipId: membershipId } });
        // Membership events may revoke access, but only confirmed payments grant it.
        if (existing && (/membership\.(deactivated|went_invalid|expired)/.test(event.type) || data.valid === false)) {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${existing.userId} FOR UPDATE`;
          await tx.membership.update({ where: { id: existing.id }, data: { status: "inactive" } });
          const other = await tx.membership.findFirst({ where: { userId: existing.userId, status: "active" }, orderBy: { updatedAt: "desc" } });
          await tx.user.update({ where: { id: existing.userId }, data: { plan: other?.plan ?? "FREE" } });
        }
        outcome = { membership: membershipId };
      }
      // Store only the necessary audit metadata, never card details or client_secret.
      await tx.webhookEvent.create({ data: { id: id!, type: event.type, payload: JSON.stringify({ resourceId: objectId(data.id), processed: true }) } });
      return outcome;
    }, { timeout: 20000 });
    dispatchEmails();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && await db.webhookEvent.findUnique({ where: { id: id! } })) return Response.json({ ok: true, duplicate: true });
    console.error("[whop] Event could not be committed", { eventId: id, type: event.type, error: e instanceof Error ? e.message : "Unknown error" });
    return Response.json({ error: "Payment processing temporarily unavailable. Retry required." }, { status: 503 });
  }
}
