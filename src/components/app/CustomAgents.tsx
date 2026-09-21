"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Plus, Trash2, Pencil } from "lucide-react";

type Agent = { id: string; name: string; description: string; systemPrompt: string; tier: string; multiplier: number; mode: string; isPublic: boolean; userId: string };
const empty = { name: "", description: "", systemPrompt: "", tier: "standard", multiplier: 2, mode: "rewrite", isPublic: false };

export function CustomAgents({ allowed, userId }: { allowed: boolean; userId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editing, setEditing] = useState<Partial<Agent> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => { const d = await fetch("/api/custom-agents").then((r) => r.json()); setAgents(d.agents ?? []); }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function save() {
    if (!editing) return;
    setError(null);
    const isNew = !editing.id;
    const res = await fetch(isNew ? "/api/custom-agents" : `/api/custom-agents/${editing.id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editing, multiplier: Number(editing.multiplier) }) });
    const d = await res.json();
    if (!res.ok) return setError(d.error);
    setEditing(null); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this agent?")) return;
    await fetch(`/api/custom-agents/${id}`, { method: "DELETE" }); load();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium">Custom agents</h2>
        {allowed ? <button onClick={() => setEditing({ ...empty })} className="btn btn-primary btn-sm"><Plus size={13} />New agent</button> : <Link href="/pricing" className="pill text-[10px] flex items-center gap-1"><Lock size={9} />Agency plan</Link>}
      </div>
      {editing && (
        <div className="card p-5 mb-4 space-y-3 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <label><span className="label">Name</span><input className="input mt-1" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="My Agency Landing Page Agent" /></label>
            <label><span className="label">Description</span><input className="input mt-1" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Always follows our brand and structure" /></label>
            <label className="sm:col-span-2"><span className="label">System prompt</span><textarea className="input mt-1 min-h-40 font-mono text-[12px]" value={editing.systemPrompt ?? ""} onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })} placeholder={"You are …\nAlways use: brand colours #…, fonts …, sections in this order: …"} /></label>
            <label><span className="label">Mode</span><select className="input mt-1" value={editing.mode} onChange={(e) => setEditing({ ...editing, mode: e.target.value })}><option value="rewrite">Edits the project (rewrite)</option><option value="report">Writes a report</option></select></label>
            <label><span className="label">Model tier</span><select className="input mt-1" value={editing.tier} onChange={(e) => setEditing({ ...editing, tier: e.target.value })}>{["fast", "standard", "advanced", "premium"].map((t) => <option key={t}>{t}</option>)}</select></label>
            <label><span className="label">Credit multiplier</span><input type="number" step="0.5" min={0.5} max={10} className="input mt-1" value={editing.multiplier ?? 2} onChange={(e) => setEditing({ ...editing, multiplier: Number(e.target.value) })} /></label>
            <label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={Boolean(editing.isPublic)} onChange={(e) => setEditing({ ...editing, isPublic: e.target.checked })} />Public (other users can run it)</label>
          </div>
          {error && <div className="text-xs text-error">{error}</div>}
          <div className="flex justify-end gap-2"><button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={save} className="btn btn-primary btn-sm">Save agent</button></div>
        </div>
      )}
      {agents.length === 0 ? (
        <div className="card p-6 text-xs text-ash">No custom agents yet. Create private agents that always follow your brand, preferred components, animations and copy structure.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {agents.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex items-center justify-between"><div className="font-medium text-sm">{a.name}</div><div className="flex gap-1">{a.userId === userId && <><button onClick={() => setEditing(a)} className="text-ash hover:text-paper"><Pencil size={12} /></button><button onClick={() => remove(a.id)} className="text-ash hover:text-error"><Trash2 size={12} /></button></>}</div></div>
              <p className="text-xs text-ash mt-1">{a.description || "—"}</p>
              <div className="mt-3 flex flex-wrap gap-1 text-[10px]"><span className="pill">{a.tier}</span><span className="pill">{a.multiplier}×</span><span className="pill">{a.mode}</span>{a.isPublic && <span className="pill">public</span>}{a.userId !== userId && <span className="pill">shared</span>}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
