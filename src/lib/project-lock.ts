import { randomUUID } from "node:crypto";
import { db } from "./db";

export class ProjectBusyError extends Error {
  constructor(message = "This project is already being updated. Wait for it to finish and retry.", public status = 409) { super(message); }
}

/** Model time per run: as much of the route's 300 s server limit as still leaves room for settlement and saving. */
export const GENERATION_TIMEOUT_MS = 280_000;
const LEASE_MS = GENERATION_TIMEOUT_MS + 60_000;
function limit(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 && n <= 1000 ? n : fallback;
}

/**
 * Short, database-backed admission across all server instances; no connection is held during AI calls.
 * Admission is one INSERT … SELECT: no lock is held across round trips and no interactive transaction can
 * expire while a burst of requests queues, so many users can start generations at the same moment.
 * The capacity counts are read-committed, so a burst may overshoot the soft ceilings by a few runs;
 * per-project exclusivity is exact (primary key).
 */
export async function acquireProjectLease(projectId: string, userId: string, generation = false) {
  const key = `project-write:${projectId}`;
  const value = JSON.stringify({ token: randomUUID(), userId, generation });
  const project = await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  if (!project) throw new ProjectBusyError("Project not found.", 404);
  const fresh = new Date(Date.now() - LEASE_MS);
  // Expired leases belong to processes the host has already stopped.
  await db.setting.deleteMany({ where: { key: { startsWith: "project-write:" }, updatedAt: { lt: fresh } } });
  const userMax = limit(process.env.AI_MAX_USER_CONCURRENT, 2);
  // Serverless instances scale out; the global ceiling only guards the providers' rate limits.
  const globalMax = limit(process.env.AI_MAX_CONCURRENT, 64);
  const userPattern = `%"userId":${JSON.stringify(userId)}%`;
  const admitted = await db.$queryRaw<{ key: string }[]>`
    INSERT INTO "Setting" ("key", "value", "updatedAt")
    SELECT ${key}, ${value}, now()
    WHERE ${!generation}::boolean OR (
      (SELECT count(*) FROM "Setting" WHERE "key" LIKE 'project-write:%' AND "updatedAt" >= ${fresh} AND "value" LIKE '%"generation":true%') < ${globalMax}
      AND (SELECT count(*) FROM "Setting" WHERE "key" LIKE 'project-write:%' AND "updatedAt" >= ${fresh} AND "value" LIKE '%"generation":true%' AND "value" LIKE ${userPattern}) < ${userMax})
    ON CONFLICT ("key") DO NOTHING
    RETURNING "key"`;
  if (!admitted.length) {
    if (await db.setting.findUnique({ where: { key } })) throw new ProjectBusyError();
    const leases = await db.setting.findMany({ where: { key: { startsWith: "project-write:" }, updatedAt: { gte: fresh } }, select: { value: true } });
    const mine = leases.map((row) => JSON.parse(row.value) as { userId: string; generation: boolean }).filter((row) => row.generation && row.userId === userId).length;
    if (mine >= userMax) throw new ProjectBusyError("You already have the maximum number of active generations. Wait for one to finish.", 429);
    throw new ProjectBusyError("Generation capacity is currently full. Please retry shortly; no credits were charged.", 503);
  }
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
