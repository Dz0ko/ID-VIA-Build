"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, LayoutTemplate, Sparkles, Bot, Blocks, Wand2, Rocket, Settings, ShieldCheck, LogOut, CreditCard, Import, Store, Users, Sparkle, GraduationCap, Lock,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SessionUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { planAtLeast } from "@/lib/agents";

type Item = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; minPlan?: "STARTER" };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Workspace", items: [
    { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/app/projects", label: "Projects", icon: FolderKanban },
    { href: "/app/assistant", label: "IDÆVIA Agent", icon: Sparkle },
    { href: "/app/import", label: "Import", icon: Import },
  ] },
  { title: "Library", items: [
    { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/app/prompts", label: "Prompts", icon: Sparkles },
    { href: "/app/components", label: "Components", icon: Blocks },
    { href: "/app/effects", label: "Effects", icon: Wand2 },
    { href: "/app/agents", label: "Agents", icon: Bot },
  ] },
  { title: "Grow", items: [
    { href: "/app/marketplace", label: "Marketplace", icon: Store },
    { href: "/app/deployments", label: "Deployments", icon: Rocket },
    { href: "/app/teams", label: "Teams & clients", icon: Users },
    { href: "/app/learn", label: "Learn", icon: GraduationCap, minPlan: "STARTER" },
  ] },
];

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const plan = PLANS[user.plan];
  const pct = Math.min(100, Math.round((user.credits / plan.credits) * 100));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="h-screen flex bg-void">
      <aside className="w-[232px] shrink-0 border-r border-graphite flex flex-col bg-void">
        <div className="h-14 flex items-center px-4 border-b border-graphite"><Logo href="/app" size={24} /></div>
        <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="px-3 mb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-ash/70">{g.title}</div>
              <div className="space-y-px">
                {g.items.map((n) => {
                  const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
                  const Icon = n.icon;
                  const locked = n.minPlan && !planAtLeast(user.plan, n.minPlan);
                  return (
                    <Link key={n.href} href={n.href} className={`relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] transition ${active ? "bg-graphite/80 text-paper" : "text-fog/90 hover:bg-ink hover:text-paper"}`}>
                      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-signal" />}
                      <Icon size={15} strokeWidth={1.8} className={active ? "text-signal-soft" : "text-ash"} />
                      <span className="flex-1 truncate">{n.label}</span>
                      {locked && <Lock size={11} className="text-ash/70" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {user.role === "ADMIN" && (
            <Link href="/admin" className="flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] text-fog/90 hover:bg-ink hover:text-paper transition">
              <ShieldCheck size={15} strokeWidth={1.8} className="text-ash" /><span className="flex-1">Admin console</span><span className="text-[10px] text-ash">↗</span>
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-graphite space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-fog flex items-center gap-1.5"><CreditCard size={12} className="text-ash" />{user.credits.toLocaleString()} credits</span>
              <span className="pill text-[10px]">{plan.name}</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-graphite overflow-hidden"><div className="h-full bg-signal" style={{ width: `${pct}%` }} /></div>
            {user.plan !== "AGENCY" && <Link href="/pricing" className="mt-2 block text-[11px] text-signal-soft hover:underline">Upgrade plan →</Link>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/profile" className="flex items-center gap-2 min-w-0 flex-1 rounded-lg -m-1 p-1 hover:bg-ink" title="Your profile">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-graphite grid place-items-center text-xs font-medium">{(user.name ?? user.email).slice(0, 1).toUpperCase()}</div>
              )}
              <div className="min-w-0 flex-1"><div className="text-xs truncate">{user.name ?? user.email}</div><div className="text-[10px] text-ash truncate">{user.email}</div></div>
            </Link>
            <Link href="/app/settings" title="Settings & billing" className={`w-7 h-7 grid place-items-center rounded-md hover:bg-ink ${pathname.startsWith("/app/settings") ? "text-signal-soft" : "text-ash hover:text-paper"}`}><Settings size={14} /></Link>
            <button onClick={logout} title="Log out" className="w-7 h-7 grid place-items-center rounded-md text-ash hover:text-paper hover:bg-ink"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
