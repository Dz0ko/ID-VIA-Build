import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";

export const MAX_USER_RUNTIMES = 3;
export class RuntimeCapacityError extends Error {}

/** Short DB lock serializes reservations across instances, never VM startup or commands. */
export async function reserveRuntimeCapacity(userId: string, replacingKey: string) {
  const prefix = `runtime-slot:${userId}:`;
  const key = `${prefix}${randomUUID()}`;
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`runtime-capacity:${userId}`}))::text`;
    await tx.setting.deleteMany({ where: { key: { startsWith: prefix }, updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } } });
    const projects = await tx.project.findMany({ where: { userId }, select: { id: true } });
    const keys = projects.flatMap(p => [`shell:${p.id}`, `runtime:${p.id}`]).filter(k => k !== replacingKey);
    const states = await tx.setting.findMany({ where: { OR: [{ key: { in: keys } }, { key: { startsWith: `admin-preview:${userId}:`, not: replacingKey } }] }, select: { value: true } });
    const active = states.filter(row => { try { return JSON.parse(row.value).expiresAt > Date.now(); } catch { return false; } }).length;
    const pending = await tx.setting.count({ where: { key: { startsWith: prefix } } });
    if (active + pending >= MAX_USER_RUNTIMES) throw new RuntimeCapacityError("You have 3 active build/terminal sessions. Stop an unused session before starting another project.");
    await tx.setting.create({ data: { key, value: replacingKey } });
  });
  return () => db.setting.deleteMany({ where: { key } });
}
