import { db } from "./db";
import { getCurrentUser } from "./auth";
import { profitSummary } from "./payment-math";

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("Admin access required");
  return user;
}

export async function getFinanceStats(period: "all" | "30d" = "all") {
  await requireAdmin();
  const since = period === "30d" ? new Date(Date.now() - 30 * 86400000) : undefined;
  const [payments, runs, expense, expenses, users, legacyEvents, first] = await Promise.all([
    db.payment.findMany({ where: { paidAt: since ? { gte: since } : undefined } }),
    db.agentRun.groupBy({ by: ["userId"], _sum: { costUsd: true, creditsUsed: true }, _count: true, where: { startedAt: since ? { gte: since } : undefined } }),
    db.financialExpense.aggregate({ _sum: { amountCents: true }, where: { incurredAt: since ? { gte: since } : undefined } }),
    db.financialExpense.findMany({ where: { incurredAt: since ? { gte: since } : undefined }, orderBy: { incurredAt: "desc" }, take: 20 }),
    db.user.findMany({ select: { id: true, email: true, name: true } }),
    db.webhookEvent.count({ where: { type: "payment.succeeded", NOT: { payload: { contains: '"processed":true' } } } }),
    db.payment.findFirst({ orderBy: { paidAt: "asc" }, select: { paidAt: true } }),
  ]);
  const empty = () => ({ grossCents: 0, returnedCents: 0, feeCents: 0, sellerCents: 0, referralCents: 0, affiliateCents: 0, aiCostCents: 0, expensesCents: 0 });
  const totals = empty();
  const rows = new Map<string, ReturnType<typeof empty> & { id: string; email: string; unknownFees: number; credits: number }>();
  const row = (id: string) => {
    if (!rows.has(id)) rows.set(id, { ...empty(), id, email: users.find((u) => u.id === id)?.email ?? "Deleted account", unknownFees: 0, credits: 0 });
    return rows.get(id)!;
  };
  let unknownFees = 0;
  for (const p of payments) {
    const u = row(p.userId);
    const amounts = { grossCents: p.grossCents, returnedCents: Math.min(p.grossCents, Math.max(p.refundedCents, p.disputedCents)), feeCents: p.feeCents ?? 0, sellerCents: p.sellerCents, referralCents: p.referralCommissionCents, affiliateCents: p.affiliateCommissionCents };
    for (const key of Object.keys(amounts) as (keyof typeof amounts)[]) { totals[key] += amounts[key]; u[key] += amounts[key]; }
    if (p.feeCents === null) { unknownFees++; u.unknownFees++; }
  }
  for (const r of runs) {
    const cost = (r._sum.costUsd ?? 0) * 100;
    row(r.userId).aiCostCents += cost;
    row(r.userId).credits += r._sum.creditsUsed ?? 0;
    totals.aiCostCents += cost;
  }
  totals.expensesCents = expense._sum.amountCents ?? 0;
  return { ...profitSummary(totals), period, unknownFees, legacyEvents, firstPaymentAt: first?.paidAt ?? null, payments: payments.length, expenses, users: [...rows.values()].map((u) => ({ ...u, ...profitSummary(u) })).sort((a, b) => b.grossCents - a.grossCents) };
}
export type FinanceStats = Awaited<ReturnType<typeof getFinanceStats>>;
