"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, LayoutTemplate, Sparkles, Bot, Blocks, Wand2, Rocket, Settings, ShieldCheck, LogOut, CreditCard, Import, Store, Users, Sparkle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SessionUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/assistant", label: "IDÆVIA Agent", icon: Sparkle },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/import", label: "Import", icon: Import },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/app/prompts", label: "Prompts", icon: Sparkles },
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/app/components", label: "Components", icon: Blocks },
  { href: "/app/effects", label: "Effects", icon: Wand2 },
  { href: "/app/marketplace", label: "Marketplace", icon: Store },
  { href: "/app/deployments", label: "Deployments", icon: Rocket },
  { href: "/app/teams", label: "Teams & clients", icon: Users },
  { href: "/app/settings", label: "Settings", icon: Settings },
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
      <aside className="w-60 shrink-0 border-r border-graphite flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-graphite"><Logo href="/app" size={24} /></div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-graphite text-paper" : "text-fog hover:bg-ink hover:text-paper"}`}>
                <Icon size={16} className={active ? "text-signal-soft" : "text-ash"} />
                {n.label}
              </Link>
            );
          })}
          {user.role === "ADMIN" && (
            <Link href="/admin" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${pathname.startsWith("/admin") ? "bg-graphite text-paper" : "text-fog hover:bg-ink hover:text-paper"}`}>
              <ShieldCheck size={16} className="text-ash" />Admin
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
            <div className="w-7 h-7 rounded-full bg-graphite grid place-items-center text-xs font-medium">{(user.name ?? user.email).slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="text-xs truncate">{user.name ?? user.email}</div><div className="text-[10px] text-ash truncate">{user.email}</div></div>
            <button onClick={logout} title="Log out" className="text-ash hover:text-paper"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
