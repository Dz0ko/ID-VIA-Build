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

export default async function Profile() {
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
  const used = usedThisMonth._sum.creditsUsed ?? 0;
  const pct = Math.min(100, Math.round((user.credits / plan.credits) * 100));
  const resetsAt = new Date(new Date(user.creditsResetAt).setMonth(new Date(user.creditsResetAt).getMonth() + 1));
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <>
      <PageHeader title="Your profile" subtitle="Account, sign-in methods and usage" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="label">Credits left</div>
            <div className="mt-1 text-2xl font-semibold">{user.credits.toLocaleString()} <span className="text-sm text-ash font-normal">/ {plan.credits.toLocaleString()}</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-graphite overflow-hidden"><div className="h-full bg-signal rounded-full" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1.5 text-[11px] text-ash">Resets {resetsAt.toLocaleDateString()}</div>
          </div>
          <div className="card p-4"><div className="label">Used this cycle</div><div className="mt-1 text-2xl font-semibold">{used.toLocaleString()}</div><div className="mt-1 text-[11px] text-ash">{(usedAllTime._sum.creditsUsed ?? 0).toLocaleString()} credits all time</div></div>
          <div className="card p-4"><div className="label">Projects</div><div className="mt-1 text-2xl font-semibold">{projects}</div><div className="mt-1 text-[11px] text-ash">{plan.projectLimit === "unlimited" ? "Unlimited on your plan" : `${plan.projectLimit} allowed on ${plan.name}`}</div></div>
          <div className="card p-4"><div className="label">Agent runs</div><div className="mt-1 text-2xl font-semibold">{runs.toLocaleString()}</div><div className="mt-1 text-[11px] text-ash">Top model: {TIER_LABELS[plan.maxTier]}</div></div>
        </section>

        <WalletCard />
        <ReferralCard url={ref.url} invited={ref.invited} converted={ref.converted} creditsEarned={ref.creditsEarned} rewards={settings.referral} />

        <ProfileForm name={user.name ?? ""} avatarUrl={user.avatarUrl ?? ""} hasPassword={user.providers.password} />

        <section className="card overflow-hidden">
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
        </section>
      </div>
    </>
  );
}
