import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { providerStatus } from "@/lib/ai/router";

export async function GET() {
  return withUser(async (user) =>
    json({ user, plan: PLANS[user.plan], providers: providerStatus() }),
  );
}

const schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  avatarUrl: z.string().trim().url().max(500).or(z.literal("")).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

/** Update the signed-in user's own profile (name, avatar, password). */
export async function PATCH(req: Request) {
  return withUser(async (user) => {
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    const data: { name?: string; avatarUrl?: string | null; passwordHash?: string } = {};
    if (body.data.name !== undefined) data.name = body.data.name;
    if (body.data.avatarUrl !== undefined) data.avatarUrl = body.data.avatarUrl || null;
    if (body.data.newPassword) {
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
      if (row.passwordHash) {
        if (!body.data.currentPassword || !(await verifyPassword(body.data.currentPassword, row.passwordHash))) return error("Current password is incorrect.", 403);
      }
      data.passwordHash = await hashPassword(body.data.newPassword);
    }
    if (!Object.keys(data).length) return error("Nothing to update.");
    await db.user.update({ where: { id: user.id }, data });
    return json({ ok: true });
  });
}
