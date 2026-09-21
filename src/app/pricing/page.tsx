import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { CREDIT_GUIDE, CREDIT_PACKS, PLANS, PLAN_ORDER, packSavingsPct } from "@/lib/plans";
import { agentsForPlan } from "@/lib/agents";

export default async function Pricing() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-graphite">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link href={user ? "/app" : "/signup"} className="btn btn-primary btn-sm">{user ? "Open workspace" : "Start free"}</Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-5 sm:px-6 py-12 md:py-20">
        <p className="label">Pricing</p>
        <h1 className="heading mt-3">Pick the plan that fits how you build.</h1>
        <p className="mt-4 text-fog max-w-2xl">Every plan includes the AI builder, live preview, templates and IDÆVIA hosting. Higher plans unlock more agents, stronger model tiers and more credits.</p>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const agents = agentsForPlan(id);
            const featured = id === "PRO";
            return (
              <div key={id} className={`card p-6 flex flex-col ${featured ? "border-signal" : ""}`}>
                {featured && <span className="pill self-start border-signal text-signal-soft mb-3">Most popular</span>}
                {p.discountPct && <span className="pill self-start border-success/40 text-success mb-3">Save {p.discountPct}%</span>}
                <div className="text-sm font-medium">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-tight">${p.price}</span>
                  <span className="text-sm text-ash">/mo</span>
                  {p.listPrice && <span className="text-sm text-ash line-through">${p.listPrice}</span>}
                </div>
                <div className="mt-1 text-xs text-ash">{p.tagline}</div>
                <ul className="mt-5 space-y-2 text-sm text-fog flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2"><span className="text-signal-soft">✓</span>{f}</li>
                  ))}
                </ul>
                <div className="mt-4 text-xs text-ash">{agents.length} agents · up to {p.maxTier} tier</div>
                {id === "FREE" ? (
                  <Link href={user ? "/app" : "/signup"} className="btn btn-outline mt-5">Get started</Link>
                ) : (
                  <Link href={`/api/billing/checkout?plan=${id}`} className={`btn mt-5 ${featured ? "btn-signal" : "btn-primary"}`}>Choose {p.name}</Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-16 card p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <div className="label">Credit top-ups</div>
              <h2 className="mt-2 text-lg font-medium">Need more this month? Add a pack. Bigger packs cost less per credit.</h2>
            </div>
            <div className="text-xs text-ash">Available on every paid plan · credits never expire while your plan is active</div>
          </div>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((c, i) => {
              const save = packSavingsPct(c);
              const perCredit = ((c.price / c.credits) * 100).toFixed(1);
              return (
                <div key={c.credits} className={`border rounded-xl p-5 flex flex-col ${i === 2 ? "border-signal" : "border-graphite"}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-semibold">{c.credits.toLocaleString()} <span className="text-sm text-ash font-normal">credits</span></div>
                    {save > 0 && <span className="pill border-success/40 text-success text-[10px]">Save {save}%</span>}
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight">${c.price}</div>
                  <div className="mt-1 text-xs text-ash">{perCredit}¢ per credit</div>
                  <ul className="mt-4 space-y-1.5 text-xs text-fog flex-1">
                    <li>≈ {Math.round(c.credits / CREDIT_GUIDE.page)} full pages</li>
                    <li>≈ {Math.round(c.credits / CREDIT_GUIDE.smallEdit)} small edits</li>
                    <li>≈ {Math.max(1, Math.round(c.credits / CREDIT_GUIDE.fullstack))} full-stack features</li>
                  </ul>
                  <Link href={`/api/billing/pack?credits=${c.credits}`} className={`btn btn-sm mt-4 ${i === 2 ? "btn-primary" : "btn-outline"}`}>Buy {c.credits.toLocaleString()} credits</Link>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-ash">Credits measure what the agents do: a small edit costs about {CREDIT_GUIDE.smallEdit} credits, a full page about {CREDIT_GUIDE.page}, a full-stack feature about {CREDIT_GUIDE.fullstack}. Pro and above roll over 25% of unused plan credits.</p>
        </div>
      </main>
    </div>
  );
}
