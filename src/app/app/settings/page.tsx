import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PLANS, CREDIT_PACKS } from "@/lib/plans";
import { planPurchasable, whopApiConfigured, whopConfigured } from "@/lib/whop";
import { providerStatus } from "@/lib/ai/router";
import { PageHeader } from "@/components/app/PageHeader";
import { PlanSwitcher } from "@/components/app/PlanSwitcher";

export default async function Settings({ searchParams }: PageProps<"/app/settings">) {
  const user = await requireUser();
  const sp = await searchParams;
  const ledger = await db.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  const memberships = await db.membership.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  // In production, regular users must see the checkout flow even before Whop is configured.
  const whop = whopConfigured() || (process.env.NODE_ENV === "production" && user.role !== "ADMIN");
  const providers = providerStatus();
  const plan = PLANS[user.plan];

  return (
    <>
      <PageHeader title="Settings & billing" subtitle={user.email} />
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {sp.error === "checkout_not_configured" && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">Checkout is temporarily unavailable. Please try again later or contact support@idaevia.app.</div>
        )}
        {sp.error === "checkout_failed" && (
          <div className="rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">We could not open the checkout. Please try again in a minute.</div>
        )}
        {sp.error === "pack_needs_plan" && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">Credit packs are available on paid plans. Choose a plan first.</div>
        )}
        {sp.checkout === "plan" && (
          <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">Thanks! Your {String(sp.plan)} plan activates within a minute after Whop confirms the payment. Refresh this page.</div>
        )}
        {sp.checkout === "pack" && (
          <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">Thanks! {String(sp.credits)} credits are added within a minute after Whop confirms the payment.</div>
        )}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Plan</h2>
            <span className="text-xs text-ash">{whop ? "Secure billing by Whop" : "Local dev: plan switching enabled"}</span>
          </div>
          <PlanSwitcher current={user.plan} whopEnabled={whop} checkout={{ STARTER: planPurchasable("STARTER"), PRO: planPurchasable("PRO"), MAX: planPurchasable("MAX"), AGENCY: planPurchasable("AGENCY") }} />
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="label">Credits</div>
            <div className="text-3xl font-semibold mt-1">{user.credits.toLocaleString()}</div>
            <div className="text-xs text-ash">
              {Math.max(0, user.credits - user.purchasedCredits).toLocaleString()} of {plan.credits.toLocaleString()} monthly
              {user.purchasedCredits > 0 && <> + {user.purchasedCredits.toLocaleString()} purchased (never expire)</>}
              {" · "}renews {new Date(new Date(user.creditsResetAt).setMonth(new Date(user.creditsResetAt).getMonth() + 1)).toLocaleDateString()}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {CREDIT_PACKS.map((c) =>
                whopApiConfigured() && user.plan !== "FREE" ? (
                  <a key={c.credits} href={`/api/billing/pack?credits=${c.credits}`} className="border border-graphite hover:border-signal rounded-lg p-2 text-xs transition-colors"><div className="font-medium">{c.credits.toLocaleString()} cr</div><div className="text-ash">${c.price} · Buy</div></a>
                ) : (
                  <div key={c.credits} className="border border-graphite rounded-lg p-2 text-xs opacity-70"><div className="font-medium">{c.credits.toLocaleString()} cr</div><div className="text-ash">${c.price}</div></div>
                ),
              )}
            </div>
            <p className="text-[11px] text-ash mt-2">{user.plan === "FREE" ? "Top-ups are available on paid plans." : "One-time top-ups paid via Whop (card, PayPal or crypto). Credits are added automatically after payment."}</p>
          </div>
          <div className="card p-5">
            <div className="label">AI providers</div>
            <ul className="mt-2 text-sm space-y-1">
              <li className="flex justify-between"><span>Anthropic (Claude)</span><span className={providers.anthropic ? "text-success" : "text-ash"}>{providers.anthropic ? "connected" : "no key"}</span></li>
              <li className="flex justify-between"><span>OpenAI</span><span className={providers.openai ? "text-success" : "text-ash"}>{providers.openai ? "connected" : "no key"}</span></li>
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
