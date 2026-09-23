import { EmailPreferences } from "@/components/app/EmailPreferences";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PLANS, TIER_LABELS } from "@/lib/plans";
import { PageHeader } from "@/components/app/PageHeader";
import { ProfileForm } from "@/components/app/ProfileForm";
import { ReferralCard } from "@/components/app/ReferralCard";
import { WalletCard } from "@/components/app/WalletCard";
import { referralStats } from "@/lib/referrals";
import { getSettings } from "@/lib/settings";

export default async function Profile({ searchParams }: PageProps<"/app/profile">) {
  const sections = [{ id: "account", label: "Account" }, { id: "plan", label: "Plan & billing" }, { id: "credits", label: "Credits & usage" }, { id: "wallet", label: "Wallet & payouts" }, { id: "referrals", label: "Referrals" }, { id: "security", label: "Password & security" }];
  const requested = (await searchParams).section;
  const section = typeof requested === "string" && sections.some((s) => s.id === requested) ? requested : "account";
  const user = await requireUser();
  const plan = PLANS[user.plan];
  const monthStart = new Date(user.creditsResetAt);
  const [projects, runs, usedAllTime, usedThisMonth, recent, ref, settings] = await Promise.all([
    db.project.count({ where: { userId: user.id } }),
    db.agentRun.count({ where: { userId: user.id, status: "DONE" } }),
    db.agentRun.aggregate({ _sum: { creditsUsed: true }, where: { userId: user.id, status: "DONE" } }),
    db.agentRun.aggregate({ _sum: { creditsUsed: true }, where: { userId: user.id, status: "DONE", startedAt: { gte: monthStart } } }),
    db.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, kind: true, status: true, updatedAt: true } }),
    referralStats(user.id),
    getSettings(),
  ]);
  const usage = await db.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 });
  const projectNames = new Map((await db.project.findMany({ where: { id: { in: usage.map((u) => u.projectId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const REASON: Record<string, string> = { signup: "Welcome credits", monthly_reset: "Monthly renewal", credit_pack: "Credit pack purchased", referral_welcome: "Referral welcome bonus", referral_signup: "Friend signed up through your link", referral_paid: "Friend upgraded to a paid plan", admin_grant: "Credits added by IDÆVIA", refund_pack: "Credit pack refunded" };
  const explain = (r: { reason: string; note: string | null; delta: number }) => {
    if (r.note) return r.note;
    if (REASON[r.reason]) return REASON[r.reason];
    if (r.reason.startsWith("renewal:")) return `Monthly renewal (${r.reason.split(":")[1]} plan${r.reason.includes("rollover") ? ", with rollover" : ""})`;
    if (r.reason.startsWith("upgrade:")) return `Plan upgrade to ${r.reason.split(":")[1]}`;
    if (r.reason.startsWith("agent:")) return `${r.reason.split(":")[1]} agent run`;
    if (r.reason.startsWith("refund:")) return "Refund for a failed run";
    if (r.reason.startsWith("assistant")) return "IDÆVIA Agent conversation";
    return r.reason;
  };
  const used = usedThisMonth._sum.creditsUsed ?? 0;
  const pct = Math.min(100, Math.round((user.credits / plan.credits) * 100));
  const resetsAt = new Date(new Date(user.creditsResetAt).setMonth(new Date(user.creditsResetAt).getMonth() + 1));
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <>
      <PageHeader title="Your profile" subtitle="Your account, billing, earnings and security in one place" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {section === "account" && <EmailPreferences />}
        <section className="card p-6 flex flex-col md:flex-row md:items-center gap-6">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover border border-graphite" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-signal to-[#f5c04a] grid place-items-center text-2xl font-semibold text-void">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xl font-semibold truncate">{user.name ?? user.email}</div>
            <div className="text-sm text-ash truncate">{user.email}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="pill text-[10px] border-signal text-signal-soft">{plan.name} plan</span>
              {user.role === "ADMIN" && <span className="pill text-[10px]">Admin</span>}
              {user.providers.google && <span className="pill text-[10px]">Google linked</span>}
              {user.providers.github && <span className="pill text-[10px]">GitHub linked</span>}
              {user.providers.password && <span className="pill text-[10px]">Email + password</span>}
            </div>
            <div className="mt-2 text-xs text-ash">Member since {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
          </div>
          <Link href="/app/settings" className="btn btn-outline btn-sm shrink-0">Plan & billing</Link>
        </section>

        <nav aria-label="Profile sections" className="flex flex-wrap gap-2 border-b border-graphite pb-4">
          {sections.map((s) => <Link key={s.id} href={`/app/profile?section=${s.id}`} aria-current={section === s.id ? "page" : undefined} data-active={section === s.id} className="px-4 py-2.5 rounded-lg text-sm text-ash hover:text-paper hover:bg-ink data-[active=true]:bg-signal/10 data-[active=true]:text-signal-soft data-[active=true]:ring-1 data-[active=true]:ring-signal/30">{s.label}</Link>)}
        </nav>
        {section === "plan" && <section className="card p-6 space-y-4"><h2 className="text-lg font-semibold">{plan.name} plan</h2><p className="text-sm text-ash">{plan.credits.toLocaleString()} monthly credits · ${plan.price}/month · top tier: {TIER_LABELS[plan.maxTier]}</p><p className="text-sm text-ash">Manage your plan, buy a credit pack and view your subscription status.</p><Link href="/app/settings" className="btn btn-primary">Manage plan & billing</Link></section>}
        {(section === "account" || section === "credits") && <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="label">Credits left</div>
            <div className="mt-1 text-2xl font-semibold">{user.credits.toLocaleString()} <span className="text-sm text-ash font-normal">/ {plan.credits.toLocaleString()}</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-graphite overflow-hidden"><div className="h-full bg-signal rounded-full" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1.5 text-[11px] text-ash">Resets {resetsAt.toLocaleDateString()}</div>
          </div>
          <div className="card p-4"><div className="label">Used this cycle</div><div className="mt-1 text-2xl font-semibold">{used.toLocaleString()}</div><div className="mt-1 text-[11px] text-ash">{(usedAllTime._sum.creditsUsed ?? 0).toLocaleString()} credits all time</div></div>
          <div className="card p-4"><div className="label">Projects</div><div className="mt-1 text-2xl font-semibold">{projects}</div><div className="mt-1 text-[11px] text-ash">{plan.projectLimit === "unlimited" ? "Unlimited on your plan" : `${plan.projectLimit} allowed on ${plan.name}`}</div></div>
          <div className="card p-4"><div className="label">Agent runs</div><div className="mt-1 text-2xl font-semibold">{runs.toLocaleString()}</div><div className="mt-1 text-[11px] text-ash">Top model: {TIER_LABELS[plan.maxTier]}</div></div>
        </section>}

        {section === "credits" && <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-graphite flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-medium">Credit usage</h2><p className="text-[11px] text-ash mt-0.5">Every run is charged for the work it actually did: which agent, which model tier, how large the document was and how much the model generated. Deep-reasoning models (Opus, Fable, Astra) cost more per run.</p></div>
            <div className="text-right shrink-0"><div className="label">Used this month</div><div className="text-lg font-semibold">{used.toLocaleString()}</div></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">When</th><th className="text-left p-3 font-medium">Project</th><th className="text-left p-3 font-medium">What was charged / added and why</th><th className="text-right p-3 font-medium">Credits</th></tr></thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.id} className="border-b border-graphite/60 align-top">
                    <td className="p-3 text-ash whitespace-nowrap">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="p-3 whitespace-nowrap">{u.projectId ? <Link href={`/app/projects/${u.projectId}`} className="hover:underline">{projectNames.get(u.projectId) ?? "Project"}</Link> : <span className="text-ash">—</span>}</td>
                    <td className="p-3 text-fog">{explain(u)}</td>
                    <td className={`p-3 text-right font-mono whitespace-nowrap ${u.delta < 0 ? "text-error" : "text-success"}`}>{u.delta > 0 ? "+" : ""}{u.delta.toLocaleString()}</td>
                  </tr>
                ))}
                {usage.length === 0 && <tr><td colSpan={4} className="p-4 text-ash">No credit activity yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>}
        {section === "wallet" && <WalletCard />}
        {section === "referrals" && <ReferralCard url={ref.url} invited={ref.invited} converted={ref.converted} creditsEarned={ref.creditsEarned} rewards={settings.referral} cashEarnedCents={ref.cashEarnedCents} history={ref.history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))} />}

        {(section === "account" || section === "security") && <ProfileForm mode={section === "security" ? "security" : "profile"} name={user.name ?? ""} avatarUrl={user.avatarUrl ?? ""} hasPassword={user.providers.password} />}

        {section === "account" && <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite flex items-center justify-between"><span className="text-sm font-medium">Recent projects</span><Link href="/app/projects" className="text-xs text-signal-soft hover:underline">All projects →</Link></div>
          <table className="w-full text-xs">
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="border-b border-graphite/60">
                  <td className="p-3"><Link href={`/app/projects/${p.id}`} className="hover:underline">{p.name}</Link></td>
                  <td className="p-3 text-ash capitalize">{p.kind}</td>
                  <td className="p-3"><span className="pill text-[10px]">{p.status.toLowerCase()}</span></td>
                  <td className="p-3 text-ash text-right">{new Date(p.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td className="p-4 text-ash" colSpan={4}>No projects yet. <Link href="/app/projects" className="underline">Create your first one.</Link></td></tr>}
            </tbody>
          </table>
        </section>}
      </div>
    </>
  );
}
