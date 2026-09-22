import { getFinanceStats } from "@/lib/finance";
import { FinancePanel } from "@/components/admin/FinancePanel";
import { db } from "@/lib/db";
import { PLANS, PLAN_ORDER, isPlanId, CREDIT_PACKS } from "@/lib/plans";
import { whopConfigured } from "@/lib/whop";
import { whopPaymentsConfigured } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const period = (await searchParams).period === "30d" ? "30d" : "all";
  const finance = await getFinanceStats(period);
  const [planGroups, memberships, packs, webhooks, upgrades] = await Promise.all([
    db.user.groupBy({ by: ["plan"], _count: true }),
    db.membership.findMany({ orderBy: { updatedAt: "desc" }, take: 100, include: { user: { select: { email: true, name: true } } } }),
    db.creditLedger.findMany({ where: { reason: "credit_pack" }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { email: true } } } }),
    db.webhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    db.creditLedger.findMany({ where: { reason: { startsWith: "upgrade:" } }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { email: true } } } }),
  ]);
  const byPlan = PLAN_ORDER.map((p) => ({ plan: p, count: planGroups.find((g) => g.plan === p)?._count ?? 0 }));
  const mrr = byPlan.reduce((s, p) => s + p.count * PLANS[p.plan].price, 0);
  const active = memberships.filter((m) => m.status === "active").length;
  const packRevenue = packs.reduce((s, p) => s + (CREDIT_PACKS.find((c) => c.credits === p.delta)?.price ?? 0), 0);

  return (
    <div className="space-y-6">
      <FinancePanel stats={finance} />
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><div className="label">MRR (list prices)</div><div className="mt-1 text-2xl font-semibold">{usd(mrr)}</div><div className="text-[11px] text-ash">ARR {usd(mrr * 12)}</div></div>
        <div className="card p-4"><div className="label">Active subscriptions</div><div className="mt-1 text-2xl font-semibold">{active}</div><div className="text-[11px] text-ash">{memberships.length - active} inactive</div></div>
        <div className="card p-4"><div className="label">Credit packs sold</div><div className="mt-1 text-2xl font-semibold">{packs.length}</div><div className="text-[11px] text-ash">≈ {usd(packRevenue)} at list price</div></div>
        <div className="card p-4"><div className="label">Whop</div><div className="mt-1 text-sm">Billing webhook: <span className={whopConfigured() ? "text-success" : "text-ash"}>{whopConfigured() ? "configured" : "not configured"}</span></div><div className="text-sm">Marketplace API: <span className={whopPaymentsConfigured() ? "text-success" : "text-ash"}>{whopPaymentsConfigured() ? "connected" : "not configured"}</span></div></div>
      </section>

      <section className="card p-4">
        <div className="text-sm font-medium">Revenue by plan</div>
        <table className="w-full text-xs mt-3">
          <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-2 font-medium">Plan</th><th className="text-left p-2 font-medium">Price</th><th className="text-left p-2 font-medium">Users</th><th className="text-left p-2 font-medium">MRR</th><th className="text-left p-2 font-medium">Share</th></tr></thead>
          <tbody>
            {byPlan.map((p) => (
              <tr key={p.plan} className="border-b border-graphite/60">
                <td className="p-2">{PLANS[p.plan].name}</td><td className="p-2 font-mono">${PLANS[p.plan].price}/mo</td><td className="p-2 font-mono">{p.count}</td><td className="p-2 font-mono">{usd(p.count * PLANS[p.plan].price)}</td>
                <td className="p-2"><div className="h-1.5 rounded-full bg-graphite overflow-hidden w-40"><div className="h-full bg-signal rounded-full" style={{ width: `${mrr ? (p.count * PLANS[p.plan].price / mrr) * 100 : 0}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Subscriptions (Whop memberships)</div>
          <table className="w-full text-xs">
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-b border-graphite/60">
                  <td className="p-3"><div>{m.user.name ?? m.user.email}</div><div className="text-ash">{m.user.email}</div></td>
                  <td className="p-3"><span className="pill text-[10px]">{isPlanId(m.plan) ? PLANS[m.plan].name : m.plan}</span></td>
                  <td className="p-3"><span className={m.status === "active" ? "text-success" : "text-ash"}>{m.status}</span></td>
                  <td className="p-3 text-ash text-right whitespace-nowrap">{new Date(m.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {memberships.length === 0 && <tr><td className="p-4 text-ash">No Whop memberships yet. Plans changed with the dev switcher do not create memberships.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Credit pack purchases</div>
          <table className="w-full text-xs">
            <tbody>
              {packs.map((p) => (
                <tr key={p.id} className="border-b border-graphite/60">
                  <td className="p-3">{p.user.email}</td>
                  <td className="p-3 font-mono">+{p.delta.toLocaleString()} cr</td>
                  <td className="p-3 font-mono">{CREDIT_PACKS.find((c) => c.credits === p.delta) ? usd(CREDIT_PACKS.find((c) => c.credits === p.delta)!.price) : "custom"}</td>
                  <td className="p-3 text-ash text-right whitespace-nowrap">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {packs.length === 0 && <tr><td className="p-4 text-ash">No credit packs sold yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Plan upgrades (credits granted)</div>
          <table className="w-full text-xs">
            <tbody>
              {upgrades.map((u) => (
                <tr key={u.id} className="border-b border-graphite/60"><td className="p-3">{u.user.email}</td><td className="p-3 font-mono">{u.reason.replace("upgrade:", "")}</td><td className="p-3 font-mono">+{u.delta.toLocaleString()} cr</td><td className="p-3 text-ash text-right whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td></tr>
              ))}
              {upgrades.length === 0 && <tr><td className="p-4 text-ash">No paid upgrades yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Webhook log (last 40)</div>
          <table className="w-full text-xs">
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id} className="border-b border-graphite/60"><td className="p-3 font-mono">{w.type}</td><td className="p-3 text-ash font-mono truncate max-w-[200px]">{w.id}</td><td className="p-3 text-ash text-right whitespace-nowrap">{new Date(w.createdAt).toLocaleString()}</td></tr>
              ))}
              {webhooks.length === 0 && <tr><td className="p-4 text-ash">No webhooks received yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
