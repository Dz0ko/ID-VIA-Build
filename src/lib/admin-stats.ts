import { requireAdmin } from "./finance";
import { db } from "./db";
import { PLANS, PLAN_ORDER, isPlanId, type PlanId } from "./plans";
import { providerStatus } from "./ai/router";

const DAY = 86_400_000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Last `n` days as YYYY-MM-DD keys, oldest first. */
function lastDays(n: number) {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(today.getTime() - i * DAY)));
  return out;
}

export interface AdminStats {
  generatedAt: string;
  providers: { anthropic: boolean; openai: boolean };
  users: {
    total: number;
    new7d: number;
    new30d: number;
    paid: number;
    admins: number;
    byPlan: { plan: PlanId; name: string; count: number; mrr: number }[];
    mrr: number;
    activeMemberships: number;
    social: { google: number; github: number; password: number };
  };
  projects: { total: number; new7d: number; published: number; apps: number; versions: number; approved: number };
  runs: {
    total: number;
    done: number;
    failed: number;
    creditsAllTime: number;
    costAllTime: number;
    credits30d: number;
    cost30d: number;
    byModel: { model: string; runs: number; credits: number; costUsd: number }[];
    byAgent: { agentId: string; runs: number; credits: number }[];
  };
  credits: { packsGranted: number; packsCount: number; adminGranted: number; refunded: number };
  marketplace: { listings: number; paidListings: number; orders: number; gmvCents: number; feeCents: number; payoutsOwedCents: number; paidOutCents: number };
  daily: { day: string; signups: number; projects: number; runs: number; credits: number; costUsd: number }[];
  recentUsers: { id: string; email: string; name: string | null; plan: string; credits: number; createdAt: Date; projects: number; provider: string }[];
  topUsers: { id: string; email: string; name: string | null; plan: string; credits: number; used: number }[];
}

