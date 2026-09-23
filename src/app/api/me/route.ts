import { readRequestJson } from "@/lib/request-body";
import { enqueueEmail, appUrl } from "@/lib/email";
import { dispatchEmails } from "@/lib/email-dispatch";
import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/security";
import { PLANS } from "@/lib/plans";
import { providerStatus } from "@/lib/ai/router";

export async function GET() {
  return withUser(async (user) =>
    json({ user, plan: PLANS[user.plan], providers: providerStatus() }),
  );
}

const schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  avatarUrl: z.string().trim().url().max(500).regex(/^https:\/\//, "Avatar must be an https URL").or(z.literal("")).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

/** Update the signed-in user's own profile (name, avatar, password). */
export async function PATCH(req: Request) {
  return withUser(async (user) => {
    const body = schema.safeParse(await readRequestJson(req, 16384).catch(() => null));
    if (!body.success) return error("Invalid input.");
    const data: { name?: string; avatarUrl?: string | null; passwordHash?: string } = {};
    if (body.data.name !== undefined) data.name = body.data.name;
    if (body.data.avatarUrl !== undefined) data.avatarUrl = body.data.avatarUrl || null;
    if (body.data.newPassword) {
      const limited = await rateLimit(`pwchange:user:${user.id}`, 5, 3600);
      if (limited) return limited;

      const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
      if (row.passwordHash) {
        if (!body.data.currentPassword || !(await verifyPassword(body.data.currentPassword, row.passwordHash))) return error("Current password is incorrect.", 403);
      }
      data.passwordHash = await hashPassword(body.data.newPassword);
    }
    if (!Object.keys(data).length) return error("Nothing to update.");
    if (data.passwordHash) {
      // Invalidate every other session and re-issue this one.
      const updated = await db.$transaction(async tx => {
        const changed = await tx.user.update({ where: { id: user.id }, data: { ...data, sessionVersion: { increment: 1 } } });
        await enqueueEmail(tx, { eventKey: `password:${user.id}:${changed.sessionVersion}`, userId: user.id, kind: "password", subject: "Your IDÆVIA password was changed", body: `Your account password was changed on ${new Date().toUTCString()}. Other sessions have been signed out.\n\nIf you did not make this change, contact info@idaevia.app immediately. We will never ask you to send your password by email.`, ctaLabel: "Review account security", ctaUrl: appUrl("/app/profile?section=security") });
        return changed;
      });
      dispatchEmails();
      await createSession(updated.id, updated.sessionVersion);
      return json({ ok: true, sessionsRevoked: true });
    }
    await db.user.update({ where: { id: user.id }, data });
    return json({ ok: true });
  });
}
