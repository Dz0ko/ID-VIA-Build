import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return error("Invalid input.");
  const user = await db.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
  if (!user || !user.passwordHash || !(await verifyPassword(body.data.password, user.passwordHash)))
    return error("Invalid email or password.", 401);
  await createSession(user.id);
  return json({ ok: true });
}
