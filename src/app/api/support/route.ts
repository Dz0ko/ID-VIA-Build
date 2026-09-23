import { db } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { rateLimit } from "@/lib/security";
import { supportSnapshot } from "@/lib/support";

export async function POST() {
  return withUser(async user => {
    const limited = await rateLimit(`support:open:${user.id}`, 20, 60);
    if (limited) return limited;
    // A non-empty update lets PostgreSQL resolve concurrent opens atomically
    // with ON CONFLICT instead of a read-then-create race.
    const thread = await db.supportThread.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: { userId: user.id } });
    return json(await supportSnapshot(thread.id, user));
  });
}
