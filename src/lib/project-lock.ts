import { randomUUID } from "node:crypto";
import { db } from "./db";

export class ProjectBusyError extends Error {
  constructor(message = "This project is already being updated. Wait for it to finish and retry.", public status = 409) { super(message); }
}

export const GENERATION_TIMEOUT_MS = 240_000;
const LEASE_MS = GENERATION_TIMEOUT_MS + 60_000;
function limit(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 && n <= 1000 ? n : fallback;
}

/** Short, database-backed admission across all server instances; no connection held during AI calls. */
export async function acquireProjectLease(projectId: string, userId: string, generation = false) {
  const key = `project-write:${projectId}`;
  const value = JSON.stringify({ token: randomUUID(), userId, generation });
  await db.$transaction(async (tx) => {
    // Serializes admission only, not generation. Also makes global capacity checks atomic.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(184701, 1)::text`;
    const project = await tx.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
    if (!project) throw new ProjectBusyError("Project not found.", 404);
    await tx.setting.deleteMany({ where: { key: { startsWith: "project-write:" }, updatedAt: { lt: new Date(Date.now() - LEASE_MS) } } });
    if (await tx.setting.findUnique({ where: { key } })) throw new ProjectBusyError();
    if (generation) {
      const leases = await tx.setting.findMany({ where: { key: { startsWith: "project-write:" } }, select: { value: true } });
      const active = leases.map((row) => JSON.parse(row.value) as { userId: string; generation: boolean }).filter((row) => row.generation);
      if (active.filter((row) => row.userId === userId).length >= limit(process.env.AI_MAX_USER_CONCURRENT, 2)) {
        throw new ProjectBusyError("You already have the maximum number of active generations. Wait for one to finish.", 429);
      }
      if (active.length >= limit(process.env.AI_MAX_CONCURRENT, 16)) {
        throw new ProjectBusyError("Generation capacity is currently full. Please retry shortly; no credits were charged.", 503);
      }
    }
    await tx.setting.create({ data: { key, value } });
  });
  return {
    async assertActive() {
      if (!await db.setting.findFirst({ where: { key, value, updatedAt: { gte: new Date(Date.now() - LEASE_MS) } } })) {
        throw new ProjectBusyError("This operation expired. Retry using the latest project version.");
      }
    },
    async release() { await db.setting.deleteMany({ where: { key, value } }); },
  };
}

export async function withProjectWrite<T>(projectId: string, userId: string, work: () => Promise<T>) {
  const lease = await acquireProjectLease(projectId, userId);
  try { return await work(); } finally { await lease.release(); }
}
