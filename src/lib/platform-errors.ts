import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { InsufficientCredits } from "./credits";
import { ProjectBusyError } from "./project-lock";
import { RuntimeCapacityError } from "./runtime-capacity";
import { diagnosePlatformError, expectedOperationalError, redactIncidentText } from "./platform-error-details";

export type IncidentContext = { source: string; userId?: string; projectId?: string; runId?: string; route?: string; details?: string; secrets?: string[] };
const recorded = new WeakSet<object>();

/** Best-effort, awaited persistence. Monitoring must never replace the original operation's error. */
export async function recordPlatformError(error: unknown, context: IncidentContext): Promise<string | null> {
  if (error instanceof InsufficientCredits || error instanceof ProjectBusyError || error instanceof RuntimeCapacityError || expectedOperationalError(error)) return null;
  if (error && typeof error === "object" && recorded.has(error)) return null;
  try {
    const secrets = [...(context.secrets ?? []), ...Object.entries(process.env).filter(([key]) => /SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL|DIRECT_URL/i.test(key)).map(([, value]) => value || "")];
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code.slice(0, 50) : "";
    const prismaError = error instanceof Error && (/Prisma/.test(error.name + error.constructor.name) || /^P\d{4}$/.test(code));
    const message = prismaError ? `Database operation failed (${code || 'Prisma error'}). Check server logs and schema.` : error instanceof Error ? error.message : typeof error === "string" ? error : "Unexpected operation failure";
    const safeMessage = redactIncidentText(message + (context.details ? `\n${context.details}` : ""), secrets);
    const diagnosis = diagnosePlatformError(context.source, safeMessage);
    const route = context.route?.split(/[?#]/)[0].slice(0, 200);
    // Keep stack frames only: error objects may contain HTTP requests, provider bodies or Prisma arguments.
    const stack = error instanceof Error ? redactIncidentText((error.stack || "").split("\n").filter(line => /^\s*at /.test(line)).slice(0, 12).join("\n"), secrets) : "";
    const signature = diagnosis.code === "UNEXPECTED_ERROR" || diagnosis.code === "BROWSER_ERROR" ? safeMessage.slice(0, 250).replace(/\b[0-9a-f]{12,}\b|\b\d+\b/gi, "#") : diagnosis.code;
    const fingerprint = createHash("sha256").update(JSON.stringify([context.source, diagnosis.code, context.userId || "", context.projectId || "", signature])).digest("hex");
    const now = new Date();
    const data = { source: context.source.slice(0, 60), ...diagnosis, steps: JSON.stringify(diagnosis.steps), message: safeMessage, stack: stack || null, userId: context.userId, projectId: context.projectId, runId: context.runId, route, release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40), lastSeenAt: now };
    const row = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`incident:${fingerprint}`}))`;
      const previous = await tx.platformIncident.findUnique({ where: { fingerprint }, select: { status: true } });
      return tx.platformIncident.upsert({ where: { fingerprint }, create: { fingerprint, ...data }, update: { ...data, occurrences: { increment: 1 }, revision: { increment: 1 }, ...(previous?.status === "RESOLVED" ? { status: "NEW", resolvedAt: null } : {}) }, select: { id: true } });
    }, { maxWait: 1500, timeout: 3000 });
    if (error && typeof error === "object") recorded.add(error);
    return row.id;
  } catch {
    // If the database itself is down, the hosting log is the fallback. Never log raw customer data here.
    console.error("[platform-monitor] Could not persist incident; check hosting logs and database availability.", { source: context.source.slice(0, 60) });
    return null;
  }
}
