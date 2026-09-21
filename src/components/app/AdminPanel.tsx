"use client";

import { useEffect, useState } from "react";
import type { AppSettings } from "@/lib/settings";
import type { ModelTier } from "@/lib/plans";
import { PLAN_ORDER } from "@/lib/plans";

type UserRow = { id: string; email: string; name: string | null; plan: string; credits: number; role: string; createdAt: string; whopUserId: string | null; _count: { projects: number } };

export function AdminPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [providers, setProviders] = useState<{ anthropic: boolean; openai: boolean } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [runs, setRuns] = useState<{ agentId: string; _sum: { creditsUsed: number | null }; _count: number }[]>([]);
  const [spent, setSpent] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [s, u] = await Promise.all([fetch("/api/admin/settings").then((r) => r.json()), fetch("/api/admin/users").then((r) => r.json())]);
    setSettings(s.settings); setProviders(s.providers); setUsers(u.users ?? []); setRuns(u.runs ?? []); setSpent(u.creditsSpent ?? 0);
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
  const tiers: ModelTier[] = ["fast", "standard", "advanced", "premium"];

  return (
    <div className="p-6 space-y-8">
      <section className="grid sm:grid-cols-4 gap-4">
        <div className="card p-4"><div className="label">Users</div><div className="text-2xl font-semibold">{users.length}</div></div>
        <div className="card p-4"><div className="label">Credits spent</div><div className="text-2xl font-semibold">{spent.toLocaleString()}</div></div>
        <div className="card p-4"><div className="label">Top agent</div><div className="text-2xl font-semibold">{[...runs].sort((a, b) => (b._sum.creditsUsed ?? 0) - (a._sum.creditsUsed ?? 0))[0]?.agentId ?? "—"}</div></div>
        <div className="card p-4"><div className="label">Providers</div><div className="text-sm mt-1">Anthropic: <span className={providers?.anthropic ? "text-success" : "text-ash"}>{providers?.anthropic ? "on" : "off"}</span> · OpenAI: <span className={providers?.openai ? "text-success" : "text-ash"}>{providers?.openai ? "on" : "off"}</span></div></div>
      </section>

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
        <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Users</div>
        <table className="w-full text-xs">
          <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Email</th><th className="text-left p-3 font-medium">Plan</th><th className="text-left p-3 font-medium">Credits</th><th className="text-left p-3 font-medium">Projects</th><th className="text-left p-3 font-medium">Role</th><th className="p-3" /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-graphite/60">
                <td className="p-3">{u.email}{u.whopUserId && <span className="ml-1 pill text-[9px]">whop</span>}</td>
                <td className="p-3"><select className="input py-1 w-28" value={u.plan} onChange={(e) => patchUser(u.id, { plan: e.target.value })}>{PLAN_ORDER.map((p) => <option key={p}>{p}</option>)}</select></td>
                <td className="p-3 font-mono">{u.credits}</td>
                <td className="p-3">{u._count.projects}</td>
                <td className="p-3"><select className="input py-1 w-24" value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}><option>USER</option><option>ADMIN</option></select></td>
                <td className="p-3 text-right"><button onClick={() => patchUser(u.id, { addCredits: 500 })} className="btn btn-outline btn-sm">+500 cr</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-medium mb-3">Agent usage</h2>
        <div className="flex flex-wrap gap-2 text-xs">{runs.map((r) => <span key={r.agentId} className="pill">{r.agentId}: {r._count} runs · {r._sum.creditsUsed ?? 0} cr</span>)}{runs.length === 0 && <span className="text-ash">No runs yet.</span>}</div>
      </section>
    </div>
  );
}
