"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Plus, Trash2, Link2 } from "lucide-react";

type Aff = { id: string; name: string; code: string; url: string; commissionPct: number; active: boolean; contact: string | null; notes: string | null; signups: number; paying: number; revenueCents: number; owedCents: number; paidCents: number };
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export function AffiliatesPanel() {
  const [rows, setRows] = useState<Aff[]>([]);
  const [form, setForm] = useState({ name: "", code: "", commissionPct: 20, contact: "" });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => setRows((await fetch("/api/admin/affiliates").then((r) => r.json())).affiliates ?? []), []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function create() {
    const res = await fetch("/api/admin/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, code: form.code || undefined, commissionPct: Number(form.commissionPct), contact: form.contact || undefined }) });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error);
    setForm({ name: "", code: "", commissionPct: 20, contact: "" }); setAdding(false); setMsg(null); load();
  }
  async function patch(id: string, data: Record<string, unknown>) {
    await fetch("/api/admin/affiliates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) }); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this affiliate? Referred users keep their accounts; pending commissions are removed.")) return;
    await fetch("/api/admin/affiliates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); load();
  }
  async function copy(a: Aff) { await navigator.clipboard.writeText(a.url); setCopied(a.id); setTimeout(() => setCopied(null), 1500); }

  const owed = rows.reduce((s, a) => s + a.owedCents, 0);

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-graphite flex items-center justify-between gap-3">
        <div><span className="text-sm font-medium">Affiliates</span><span className="ml-2 text-xs text-ash">{rows.length} partners · {usd(owed)} owed</span></div>
        <div className="flex items-center gap-2">{msg && <span className="text-xs text-error">{msg}</span>}<button onClick={() => setAdding((v) => !v)} className="btn btn-primary btn-sm"><Plus size={13} />New affiliate</button></div>
      </div>
      {adding && (
        <div className="p-4 border-b border-graphite grid sm:grid-cols-5 gap-3 text-xs items-end">
          <label><span className="label">Name</span><input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Creator or partner" /></label>
          <label><span className="label">Code (link)</span><input className="input mt-1 font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="auto from name" /></label>
          <label><span className="label">Commission % of plan</span><input type="number" min={0} max={90} className="input mt-1" value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: Number(e.target.value) })} /></label>
          <label><span className="label">Payout contact</span><input className="input mt-1" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="email / @handle" /></label>
          <button onClick={create} className="btn btn-primary btn-sm">Create link</button>
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Affiliate</th><th className="text-left p-3 font-medium">Link</th><th className="text-left p-3 font-medium">Commission</th><th className="text-left p-3 font-medium">Signups</th><th className="text-left p-3 font-medium">Paying</th><th className="text-left p-3 font-medium">Revenue</th><th className="text-left p-3 font-medium">Owed</th><th className="text-left p-3 font-medium">Paid</th><th className="p-3" /></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className={`border-b border-graphite/60 ${a.active ? "" : "opacity-50"}`}>
              <td className="p-3"><div>{a.name}</div><div className="text-ash">{a.contact ?? "no contact"}</div></td>
              <td className="p-3"><button onClick={() => copy(a)} className="inline-flex items-center gap-1.5 font-mono text-signal-soft hover:underline" title={a.url}><Link2 size={11} />/r/{a.code}{copied === a.id ? <Check size={11} className="text-success" /> : <Copy size={11} className="text-ash" />}</button></td>
              <td className="p-3"><div className="flex items-center gap-1"><input type="number" min={0} max={90} className="input py-1 w-16" defaultValue={a.commissionPct} onBlur={(e) => Number(e.target.value) !== a.commissionPct && patch(a.id, { commissionPct: Number(e.target.value) })} /><span className="text-ash">%</span></div></td>
              <td className="p-3 font-mono">{a.signups}</td>
              <td className="p-3 font-mono">{a.paying}</td>
              <td className="p-3 font-mono">{usd(a.revenueCents)}</td>
              <td className="p-3 font-mono text-warning">{usd(a.owedCents)}</td>
              <td className="p-3 font-mono text-ash">{usd(a.paidCents)}</td>
              <td className="p-3 text-right whitespace-nowrap">
                {a.owedCents > 0 && <button onClick={() => patch(a.id, { markPaid: true })} className="btn btn-outline btn-sm mr-1">Mark paid</button>}
                <button onClick={() => patch(a.id, { active: !a.active })} className="btn btn-ghost btn-sm mr-1">{a.active ? "Pause" : "Activate"}</button>
                <button onClick={() => remove(a.id)} className="btn btn-ghost btn-sm text-ash hover:text-error"><Trash2 size={12} /></button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={9} className="p-4 text-ash">No affiliates yet. Create one to get a shareable /r/ link; it opens the login page, remembers the partner for 30 days, and attributes whoever signs up or logs in (if not already attributed). The partner earns the set percentage of every plan payment by those users.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
