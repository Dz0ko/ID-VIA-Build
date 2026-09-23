import { db } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { rateLimit } from "@/lib/security";
import { supportSnapshot } from "@/lib/support";

export async function POST() {
  return withUser(async user => {
    const limited = await rateLimit(`support:open:${user.id}`, 20, 60);
    if (limited) return limited;
    const thread = await db.supportThread.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    return json(await supportSnapshot(thread.id, user));
  });
}
