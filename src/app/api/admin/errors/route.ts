import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { readRequestJson } from "@/lib/request-body";
import { redactIncidentText } from "@/lib/platform-error-details";

export async function GET(req: Request) {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const params = new URL(req.url).searchParams;
    const status = params.get("status") || "OPEN", area = params.get("area"), query = (params.get("q") || "").slice(0, 100);
    const page = Math.max(1, Math.min(1000, Math.floor(Number(params.get("page")) || 1)));
    const open: Prisma.PlatformIncidentWhereInput = { status: { in: ["NEW", "INVESTIGATING"] } };
    const [openCount, criticalCount, last24Hours] = await Promise.all([
      db.platformIncident.count({ where: open }),
      db.platformIncident.count({ where: { ...open, severity: "CRITICAL" } }),
      db.platformIncident.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 86400000) } } }),
    ]);
    if (params.get("summary") === "1") return json({ openCount, criticalCount, last24Hours });
    const matches = query ? await db.user.findMany({ where: { OR: [{ email: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] }, select: { id: true }, take: 100 }) : [];
    const where: Prisma.PlatformIncidentWhereInput = {
      ...(status === "OPEN" ? open : ["NEW", "INVESTIGATING", "RESOLVED"].includes(status) ? { status } : {}),
      ...(["PLATFORM", "PROVIDER", "PROJECT", "UNKNOWN"].includes(area || "") ? { area: area! } : {}),
      ...(query ? { OR: [{ id: query }, { projectId: query }, { title: { contains: query, mode: "insensitive" } }, { code: { contains: query, mode: "insensitive" } }, { userId: { in: matches.map(m => m.id) } }] } : {}),
    };
    const [rows, total] = await Promise.all([db.platformIncident.findMany({ where, orderBy: { lastSeenAt: "desc" }, skip: (page - 1) * 30, take: 30 }), db.platformIncident.count({ where })]);
    const [users, projects] = await Promise.all([
      db.user.findMany({ where: { id: { in: rows.flatMap(r => r.userId ? [r.userId] : []) } }, select: { id: true, name: true, email: true } }),
      db.project.findMany({ where: { id: { in: rows.flatMap(r => r.projectId ? [r.projectId] : []) } }, select: { id: true, name: true } }),
    ]);
    return json({ incidents: rows.map(row => ({ ...row, steps: JSON.parse(row.steps), user: users.find(u => u.id === row.userId) || null, project: projects.find(p => p.id === row.projectId) || null })), total, page, openCount, criticalCount, last24Hours, checkedAt: new Date().toISOString() });
  });
}
const update = z.object({ id: z.string().max(64), status: z.enum(["NEW", "INVESTIGATING", "RESOLVED"]), revision: z.number().int().positive(), note: z.string().max(2000) });
export async function PATCH(req: Request) {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const parsed = update.safeParse(await readRequestJson(req, 12000).catch(() => null));
    if (!parsed.success) return error("Invalid incident update.");
    const { id, status, revision, note } = parsed.data;
    const changed = await db.platformIncident.updateMany({ where: { id, revision }, data: { status, revision: { increment: 1 }, note: redactIncidentText(note), updatedById: user.id, resolvedAt: status === "RESOLVED" ? new Date() : null } });
    if (!changed.count) return error("This incident changed or occurred again. Refresh and review the latest details before updating it.", 409);
    return json({ ok: true });
  });
}
