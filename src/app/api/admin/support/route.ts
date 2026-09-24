import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { supportTier } from "@/lib/support-tier";
import { canManageSupport } from "@/lib/support-access";
export async function GET(req: Request) {
  return withUser(async user => {
    if (!canManageSupport(user.role)) return error("Support staff access required.", 403);
    const params = new URL(req.url).searchParams;
    const status = params.get("status"), tier = params.get("tier");
    const query = (params.get("q") ?? "").slice(0, 100);
    const page = Math.min(10000, Math.max(1, Math.floor(Number(params.get("page")) || 1)));
    const base = { ...(status && ["BOT", "WAITING", "HUMAN", "CLOSED"].includes(status) ? { status } : {}), ...(query ? { user: { OR: [{ email: { contains: query, mode: "insensitive" as const } }, { name: { contains: query, mode: "insensitive" as const } }] } } : {}) };
    // Use the current server-side subscription, including upgrades and downgrades.
    const groups = [{ tier: "premium", plans: ["MAX", "AGENCY"] }, { tier: "priority", plans: ["PRO"] }, { tier: "standard", plans: ["FREE", "STARTER"] }].filter(group => !tier || group.tier === tier);
    const counts = await Promise.all(groups.map(group => db.supportThread.count({ where: { AND: [base, { user: { plan: { in: group.plans } } }] } })));
    let skip = (page - 1) * 30, remaining = 30;
    const threads = [];
    for (let i = 0; i < groups.length && remaining; i++) {
      if (skip >= counts[i]) { skip -= counts[i]; continue; }
      const rows = await db.supportThread.findMany({ where: { AND: [base, { user: { plan: { in: groups[i].plans } } }] }, orderBy: [{ updatedAt: status === "WAITING" ? "asc" : "desc" }, { id: "asc" }], skip, take: remaining, select: { id: true, status: true, assignedTo: true, updatedAt: true, user: { select: { name: true, email: true, plan: true } }, messages: { orderBy: { id: "desc" }, take: 1, select: { content: true, role: true } } } });
      threads.push(...rows.map(row => ({ ...row, supportTier: supportTier(row.user.plan) }))); remaining -= rows.length; skip = 0;
    }
    return json({ threads, total: counts.reduce((sum, count) => sum + count, 0), page });
  });
}
