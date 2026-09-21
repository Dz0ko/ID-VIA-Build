"use client";

import { useEffect, useState } from "react";
import { PLAN_ORDER, PLANS } from "@/lib/plans";

type UserRow = { id: string; email: string; name: string | null; plan: string; credits: number; role: string; createdAt: string; whopUserId: string | null; googleId: string | null; githubId: string | null; sellerBalanceCents: number; _count: { projects: number; referrals: number } };

export function UsersPanel() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [filter, setFilter] = useState("");
  const [plan, setPlan] = useState("");
  const [grant, setGrant] = useState<Record<string, number>>({});

  async function load() {
    const u = await fetch("/api/admin/users").then((r) => r.json());
    setUsers(u.users ?? []);
  }
  useEffect(() => { const id = setTimeout(load, 0); return () => clearTimeout(id); }, []);

  async function patchUser(id: string, data: Record<string, unknown>) {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    load();
  }

  if (!users) return <div className="text-sm text-ash">Loading…</div>;
  const q = filter.toLowerCase();
  const visible = users.filter((u) => (!q || u.email.includes(q) || (u.name ?? "").toLowerCase().includes(q)) && (!plan || u.plan === plan));
  const paid = users.filter((u) => u.plan !== "FREE").length;

  return (
    <div className="space-y-4">
      <section className="grid sm:grid-cols-4 gap-4">
        <div className="card p-4"><div className="label">Total</div><div className="mt-1 text-2xl font-semibold">{users.length}</div></div>
        <div className="card p-4"><div className="label">Paying</div><div className="mt-1 text-2xl font-semibold">{paid}</div></div>
        <div className="card p-4"><div className="label">Admins</div><div className="mt-1 text-2xl font-semibold">{users.filter((u) => u.role === "ADMIN").length}</div></div>
        <div className="card p-4"><div className="label">Credits in circulation</div><div className="mt-1 text-2xl font-semibold">{users.reduce((s, u) => s + u.credits, 0).toLocaleString()}</div></div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium">Users <span className="text-ash font-normal">({visible.length})</span></div>
          <div className="ml-auto flex items-center gap-2">
            <select className="input py-1 text-xs w-32" value={plan} onChange={(e) => setPlan(e.target.value)}><option value="">All plans</option>{PLAN_ORDER.map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}</select>
            <input className="input py-1 text-xs w-60" placeholder="Search email or name…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">User</th><th className="text-left p-3 font-medium">Plan</th><th className="text-left p-3 font-medium">Credits</th><th className="text-left p-3 font-medium">Projects</th><th className="text-left p-3 font-medium">Referrals</th><th className="text-left p-3 font-medium">Seller balance</th><th className="text-left p-3 font-medium">Role</th><th className="text-left p-3 font-medium">Joined</th><th className="p-3 text-right font-medium">Grant credits</th></tr></thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className="border-b border-graphite/60">
                  <td className="p-3">
                    <div>{u.name ?? u.email}</div>
                    <div className="text-ash">{u.email}
                      {u.googleId && <span className="ml-1 pill text-[9px]">google</span>}
                      {u.githubId && <span className="ml-1 pill text-[9px]">github</span>}
                      {u.whopUserId && <span className="ml-1 pill text-[9px]">whop</span>}
                    </div>
                  </td>
                  <td className="p-3"><select className="input py-1 w-28" value={u.plan} onChange={(e) => patchUser(u.id, { plan: e.target.value })}>{PLAN_ORDER.map((p) => <option key={p}>{p}</option>)}</select></td>
                  <td className="p-3 font-mono">{u.credits.toLocaleString()}</td>
                  <td className="p-3">{u._count.projects}</td>
                  <td className="p-3">{u._count.referrals}</td>
                  <td className="p-3 font-mono">{u.sellerBalanceCents ? `$${(u.sellerBalanceCents / 100).toFixed(2)}` : "—"}</td>
                  <td className="p-3"><select className="input py-1 w-24" value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}><option>USER</option><option>ADMIN</option></select></td>
                  <td className="p-3 text-ash whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <input type="number" className="input py-1 w-20 inline-block mr-1" value={grant[u.id] ?? 500} onChange={(e) => setGrant({ ...grant, [u.id]: Number(e.target.value) })} />
                    <button onClick={() => patchUser(u.id, { addCredits: grant[u.id] ?? 500 })} className="btn btn-outline btn-sm">Add</button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={9} className="p-4 text-ash">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
