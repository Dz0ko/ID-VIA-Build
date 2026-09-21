"use client";

import { useEffect, useState } from "react";
import type { AppSettings } from "@/lib/settings";
import type { ModelTier } from "@/lib/plans";
import { MODEL_TIERS } from "@/lib/plans";

/** Platform configuration: model tiers, credit costs, referral rewards. */
export function AdminPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const s = await fetch("/api/admin/settings").then((r) => r.json());
    setSettings(s.settings);
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
  if (!settings) return <div className="text-sm text-ash">Loading…</div>;
  const tiers: ModelTier[] = [...MODEL_TIERS];

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
          <div className="label mb-2">Referral rewards (credits)</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <label><span className="label">New user gets on signup</span><input type="number" min={0} className="input mt-1 py-1" value={settings.referral.referredSignupCredits} onChange={(e) => setSettings({ ...settings, referral: { ...settings.referral, referredSignupCredits: Number(e.target.value) } })} /></label>
            <label><span className="label">Referrer gets per signup</span><input type="number" min={0} className="input mt-1 py-1" value={settings.referral.referrerSignupCredits} onChange={(e) => setSettings({ ...settings, referral: { ...settings.referral, referrerSignupCredits: Number(e.target.value) } })} /></label>
            <label><span className="label">Referrer gets when friend goes paid</span><input type="number" min={0} className="input mt-1 py-1" value={settings.referral.referrerPaidCredits} onChange={(e) => setSettings({ ...settings, referral: { ...settings.referral, referrerPaidCredits: Number(e.target.value) } })} /></label>
          </div>
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
    </div>
  );
}
