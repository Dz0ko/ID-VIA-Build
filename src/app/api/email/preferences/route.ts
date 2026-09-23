import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
export async function GET() {
  return withUser(async user => json(await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { marketingEmails: true } })));
}
export async function PUT(req: Request) {
  return withUser(async user => {
    const body = z.object({ marketingEmails: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Choose your email preference.");
    await db.$transaction(async tx => {
      await tx.user.update({ where: { id: user.id }, data: { marketingEmails: body.data.marketingEmails, marketingConsentAt: body.data.marketingEmails ? new Date() : null } });
      if (!body.data.marketingEmails) await tx.emailDelivery.updateMany({ where: { userId: user.id, marketing: true, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUPPRESSED", lastError: "Unsubscribed" } });
    });
    return json({ ok: true });
  });
}
