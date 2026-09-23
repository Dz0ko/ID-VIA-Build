import { z } from "zod";
import { db } from "@/lib/db";
import { json, error } from "@/lib/api";
export async function POST(req: Request) {
  const token = z.string().uuid().safeParse(new URL(req.url).searchParams.get("token"));
  if (!token.success) return error("Invalid unsubscribe link.");
  const user = await db.user.findUnique({ where: { emailOptOutToken: token.data }, select: { id: true } });
  if (user) await db.$transaction(async tx => {
    await tx.user.update({ where: { id: user.id }, data: { marketingEmails: false, marketingConsentAt: null } });
    await tx.emailDelivery.updateMany({ where: { userId: user.id, marketing: true, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUPPRESSED", lastError: "Unsubscribed" } });
  });
  return json({ ok: true });
}
