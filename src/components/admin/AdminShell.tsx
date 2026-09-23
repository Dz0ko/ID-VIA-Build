"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandIcon, type BrandIconName } from "@/components/BrandIcon";
import type { SessionUser } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview", icon: "overview" as BrandIconName, exact: true, hint: "KPIs, trends, MRR" },
  { href: "/admin/users", label: "Users", icon: "users" as BrandIconName, hint: "Accounts, plans, credits" },
  { href: "/admin/projects", label: "Projects", icon: "overview" as BrandIconName, hint: "Created projects and their owners" },
  { href: "/admin/payments", label: "Payments", icon: "payments" as BrandIconName, hint: "Subscriptions, packs, webhooks" },
  { href: "/admin/payouts", label: "Payouts", icon: "payouts" as BrandIconName, hint: "Sellers and affiliates owed" },
  { href: "/admin/affiliates", label: "Affiliates", icon: "affiliates" as BrandIconName, hint: "Partner links and commissions" },
  { href: "/admin/marketplace", label: "Marketplace", icon: "marketplace" as BrandIconName, hint: "Listings and orders" },
  { href: "/admin/support", label: "Support", icon: "users" as BrandIconName, hint: "Live conversations and manager handoffs" },
  { href: "/admin/settings", label: "Settings", icon: "settings" as BrandIconName, hint: "Models, credits, referrals" },
];
export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const idx = Math.max(0, NAV.findIndex((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href))));
  const current = NAV[idx];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="admin-theme h-screen flex">
      <aside className="w-48 xl:w-56 shrink-0 border-r border-graphite bg-ink flex flex-col p-4">
        <Link href="/admin" className="px-3 py-5 text-lg font-semibold tracking-tight">IDÆVIA <span className="text-xs text-ash font-normal">Admin</span></Link>
        <nav aria-label="Admin sections" className="space-y-1 mt-4">
          {NAV.map((n, i) => <Link key={n.href} href={n.href} className="admin-nav-link" aria-current={i === idx ? "page" : undefined}><BrandIcon name={n.icon} size={18} />{n.label}</Link>)}
        </nav>
        <div className="mt-auto border-t border-graphite pt-4 space-y-2">
          <p className="px-3 text-xs text-ash truncate" title={user.email}>{user.email}</p>
          <Link href="/app/profile" className="admin-nav-link">Profile</Link>
          <Link href="/app" className="admin-nav-link">Back to app ↗</Link>
          <button onClick={logout} className="admin-nav-link w-full">Log out</button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="px-8 py-6 border-b border-graphite bg-ink">
          <h1 className="text-2xl font-semibold tracking-tight">{current.label}</h1>
          <p className="text-sm text-fog mt-1">{current.hint}</p>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
