"use client";

import { useEffect, useState } from "react";
import type { AppSettings } from "@/lib/settings";
import type { ModelTier } from "@/lib/plans";
import { MODEL_TIERS, PLAN_ORDER } from "@/lib/plans";

type UserRow = { id: string; email: string; name: string | null; plan: string; credits: number; role: string; createdAt: string; whopUserId: string | null; googleId: string | null; githubId: string | null; _count: { projects: number } };

export function AdminPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [s, u] = await Promise.all([fetch("/api/admin/settings").then((r) => r.json()), fetch("/api/admin/users").then((r) => r.json())]);
    setSettings(s.settings); setUsers(u.users ?? []);
  }
  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, []);

  async function save() {
    const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setMsg(res.ok ? "Settings saved: takes effect immediately, no redeploy." : "Failed to save.");
    setTimeout(() => setMsg(null), 3000);
  }
  async function patchUser(id: string, data: Record<string, unknown>) {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    load();
  }

  if (!settings) return <div className="p-6 text-sm text-ash">Loading…</div>;
  const tiers: ModelTier[] = [...MODEL_TIERS];

  const visible = users.filter((u) => !filter || u.email.includes(filter.toLowerCase()) || (u.name ?? "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-8">
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Model tiers</h2><div className="flex items-center gap-3">{msg && <span className="text-xs text-success">{msg}</span>}<button onClick={save} className="btn btn-primary btn-sm">Save</button></div></div>
        <p className="text-xs text-ash">Plans map to tiers, tiers map to concrete models. Change models here without touching the subscription system.</p>
        <div className="grid md:grid-cols-2 gap-3">
          {tiers.map((t) => {
            const c = settings.tiers[t];
            const set = (patch: Partial<typeof c>) => setSettings({ ...settings, tiers: { ...settings.tiers, [t]: { ...c, ...patch } } });
            return (
              <div key={t} className="border border-graphite rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between"><span className="font-medium capitalize">{t} tier</span><label className="flex items-center gap-1"><input type="checkbox" checked={c.enabled} onChange={(e) => set({ enabled: e.target.checked })} />enabled</label></div>
                <div className="grid grid-cols-2 gap-2">
                  <label><span className="label">Provider</span><select className="input mt-1 py-1" value={c.provider} onChange={(e) => set({ provider: e.target.value as typeof c.provider })}><option value="anthropic">anthropic</option><option value="openai">openai</option><option value="mock">mock</option></select></label>
                  <label><span className="label">Model id</span><input className="input mt-1 py-1 font-mono" value={c.model} onChange={(e) => set({ model: e.target.value })} /></label>
                  <label><span className="label">Max output</span><input type="number" className="input mt-1 py-1" value={c.maxOutput} onChange={(e) => set({ maxOutput: Number(e.target.value) })} /></label>
                  <label><span className="label">Effort</span><select className="input mt-1 py-1" value={c.effort ?? ""} onChange={(e) => set({ effort: (e.target.value || undefined) as typeof c.effort })}><option value="">default</option>{["low", "medium", "high", "xhigh", "max"].map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label><span className="label">Credit multiplier</span><input type="number" step="0.5" className="input mt-1 py-1" value={settings.tierMultiplier[t]} onChange={(e) => setSettings({ ...settings, tierMultiplier: { ...settings.tierMultiplier, [t]: Number(e.target.value) } })} /></label>
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <div className="label mb-2">Base credit cost per task class</div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            {(Object.keys(settings.creditBase) as (keyof AppSettings["creditBase"])[]).map((k) => (
              <label key={k}><span className="label">{k}</span><input type="number" className="input mt-1 py-1" value={settings.creditBase[k]} onChange={(e) => setSettings({ ...settings, creditBase: { ...settings.creditBase, [k]: Number(e.target.value) } })} /></label>
            ))}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Users <span className="text-ash font-normal">({users.length})</span></div>
          <input className="input py-1 text-xs w-56" placeholder="Search email or name…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <table className="w-full text-xs">
          <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">User</th><th className="text-left p-3 font-medium">Plan</th><th className="text-left p-3 font-medium">Credits</th><th className="text-left p-3 font-medium">Projects</th><th className="text-left p-3 font-medium">Role</th><th className="text-left p-3 font-medium">Joined</th><th className="p-3" /></tr></thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id} className="border-b border-graphite/60">
                <td className="p-3">
                  <div>{u.name ?? u.email}</div>
                  <div className="text-ash">{u.email}
                    {u.googleId && <span className="ml-1 pill text-[9px]">google</span>}
                    {u.githubId && <span className="ml-1 pill text-[9px]">github</span>}
                    {u.whopUserId && <span className="ml-1 pill text-[9px]">whop billing</span>}
                  </div>
                </td>
                <td className="p-3"><select className="input py-1 w-28" value={u.plan} onChange={(e) => patchUser(u.id, { plan: e.target.value })}>{PLAN_ORDER.map((p) => <option key={p}>{p}</option>)}</select></td>
                <td className="p-3 font-mono">{u.credits}</td>
                <td className="p-3">{u._count.projects}</td>
                <td className="p-3"><select className="input py-1 w-24" value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}><option>USER</option><option>ADMIN</option></select></td>
                <td className="p-3 text-ash whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-right"><button onClick={() => patchUser(u.id, { addCredits: 500 })} className="btn btn-outline btn-sm">+500 cr</button></td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={7} className="p-4 text-ash">No users match.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
