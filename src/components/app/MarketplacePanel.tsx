"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Trash2 } from "lucide-react";
import type { PlanId } from "@/lib/plans";

type Item = { id: string; type: string; title: string; description: string; category: string; price: number; authorName: string; installs: number; mine: boolean; createdAt: string };
const TYPES = ["template", "prompt", "component", "agent"] as const;

export function MarketplacePanel({ plan }: { plan: PlanId }) {
  const router = useRouter();
  const [type, setType] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ type: "template", title: "", description: "", category: "General", price: 0, projectId: "", prompt: "", customAgentId: "" });
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch(`/api/marketplace${type ? `?type=${type}` : ""}`).then((r) => r.json());
    setItems(d.items ?? []);
  }, [type]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function openPublish() {
    setPublishing(true);
    const [p, a] = await Promise.all([fetch("/api/projects").then((r) => r.json()), fetch("/api/custom-agents").then((r) => r.json())]);
    setProjects(p.projects ?? []); setAgents(a.agents ?? []);
  }
  async function publish() {
    const res = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, price: Math.round(Number(form.price) * 100), projectId: form.projectId || undefined, prompt: form.prompt || undefined, customAgentId: form.customAgentId || undefined }) });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error);
    setPublishing(false); setMsg("Published"); load(); setTimeout(() => setMsg(null), 2000);
  }
  async function install(item: Item) {
    const res = await fetch(`/api/marketplace/${item.id}/install`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error);
    if (d.kind === "project") router.push(`/app/projects/${d.projectId}`);
    else if (d.kind === "agent") router.push("/app/agents");
    else router.push(`/app?prompt=${encodeURIComponent(d.prompt)}`);
  }
  async function remove(id: string) {
    if (!confirm("Remove this item from the marketplace?")) return;
    await fetch("/api/marketplace", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setType("")} className={`pill ${!type ? "border-signal text-signal-soft" : ""}`}>All</button>
        {TYPES.map((t) => <button key={t} onClick={() => setType(t)} className={`pill capitalize ${type === t ? "border-signal text-signal-soft" : ""}`}>{t}s</button>)}
        <div className="ml-auto flex items-center gap-2">{msg && <span className="text-xs text-success">{msg}</span>}<button onClick={openPublish} className="btn btn-primary btn-sm"><Upload size={13} />Publish</button></div>
      </div>

      {publishing && (
        <div className="card p-5 space-y-3 max-w-2xl">
          <h3 className="text-sm font-medium">Publish to the marketplace</h3>
          {plan === "FREE" && <div className="text-xs text-warning">Publishing requires Starter or above.</div>}
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <label><span className="label">Type</span><select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label><span className="label">Category</span><input className="input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
            <label className="sm:col-span-2"><span className="label">Title</span><input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="sm:col-span-2"><span className="label">Description</span><textarea className="input mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label><span className="label">Price (USD, 0 = free)</span><input type="number" min={0} className="input mt-1" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></label>
            {form.type === "template" && <label><span className="label">Project</span><select className="input mt-1" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Choose…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
            {form.type === "agent" && <label><span className="label">Custom agent</span><select className="input mt-1" value={form.customAgentId} onChange={(e) => setForm({ ...form, customAgentId: e.target.value })}><option value="">Choose…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
            {(form.type === "prompt" || form.type === "component") && <label className="sm:col-span-2"><span className="label">Prompt</span><textarea className="input mt-1 min-h-24" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} /></label>}
          </div>
          <p className="text-[11px] text-ash">Paid items are sold through Whop (IDÆVIA takes a marketplace fee); free items install instantly.</p>
          <div className="flex gap-2 justify-end"><button onClick={() => setPublishing(false)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={publish} className="btn btn-primary btn-sm">Publish</button></div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ash">Nothing here yet. Be the first to publish a template, prompt, component or agent.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map((i) => (
            <div key={i.id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between"><span className="pill text-[10px] capitalize">{i.type}</span><span className="text-xs text-ash">{i.price ? `$${(i.price / 100).toFixed(2)}` : "Free"}</span></div>
              <div className="text-sm font-medium">{i.title}</div>
              <p className="text-xs text-ash flex-1">{i.description}</p>
              <div className="text-[11px] text-ash">by {i.authorName} · {i.installs} installs · {i.category}</div>
              <div className="flex gap-2 justify-end">
                {i.mine && <button onClick={() => remove(i.id)} className="btn btn-ghost btn-sm text-ash hover:text-error"><Trash2 size={12} /></button>}
                <button onClick={() => install(i)} className="btn btn-primary btn-sm"><Download size={12} />{i.type === "template" ? "Use" : i.type === "agent" ? "Add agent" : "Use prompt"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
