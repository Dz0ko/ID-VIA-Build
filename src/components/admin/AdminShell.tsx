"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandIcon, type BrandIconName } from "@/components/BrandIcon";
import type { SessionUser } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview", icon: "overview" as BrandIconName, exact: true, hint: "KPIs, trends, MRR" },
  { href: "/admin/users", label: "Users", icon: "users" as BrandIconName, hint: "Accounts, plans, credits" },
  { href: "/admin/payments", label: "Payments", icon: "payments" as BrandIconName, hint: "Subscriptions, packs, webhooks" },
  { href: "/admin/payouts", label: "Payouts", icon: "payouts" as BrandIconName, hint: "Sellers and affiliates owed" },
  { href: "/admin/affiliates", label: "Affiliates", icon: "affiliates" as BrandIconName, hint: "Partner links and commissions" },
  { href: "/admin/marketplace", label: "Marketplace", icon: "marketplace" as BrandIconName, hint: "Listings and orders" },
  { href: "/admin/settings", label: "Settings", icon: "settings" as BrandIconName, hint: "Models, credits, referrals" },
];
const ITEM_H = 56;
const RAIL_TOP = 96; // logo block height above the nav list

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  return now;
}

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const now = useClock();
  const idx = Math.max(0, NAV.findIndex((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href))));
  const current = NAV[idx];
  const hour = now?.getHours() ?? 12;
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (user.name ?? user.email).split(/[\s@]/)[0];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="admin-theme h-screen flex">
      {/* Icon rail */}
      <aside className="admin-rail w-[68px] shrink-0 relative flex flex-col isolate">
        <div className="h-24 grid place-items-center">
          <Link href="/admin" className="w-10 h-10 rounded-full bg-white text-black grid place-items-center font-semibold text-sm shadow-[0_0_0_4px_rgba(255,255,255,0.08)]" title="IDÆVIA admin">Æ</Link>
        </div>
        <div className="admin-notch" style={{ top: RAIL_TOP + idx * ITEM_H }} />
        <nav className="relative flex flex-col">
          {NAV.map((n, i) => {
            return (
              <Link key={n.href} href={n.href} className={`admin-rail-item ${i === idx ? "active" : ""}`} aria-label={n.label} aria-current={i === idx ? "page" : undefined}>
                <BrandIcon name={n.icon} size={20} strokeWidth={1.7} />
                <span className="admin-rail-tip">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pb-4 flex flex-col items-center gap-2">
          <Link href="/app/profile" className="admin-rail-item !h-12" aria-label="Your profile">
            <span className="w-9 h-9 rounded-full bg-white text-black grid place-items-center"><BrandIcon name="profile" size={17} /></span>
            <span className="admin-rail-tip">Profile · back to the app</span>
          </Link>
          <button onClick={logout} className="admin-rail-item !h-10" aria-label="Log out"><BrandIcon name="logout" size={18} /><span className="admin-rail-tip">Log out</span></button>
        </div>
      </aside>

      {/* Content surface */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative z-0">
        <header className="shrink-0 px-8 pt-6 pb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">Hi {firstName} <span aria-hidden>👋</span></h1>
            <p className="text-sm text-fog mt-0.5">{greeting}. Here is what is happening on IDÆVIA today.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full bg-white shadow-[0_1px_2px_rgba(20,20,26,.05),0_8px_24px_-16px_rgba(20,20,26,.2)] p-1">
              <Link href="/app" className="btn btn-ghost btn-sm rounded-full"><BrandIcon name="home" size={14} />App</Link>
              <Link href="/admin/affiliates" className="btn btn-ghost btn-sm rounded-full"><BrandIcon name="plus" size={14} />Affiliate</Link>
              <Link href="/admin/users" className="btn btn-ghost btn-sm rounded-full"><BrandIcon name="search" size={14} />Find user</Link>
            </div>
            <Link href="/admin/payouts" className="w-10 h-10 rounded-full bg-white grid place-items-center text-fog hover:text-paper shadow-[0_1px_2px_rgba(20,20,26,.05),0_8px_24px_-16px_rgba(20,20,26,.2)] relative" title="Payouts waiting">
              <BrandIcon name="bell" size={17} />
            </Link>
            <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-[0_1px_2px_rgba(20,20,26,.05),0_8px_24px_-16px_rgba(20,20,26,.2)] tabular-nums">{now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}</div>
            <div className="text-right leading-tight">
              <div className="text-[11px] text-ash">{now ? now.toLocaleDateString(undefined, { day: "numeric", month: "short", weekday: "long" }) : ""}</div>
              <div className="text-sm font-semibold">Admin console</div>
            </div>
          </div>
        </header>

        <div className="px-8 pb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{current.label}</h2>
            <p className="text-xs text-ash">{current.hint}</p>
          </div>
        </div>

        <main key={pathname} className="admin-enter flex-1 overflow-y-auto px-8 pb-24">{children}</main>

        {/* Floating section switcher */}
        <div className="admin-fab fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full bg-[#15151a] text-white pl-4 pr-1.5 py-1.5 text-xs shadow-[0_20px_40px_-16px_rgba(0,0,0,.5)]">
          <span className="text-white/60 mr-1">Section:</span>
          {NAV.map((n, i) => (
            <Link key={n.href} href={n.href} className={`rounded-full px-3 py-1.5 transition ${i === idx ? "bg-white text-black font-semibold" : "text-white/70 hover:text-white hover:bg-white/10"}`}>{n.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