export async function getAdminStats(): Promise<AdminStats> {
  await requireAdmin();
  const now = Date.now();
  const d7 = new Date(now - 7 * DAY);
  const d14 = new Date(now - 14 * DAY);
  const d30 = new Date(now - 30 * DAY);

  const [
    usersTotal, usersNew7, usersNew30, admins, planGroups, activeMemberships, googleUsers, githubUsers, passwordUsers,
    projectsTotal, projectsNew7, published, apps, versions, approved,
    runsTotal, runsDone, runsFailed, runAgg, runAgg30, byModel, byAgent,
    packs, adminGrants, refunds,
    recentSignups, recentProjects, recentRuns, recentUsers, spenders,
    listings, paidListings, orders, sellerAgg,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: d7 }, role: { not: "ADMIN" } } }),
    db.user.count({ where: { createdAt: { gte: d30 }, role: { not: "ADMIN" } } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.groupBy({ by: ["plan"], _count: true, where: { role: { not: "ADMIN" } } }),
    db.membership.count({ where: { status: "active" } }),
    db.user.count({ where: { googleId: { not: null }, role: { not: "ADMIN" } } }),
    db.user.count({ where: { githubId: { not: null }, role: { not: "ADMIN" } } }),
    db.user.count({ where: { passwordHash: { not: null }, role: { not: "ADMIN" } } }),
    db.project.count(),
    db.project.count({ where: { createdAt: { gte: d7 } } }),
    db.project.count({ where: { status: "PUBLISHED" } }),
    db.project.count({ where: { kind: "app" } }),
    db.version.count(),
    db.project.count({ where: { clientStatus: "APPROVED" } }),
    db.agentRun.count(),
    db.agentRun.count({ where: { status: "DONE" } }),
    db.agentRun.count({ where: { status: "FAILED" } }),
    db.agentRun.aggregate({ _sum: { creditsUsed: true, costUsd: true }, where: { status: "DONE" } }),
    db.agentRun.aggregate({ _sum: { creditsUsed: true, costUsd: true }, where: { status: "DONE", startedAt: { gte: d30 } } }),
    db.agentRun.groupBy({ by: ["model"], _count: true, _sum: { creditsUsed: true, costUsd: true }, where: { status: "DONE" } }),
    db.agentRun.groupBy({ by: ["agentId"], _count: true, _sum: { creditsUsed: true }, where: { status: "DONE" } }),
    db.creditLedger.aggregate({ _sum: { delta: true }, _count: true, where: { reason: "credit_pack" } }),
    db.creditLedger.aggregate({ _sum: { delta: true }, where: { reason: "admin_grant" } }),
    db.creditLedger.aggregate({ _sum: { delta: true }, where: { reason: { startsWith: "refund:" } } }),
    db.user.findMany({ where: { createdAt: { gte: d14 }, role: { not: "ADMIN" } }, select: { createdAt: true } }),
    db.project.findMany({ where: { createdAt: { gte: d14 } }, select: { createdAt: true } }),
    db.agentRun.findMany({ where: { startedAt: { gte: d14 }, status: "DONE" }, select: { startedAt: true, creditsUsed: true, costUsd: true } }),
    db.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, email: true, name: true, plan: true, credits: true, createdAt: true, googleId: true, githubId: true, passwordHash: true, _count: { select: { projects: true } } },
    }),
    db.agentRun.groupBy({ by: ["userId"], _sum: { creditsUsed: true }, where: { status: "DONE" }, orderBy: { _sum: { creditsUsed: "desc" } }, take: 6 }),
    db.marketItem.count({ where: { published: true } }),
    db.marketItem.count({ where: { published: true, price: { gt: 0 } } }),
    db.purchase.aggregate({ _count: true, _sum: { priceCents: true, feeCents: true }, where: { status: "PAID" } }),
    db.user.aggregate({ _sum: { sellerBalanceCents: true, sellerPaidOutCents: true } }),
  ]);

  const byPlan = PLAN_ORDER.map((plan) => {
    const count = planGroups.find((g) => g.plan === plan)?._count ?? 0;
    return { plan, name: PLANS[plan].name, count, mrr: count * PLANS[plan].price };
  });
  const mrr = byPlan.reduce((s, p) => s + p.mrr, 0);
  const paid = byPlan.filter((p) => p.plan !== "FREE").reduce((s, p) => s + p.count, 0);

  const days = lastDays(14);
  const daily = days.map((day) => ({ day, signups: 0, projects: 0, runs: 0, credits: 0, costUsd: 0 }));
  const idx = new Map(days.map((d, i) => [d, i]));
  for (const u of recentSignups) { const i = idx.get(dayKey(u.createdAt)); if (i !== undefined) daily[i].signups++; }
  for (const p of recentProjects) { const i = idx.get(dayKey(p.createdAt)); if (i !== undefined) daily[i].projects++; }
  for (const r of recentRuns) {
    const i = idx.get(dayKey(r.startedAt));
    if (i === undefined) continue;
    daily[i].runs++;
    daily[i].credits += r.creditsUsed;
    daily[i].costUsd += r.costUsd;
  }

  const spenderUsers = spenders.length
    ? await db.user.findMany({ where: { id: { in: spenders.map((s) => s.userId) } }, select: { id: true, email: true, name: true, plan: true, credits: true } })
    : [];

  return {
    generatedAt: new Date().toISOString(),
    providers: providerStatus(),
    users: {
      total: usersTotal,
      new7d: usersNew7,
      new30d: usersNew30,
      paid,
      admins,
      byPlan,
      mrr,
      activeMemberships,
      social: { google: googleUsers, github: githubUsers, password: passwordUsers },
    },
    projects: { total: projectsTotal, new7d: projectsNew7, published, apps, versions, approved },
    runs: {
      total: runsTotal,
      done: runsDone,
      failed: runsFailed,
      creditsAllTime: runAgg._sum.creditsUsed ?? 0,
      costAllTime: runAgg._sum.costUsd ?? 0,
      credits30d: runAgg30._sum.creditsUsed ?? 0,
      cost30d: runAgg30._sum.costUsd ?? 0,
      byModel: byModel
        .map((m) => ({ model: m.model ?? "unknown", runs: m._count, credits: m._sum.creditsUsed ?? 0, costUsd: m._sum.costUsd ?? 0 }))
        .sort((a, b) => b.credits - a.credits),
      byAgent: byAgent
        .map((a) => ({ agentId: a.agentId, runs: a._count, credits: a._sum.creditsUsed ?? 0 }))
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 8),
    },
    credits: {
      packsGranted: packs._sum.delta ?? 0,
      packsCount: packs._count,
      adminGranted: adminGrants._sum.delta ?? 0,
      refunded: refunds._sum.delta ?? 0,
    },
    marketplace: {
      listings,
      paidListings,
      orders: orders._count,
      gmvCents: orders._sum.priceCents ?? 0,
      feeCents: orders._sum.feeCents ?? 0,
      payoutsOwedCents: sellerAgg._sum.sellerBalanceCents ?? 0,
      paidOutCents: sellerAgg._sum.sellerPaidOutCents ?? 0,
    },
    daily,
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      plan: isPlanId(u.plan) ? u.plan : "FREE",
      credits: u.credits,
      createdAt: u.createdAt,
      projects: u._count.projects,
      provider: u.googleId ? "google" : u.githubId ? "github" : u.passwordHash ? "email" : "—",
    })),
    topUsers: spenders.map((s) => {
      const u = spenderUsers.find((x) => x.id === s.userId);
      return { id: s.userId, email: u?.email ?? s.userId, name: u?.name ?? null, plan: u?.plan ?? "FREE", credits: u?.credits ?? 0, used: s._sum.creditsUsed ?? 0 };
    }),
  };
}
