import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PLANS, CREDIT_PACKS } from "@/lib/plans";
import { checkoutUrl, whopConfigured } from "@/lib/whop";
import { providerStatus } from "@/lib/ai/router";
import { PageHeader } from "@/components/app/PageHeader";
import { PlanSwitcher } from "@/components/app/PlanSwitcher";

export default async function Settings({ searchParams }: PageProps<"/app/settings">) {
  const user = await requireUser();
  const sp = await searchParams;
  const ledger = await db.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  const memberships = await db.membership.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  const whop = whopConfigured();
  const providers = providerStatus();
  const plan = PLANS[user.plan];

  return (
    <>
      <PageHeader title="Settings & billing" subtitle={user.email} />
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {sp.error === "checkout_not_configured" && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">Checkout link for plan {String(sp.plan)} is not configured. Set <code className="font-mono">WHOP_CHECKOUT_{String(sp.plan)}</code> in .env.</div>
        )}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Plan</h2>
            <span className="text-xs text-ash">{whop ? "Billing by Whop" : "Whop not configured: dev switching enabled"}</span>
          </div>
          <PlanSwitcher current={user.plan} whopEnabled={whop} checkout={{ STARTER: checkoutUrl("STARTER"), PRO: checkoutUrl("PRO"), MAX: checkoutUrl("MAX"), AGENCY: checkoutUrl("AGENCY") }} />
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="label">Credits</div>
            <div className="text-3xl font-semibold mt-1">{user.credits.toLocaleString()}</div>
            <div className="text-xs text-ash">of {plan.credits.toLocaleString()} monthly · resets {new Date(new Date(user.creditsResetAt).setMonth(new Date(user.creditsResetAt).getMonth() + 1)).toLocaleDateString()}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {CREDIT_PACKS.map((c) => <div key={c.credits} className="border border-graphite rounded-lg p-2 text-xs"><div className="font-medium">{c.credits.toLocaleString()} cr</div><div className="text-ash">${c.price}</div></div>)}
            </div>
            <p className="text-[11px] text-ash mt-2">Top-ups are sold as Whop products; the webhook grants credits from <code className="font-mono">metadata.credits</code>.</p>
          </div>
          <div className="card p-5">
            <div className="label">AI providers</div>
            <ul className="mt-2 text-sm space-y-1">
              <li className="flex justify-between"><span>Anthropic (Claude)</span><span className={providers.anthropic ? "text-success" : "text-ash"}>{providers.anthropic ? "connected" : "no key"}</span></li>
              <li className="flex justify-between"><span>OpenAI</span><span className={providers.openai ? "text-success" : "text-ash"}>{providers.openai ? "connected" : "no key"}</span></li>
              <li className="flex justify-between"><span>Offline engine</span><span className="text-success">always</span></li>
            </ul>
            <p className="text-[11px] text-ash mt-3">Model tiers: {plan.maxTier} and below on {plan.name}. Admins map tiers to concrete models in the admin panel.</p>
          </div>
          <div className="card p-5">
            <div className="label">Billing</div>
            <div className="mt-2 text-sm">{user.whopUserId ? <span className="text-success">Payments linked via Whop</span> : <span className="text-ash">No purchases yet</span>}</div>
            <p className="text-[11px] text-ash mt-2">Payments are processed by Whop using the email on this account. Subscriptions and credit packs appear here automatically after checkout.</p>
            <div className="mt-3 text-xs text-ash">{memberships.length ? memberships.map((m) => <div key={m.id}>{PLANS[m.plan as keyof typeof PLANS]?.name ?? m.plan} · {m.status}</div>) : "No memberships yet."}</div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Credit history</div>
          <table className="w-full text-xs">
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id} className="border-b border-graphite/60"><td className="p-3 text-ash">{new Date(l.createdAt).toLocaleString()}</td><td className="p-3 font-mono">{l.reason}</td><td className={`p-3 text-right font-mono ${l.delta < 0 ? "text-error" : "text-success"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</td></tr>
              ))}
              {ledger.length === 0 && <tr><td className="p-4 text-ash" colSpan={3}>No activity yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
