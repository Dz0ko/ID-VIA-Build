import Link from "next/link";
import type { AdminStats } from "@/lib/admin-stats";
import { PLANS } from "@/lib/plans";

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
const num = (n: number) => n.toLocaleString();

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${tone === "good" ? "text-success" : tone === "bad" ? "text-error" : ""}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ash">{sub}</div>}
    </div>
  );
}

/** Single-series bar sparkline: one hue (signal) encodes magnitude; labels carry the identity. */
function Bars({ title, data, format = num, total }: { title: string; data: { day: string; value: number }[]; format?: (n: number) => string; total: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-ash">{total}</div>
      </div>
      <div className="mt-3 flex items-end gap-[3px] h-20" role="img" aria-label={`${title}, last ${data.length} days`}>
        {data.map((d) => (
          <div key={d.day} className="flex-1 h-full flex items-end group relative">
            <div className="w-full rounded-t-[3px] bg-signal/70 group-hover:bg-signal transition-colors" style={{ height: `${Math.max(d.value > 0 ? 6 : 2, (d.value / max) * 100)}%` }} />
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-paper px-1.5 py-0.5 text-[10px] text-void opacity-0 group-hover:opacity-100">{d.day.slice(5)} · {format(d.value)}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ash"><span>{data[0]?.day.slice(5)}</span><span>today</span></div>
    </div>
  );
}

export function AdminOverview({ s }: { s: AdminStats }) {
  const margin = s.runs.creditsAllTime > 0 ? s.runs.costAllTime / s.runs.creditsAllTime : 0;
  const planMax = Math.max(1, ...s.users.byPlan.map((p) => p.count));
  const modelMax = Math.max(1, ...s.runs.byModel.map((m) => m.credits));
  const agentMax = Math.max(1, ...s.runs.byAgent.map((a) => a.credits));

  return (
    <div className="space-y-8">
      {/* Headline numbers */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Users" value={num(s.users.total)} sub={`+${s.users.new7d} this week · +${s.users.new30d} in 30 days`} />
        <Stat label="Paying customers" value={num(s.users.paid)} sub={`${s.users.activeMemberships} active Whop memberships · ${s.users.total ? Math.round((s.users.paid / s.users.total) * 100) : 0}% conversion`} />
        <Stat label="MRR (plan list prices)" value={usd(s.users.mrr)} sub={`ARR ${usd(s.users.mrr * 12)}`} tone={s.users.mrr > 0 ? "good" : undefined} />
        <Stat label="AI cost, 30 days" value={usd(s.runs.cost30d)} sub={`${num(s.runs.credits30d)} credits · ${s.runs.credits30d ? (s.runs.cost30d / s.runs.credits30d * 100).toFixed(2) : "0"}¢ per credit`} />
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Projects" value={num(s.projects.total)} sub={`+${s.projects.new7d} this week · ${s.projects.apps} React apps`} />
        <Stat label="Published" value={num(s.projects.published)} sub={`${s.projects.approved} client-approved · ${num(s.projects.versions)} versions saved`} />
        <Stat label="Agent runs" value={num(s.runs.total)} sub={`${num(s.runs.done)} done · ${num(s.runs.failed)} failed`} tone={s.runs.failed > s.runs.done / 10 && s.runs.total > 10 ? "bad" : undefined} />
        <Stat label="Cost per credit, all time" value={`${(margin * 100).toFixed(2)}¢`} sub={`${num(s.runs.creditsAllTime)} credits · ${usd(s.runs.costAllTime)} spent on models`} tone={margin > 0.013 ? "bad" : margin > 0 ? "good" : undefined} />
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Marketplace GMV" value={usd(s.marketplace.gmvCents / 100)} sub={`${s.marketplace.orders} paid orders · ${s.marketplace.paidListings} paid of ${s.marketplace.listings} listings`} />
        <Stat label="Marketplace fees earned" value={usd(s.marketplace.feeCents / 100)} sub="5% of every sale" tone={s.marketplace.feeCents > 0 ? "good" : undefined} />
        <Stat label="Seller payouts owed" value={usd(s.marketplace.payoutsOwedCents / 100)} sub={`${usd(s.marketplace.paidOutCents / 100)} paid out so far`} tone={s.marketplace.payoutsOwedCents > 0 ? "bad" : undefined} />
        <Stat label="Whop payments" value={process.env.WHOP_API_KEY && process.env.WHOP_COMPANY_ID ? "connected" : "not configured"} sub="WHOP_API_KEY + WHOP_COMPANY_ID for marketplace checkout" />
      </section>

      {/* Trends */}
      <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Bars title="Signups" data={s.daily.map((d) => ({ day: d.day, value: d.signups }))} total={`${s.daily.reduce((a, d) => a + d.signups, 0)} in 14 days`} />
        <Bars title="Projects created" data={s.daily.map((d) => ({ day: d.day, value: d.projects }))} total={`${s.daily.reduce((a, d) => a + d.projects, 0)} in 14 days`} />
        <Bars title="Credits spent" data={s.daily.map((d) => ({ day: d.day, value: d.credits }))} total={`${num(s.daily.reduce((a, d) => a + d.credits, 0))} credits`} />
        <Bars title="AI cost" data={s.daily.map((d) => ({ day: d.day, value: d.costUsd }))} format={usd} total={usd(s.daily.reduce((a, d) => a + d.costUsd, 0))} />
      </section>

      {/* Plans + models */}
      <section className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-baseline justify-between"><div className="text-sm font-medium">Plans</div><div className="text-xs text-ash">users · MRR</div></div>
          <ul className="mt-3 space-y-2.5">
            {s.users.byPlan.map((p) => (
              <li key={p.plan}>
                <div className="flex justify-between text-xs"><span>{p.name} <span className="text-ash">${PLANS[p.plan].price}/mo</span></span><span className="font-mono">{p.count} · {usd(p.mrr)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-graphite overflow-hidden"><div className="h-full rounded-full bg-signal" style={{ width: `${(p.count / planMax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-graphite grid grid-cols-3 gap-2 text-center text-xs">
            <div><div className="label">Google</div><div className="mt-0.5 font-mono">{s.users.social.google}</div></div>
            <div><div className="label">GitHub</div><div className="mt-0.5 font-mono">{s.users.social.github}</div></div>
            <div><div className="label">Email</div><div className="mt-0.5 font-mono">{s.users.social.password}</div></div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-baseline justify-between"><div className="text-sm font-medium">Models</div><div className="text-xs text-ash">credits · cost</div></div>
          <ul className="mt-3 space-y-2.5">
            {s.runs.byModel.length === 0 && <li className="text-xs text-ash">No runs yet.</li>}
            {s.runs.byModel.map((m) => (
              <li key={m.model}>
                <div className="flex justify-between text-xs gap-2"><span className="font-mono truncate">{m.model}</span><span className="font-mono shrink-0">{num(m.credits)} · {usd(m.costUsd)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-graphite overflow-hidden"><div className="h-full rounded-full bg-signal" style={{ width: `${(m.credits / modelMax) * 100}%` }} /></div>
                <div className="mt-0.5 text-[10px] text-ash">{m.runs} runs · {m.credits ? (m.costUsd / m.credits * 100).toFixed(2) : "0"}¢ per credit</div>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-graphite text-xs flex justify-between">
            <span>Anthropic <span className={s.providers.anthropic ? "text-success" : "text-ash"}>{s.providers.anthropic ? "on" : "off"}</span></span>
            <span>OpenAI <span className={s.providers.openai ? "text-success" : "text-ash"}>{s.providers.openai ? "on" : "off"}</span></span>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-baseline justify-between"><div className="text-sm font-medium">Top agents</div><div className="text-xs text-ash">credits</div></div>
          <ul className="mt-3 space-y-2.5">
            {s.runs.byAgent.length === 0 && <li className="text-xs text-ash">No runs yet.</li>}
            {s.runs.byAgent.map((a) => (
              <li key={a.agentId}>
                <div className="flex justify-between text-xs"><span className="capitalize">{a.agentId}</span><span className="font-mono">{a.runs} runs · {num(a.credits)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-graphite overflow-hidden"><div className="h-full rounded-full bg-signal" style={{ width: `${(a.credits / agentMax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-graphite grid grid-cols-3 gap-2 text-center text-xs">
            <div><div className="label">Packs sold</div><div className="mt-0.5 font-mono">{s.credits.packsCount}</div></div>
            <div><div className="label">Pack credits</div><div className="mt-0.5 font-mono">{num(s.credits.packsGranted)}</div></div>
            <div><div className="label">Refunded</div><div className="mt-0.5 font-mono">{num(s.credits.refunded)}</div></div>
          </div>
        </div>
      </section>

      {/* People */}
      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Latest signups</div>
          <table className="w-full text-xs">
            <tbody>
              {s.recentUsers.map((u) => (
                <tr key={u.id} className="border-b border-graphite/60">
                  <td className="p-3"><div className="truncate max-w-[220px]">{u.name ?? u.email}</div><div className="text-ash truncate max-w-[220px]">{u.email}</div></td>
                  <td className="p-3"><span className="pill text-[10px]">{PLANS[u.plan as keyof typeof PLANS]?.name ?? u.plan}</span></td>
                  <td className="p-3 text-ash">{u.provider}</td>
                  <td className="p-3 font-mono">{u.projects} proj</td>
                  <td className="p-3 text-ash text-right whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {s.recentUsers.length === 0 && <tr><td className="p-4 text-ash">No users yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Heaviest users (credits spent)</div>
          <table className="w-full text-xs">
            <tbody>
              {s.topUsers.map((u) => (
                <tr key={u.id} className="border-b border-graphite/60">
                  <td className="p-3"><div className="truncate max-w-[220px]">{u.name ?? u.email}</div><div className="text-ash truncate max-w-[220px]">{u.email}</div></td>
                  <td className="p-3"><span className="pill text-[10px]">{PLANS[u.plan as keyof typeof PLANS]?.name ?? u.plan}</span></td>
                  <td className="p-3 font-mono">{num(u.used)} used</td>
                  <td className="p-3 font-mono text-ash text-right">{num(u.credits)} left</td>
                </tr>
              ))}
              {s.topUsers.length === 0 && <tr><td className="p-4 text-ash">No usage yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-ash">MRR counts each paying user at the list price of their plan; Whop is the source of truth for actual charges. Snapshot {new Date(s.generatedAt).toLocaleString()} · <Link href="/admin" className="underline">refresh</Link></p>
    </div>
  );
}
