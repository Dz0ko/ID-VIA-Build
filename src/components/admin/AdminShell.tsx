"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, CreditCard, Banknote, Link2, Store, SlidersHorizontal, ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SessionUser } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, hint: "KPIs, trends, MRR" },
  { href: "/admin/users", label: "Users", icon: Users, hint: "Accounts, plans, credits" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, hint: "Subscriptions, packs, webhooks" },
  { href: "/admin/payouts", label: "Payouts", icon: Banknote, hint: "Sellers and affiliates owed" },
  { href: "/admin/affiliates", label: "Affiliates", icon: Link2, hint: "Partner links and commissions" },
  { href: "/admin/marketplace", label: "Marketplace", icon: Store, hint: "Listings and orders" },
  { href: "/admin/settings", label: "Settings", icon: SlidersHorizontal, hint: "Models, credits, referrals" },
];

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = NAV.find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href))) ?? NAV[0];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="h-screen flex bg-void text-paper">
      <aside className="w-64 shrink-0 border-r border-graphite flex flex-col bg-ink/40">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-graphite">
          <Logo href="/admin" size={22} />
          <span className="pill text-[10px] border-signal text-signal-soft"><ShieldCheck size={10} className="mr-1" />Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-graphite text-paper" : "text-fog hover:bg-ink hover:text-paper"}`}>
                <Icon size={16} className={active ? "text-signal-soft" : "text-ash"} />
                <span className="flex-1">
                  <span className="block leading-tight">{n.label}</span>
                  <span className="block text-[10px] text-ash leading-tight">{n.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-graphite space-y-2">
          <Link href="/app" className="btn btn-outline btn-sm w-full"><ArrowLeft size={13} />Back to the app</Link>
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded-full bg-graphite grid place-items-center text-xs font-medium">{(user.name ?? user.email).slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="text-xs truncate">{user.name ?? user.email}</div><div className="text-[10px] text-ash truncate">{user.email}</div></div>
            <button onClick={logout} title="Log out" className="text-ash hover:text-paper"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="h-14 shrink-0 border-b border-graphite px-6 flex items-center justify-between">
          <div><h1 className="text-sm font-medium">{current.label}</h1><p className="text-xs text-ash">{current.hint}</p></div>
          <span className="text-[11px] text-ash">IDÆVIA Build · admin console</span>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
