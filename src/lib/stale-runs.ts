import { db } from "./db";
import { releaseCredits } from "./credits";
import { GENERATION_TIMEOUT_MS } from "./project-lock";
import { recordPlatformError } from "./platform-errors";

/** Older than the model budget plus every settlement step; the 300 s server limit has stopped the process by then. */
export const STALE_RUN_MS = GENERATION_TIMEOUT_MS + 90_000;
export const STALE_RUN_MESSAGE = "This change did not finish before the server time limit. The run was fully refunded and your saved project was preserved. Retry with a smaller change, or split a whole-site restyle into sections.";

/**
 * Runs whose server process was stopped before settlement (host time limit, crash, deploy):
 * close the run once, return the whole hold, tell the user in the project chat and alert the admin.
 */
export async function reconcileStaleRuns(userId?: string): Promise<number> {
  const stale = await db.agentRun.findMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) }, ...(userId ? { userId } : {}) },
    orderBy: { startedAt: "asc" },
    take: 25,
  });
  let reconciled = 0;
  for (const run of stale) {
    try {
      // Closing first makes concurrent reconcilers skip the run; the refund itself is idempotent too.
      const closed = await db.agentRun.updateMany({ where: { id: run.id, status: "RUNNING" }, data: { status: "FAILED", finishedAt: new Date(), output: STALE_RUN_MESSAGE, creditsUsed: 0 } });
      if (!closed.count) continue;
      const ledger = run.ledgerId
        ? await db.creditLedger.findFirst({ where: { id: run.ledgerId, userId: run.userId } })
        : await db.creditLedger.findFirst({
            // Runs recorded before the ledger link: the hold was written just before the run row.
            where: { userId: run.userId, projectId: run.projectId, reason: `agent:${run.agentId}`, createdAt: { gte: new Date(run.startedAt.getTime() - 15_000), lte: new Date(run.startedAt.getTime() + 15_000) } },
            orderBy: { createdAt: "desc" },
          });
      if (ledger && !/"settlement"/.test(ledger.meta ?? "")) {
        await releaseCredits({ userId: run.userId, ledgerId: ledger.id, hold: Math.max(0, -ledger.delta), keep: 0, note: `${(ledger.note ?? "").replace(/ · running…$/, "")} · stopped by the server time limit, fully refunded` });
      }
      if (run.projectId) await db.message.create({ data: { projectId: run.projectId, role: "assistant", content: STALE_RUN_MESSAGE, agentId: run.agentId } });
      await recordPlatformError(new Error("Generation did not finish before the server time limit; the run was reconciled and refunded afterwards."), {
        source: "generation", userId: run.userId, projectId: run.projectId ?? undefined, runId: run.id,
        details: `Agent: ${run.agentId} · Model: ${run.model ?? "unknown"} · Started: ${run.startedAt.toISOString()}`,
      });
      reconciled++;
    } catch (error) {
      console.error("[stale-runs] Could not reconcile run", run.id, error instanceof Error ? error.message : error);
    }
  }
  return reconciled;
}
