import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { CREDIT_PACKS, PLANS, PLAN_ORDER } from "@/lib/plans";
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
      <main className="max-w-6xl mx-auto px-6 py-20">
        <p className="label">Pricing</p>
        <h1 className="heading mt-3">Pick the plan that fits how you build.</h1>
        <p className="mt-4 text-fog max-w-2xl">Every plan includes the AI builder, live preview, templates and IDÆVIA hosting. Higher plans unlock more agents, stronger model tiers and more credits.</p>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-5 gap-4">
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
          <div className="label">Credit top-ups</div>
          <div className="mt-4 grid sm:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((c) => (
              <div key={c.credits} className="border border-graphite rounded-xl p-4">
                <div className="text-2xl font-semibold">{c.credits.toLocaleString()}</div>
                <div className="text-xs text-ash">credits</div>
                <div className="mt-2 text-sm">${c.price}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ash">Credits measure AI usage: a small edit costs 2–5 credits, building a full page 30–60, a full-stack feature 240+. Pro and above roll over 25% of unused credits.</p>
        </div>
      </main>
    </div>
  );
}
