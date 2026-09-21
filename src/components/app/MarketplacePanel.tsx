"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Upload, Trash2, ShoppingBag, Eye, Lock, X, Wallet, Search } from "@/components/icons";
import type { PlanId } from "@/lib/plans";

type Item = {
  id: string; type: string; title: string; description: string; category: string; price: number; authorName: string;
  installs: number; sales: number; mine: boolean; purchased: boolean; hasPreview: boolean; kind: "website" | "app" | null; fileCount: number; createdAt: string;
};
type Me = {
  feePct: number; balanceCents: number; paidOutCents: number; grossCents: number; earnedCents: number;
  listings: { id: string; type: string; title: string; price: number; sales: number; installs: number; published: boolean }[];
  sales: { id: string; item: string; buyer: string; priceCents: number; sellerCents: number; paidAt: string }[];
  purchases: { id: string; itemId: string; item: string; type: string; priceCents: number; status: string; createdAt: string }[];
};

const TYPES = [
  { id: "template", label: "Websites & apps" },
  { id: "component", label: "Components" },
  { id: "prompt", label: "Prompts" },
  { id: "agent", label: "Agents" },
] as const;
const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

export function MarketplacePanel({ plan, feePct }: { plan: PlanId; feePct: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [type, setType] = useState<string>("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [preview, setPreview] = useState<Item | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ type: "template", title: "", description: "", category: "General", price: 0, projectId: "", prompt: "", customAgentId: "" });
  const [projects, setProjects] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch(`/api/marketplace?${new URLSearchParams({ ...(type ? { type } : {}), ...(q ? { q } : {}) })}`).then((r) => r.json());
    setItems(d.items ?? []);
  }, [type, q]);
  const loadMe = useCallback(async () => setMe(await fetch("/api/marketplace/me").then((r) => r.json())), []);
  useEffect(() => { const t = setTimeout(load, 150); return () => clearTimeout(t); }, [load]);
  useEffect(() => { const t = setTimeout(loadMe, 0); return () => clearTimeout(t); }, [loadMe]);
  useEffect(() => {
    if (!params.get("purchase")) return;
    const simulated = Boolean(params.get("simulated"));
    const t = setTimeout(() => {
      setMsg({ ok: true, text: simulated ? "Simulated payment complete (dev mode). The item is unlocked." : "Payment received. The item is unlocked." });
      router.replace("/app/marketplace");
    }, 0);
    return () => clearTimeout(t);
  }, [params, router]);

  function flash(ok: boolean, text: string) { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); }

  async function openPublish() {
    setPublishing(true);
    const [p, a] = await Promise.all([fetch("/api/projects").then((r) => r.json()), fetch("/api/custom-agents").then((r) => r.json())]);
    setProjects(p.projects ?? []); setAgents(a.agents ?? []);
  }
  async function publish() {
    setBusy("publish");
    const res = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, price: Math.round(Number(form.price) * 100), projectId: form.projectId || undefined, prompt: form.prompt || undefined, customAgentId: form.customAgentId || undefined }) });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) return flash(false, d.error);
    setPublishing(false); flash(true, d.item.price ? `Published at ${usd(d.item.price)}. You earn ${usd(d.item.sellerCents)} per sale.` : "Published as a free item."); load(); loadMe();
  }
  async function install(item: Item) {
    setBusy(item.id);
    const res = await fetch(`/api/marketplace/${item.id}/install`, { method: "POST" });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) return flash(false, d.error);
    if (d.kind === "project") router.push(`/app/projects/${d.projectId}`);
    else if (d.kind === "agent") router.push("/app/agents");
    else router.push(`/app?prompt=${encodeURIComponent(d.prompt)}`);
  }
  async function buy(item: Item) {
    setBusy(item.id);
    const res = await fetch(`/api/marketplace/${item.id}/buy`, { method: "POST" });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) return flash(false, d.error);
    if (d.alreadyOwned) { flash(true, "You already own this item."); load(); return; }
    window.location.href = d.url;
  }
  async function remove(id: string) {
    if (!confirm("Remove this listing from the marketplace? Existing buyers keep access.")) return;
    await fetch("/api/marketplace", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); load(); loadMe();
  }

  const priceCents = Math.round(Number(form.price || 0) * 100);
  const fee = Math.round((priceCents * feePct) / 100);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-graphite p-0.5 text-xs">
          <button onClick={() => setTab("browse")} className={`px-3 py-1.5 rounded-md ${tab === "browse" ? "bg-graphite text-paper" : "text-ash"}`}>Browse</button>
          <button onClick={() => setTab("mine")} className={`px-3 py-1.5 rounded-md ${tab === "mine" ? "bg-graphite text-paper" : "text-ash"}`}>My listings & earnings</button>
        </div>
        {tab === "browse" && (
          <>
            <button onClick={() => setType("")} className={`pill ${!type ? "border-signal text-signal-soft" : ""}`}>All</button>
            {TYPES.map((t) => <button key={t.id} onClick={() => setType(t.id)} className={`pill ${type === t.id ? "border-signal text-signal-soft" : ""}`}>{t.label}</button>)}
            <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ash" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input py-1.5 pl-7 text-xs w-44" /></div>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">{msg && <span className={`text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</span>}<button onClick={openPublish} className="btn btn-primary btn-sm"><Upload size={13} />Sell or share</button></div>
      </div>

      {publishing && (
        <div className="card p-5 space-y-3 max-w-2xl">
          <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Publish to the marketplace</h3><button onClick={() => setPublishing(false)} className="text-ash hover:text-paper"><X size={14} /></button></div>
          {plan === "FREE" && <div className="text-xs text-warning">Publishing requires Starter or above.</div>}
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <label><span className="label">What are you publishing?</span><select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <label><span className="label">Category</span><input className="input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="SaaS, Agency, E-commerce…" /></label>
            <label className="sm:col-span-2"><span className="label">Title</span><input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="sm:col-span-2"><span className="label">Description</span><textarea className="input mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is it, who is it for, what is included." /></label>
            {form.type === "template" && <label><span className="label">Project to sell</span><select className="input mt-1" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Choose…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.kind === "app" ? " (React app)" : ""}</option>)}</select></label>}
            {form.type === "agent" && <label><span className="label">Custom agent</span><select className="input mt-1" value={form.customAgentId} onChange={(e) => setForm({ ...form, customAgentId: e.target.value })}><option value="">Choose…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
            {(form.type === "prompt" || form.type === "component") && <label className="sm:col-span-2"><span className="label">Prompt</span><textarea className="input mt-1 min-h-24" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} /></label>}
            <label><span className="label">Price (USD, 0 = free)</span><input type="number" min={0} step={1} className="input mt-1" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></label>
            <div className="rounded-lg border border-graphite p-3 self-end">
              {priceCents > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-ash">Buyer pays</span><span className="font-mono">{usd(priceCents)}</span></div>
                  <div className="flex justify-between"><span className="text-ash">Platform fee ({feePct}%)</span><span className="font-mono">−{usd(fee)}</span></div>
                  <div className="flex justify-between font-medium border-t border-graphite pt-1"><span>You receive</span><span className="font-mono text-success">{usd(priceCents - fee)}</span></div>
                </div>
              ) : <div className="text-ash">Free items install instantly and earn nothing. Set a price to sell.</div>}
            </div>
          </div>
          <p className="text-[11px] text-ash flex items-start gap-1.5"><Lock size={12} className="mt-0.5 shrink-0" />Buyers see only a script-free, watermarked preview. The code, files and prompt stay private until Whop confirms the payment. Earnings collect in your balance and are paid out by IDÆVIA.</p>
          <div className="flex gap-2 justify-end"><button onClick={() => setPublishing(false)} className="btn btn-ghost btn-sm">Cancel</button><button disabled={busy === "publish"} onClick={publish} className="btn btn-primary btn-sm">{busy === "publish" ? "Publishing…" : "Publish"}</button></div>
        </div>
      )}

      {tab === "browse" && (items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ash">Nothing here yet. Be the first to sell a website, app, component, prompt or agent.</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((i) => {
            const paid = i.price > 0;
            const unlocked = !paid || i.mine || i.purchased;
            return (
              <div key={i.id} className="card overflow-hidden flex flex-col">
                <div className="relative h-44 bg-void border-b border-graphite">
                  {i.hasPreview ? (
                    <iframe src={`/api/marketplace/${i.id}/preview`} title={`${i.title} preview`} sandbox="" loading="lazy" className="w-full h-full block pointer-events-none" style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }} />
                  ) : (
                    <div className="h-full grid place-items-center text-ash text-xs">{i.kind === "app" ? `React app · ${i.fileCount} files` : i.type === "agent" ? "Custom agent" : i.type === "component" ? "Component prompt" : "Prompt"}</div>
                  )}
                  {i.hasPreview && <button onClick={() => setPreview(i)} className="absolute inset-0 grid place-items-center bg-void/0 hover:bg-void/40 transition group"><span className="btn btn-outline btn-sm opacity-0 group-hover:opacity-100 bg-void/80"><Eye size={12} />Open preview</span></button>}
                  <div className="absolute top-2 left-2 flex gap-1"><span className="pill text-[10px] bg-void/80">{i.kind === "app" ? "React app" : i.kind === "website" ? "Website" : TYPES.find((t) => t.id === i.type)?.label}</span></div>
                  <div className="absolute top-2 right-2"><span className={`pill text-[10px] bg-void/80 ${paid ? "border-signal text-signal-soft" : ""}`}>{paid ? usd(i.price) : "Free"}</span></div>
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="text-sm font-medium">{i.title}</div>
                  <p className="text-xs text-ash flex-1 line-clamp-3">{i.description}</p>
                  <div className="text-[11px] text-ash">by {i.authorName} · {i.category} · {paid ? `${i.sales} sold` : `${i.installs} installs`}</div>
                  <div className="flex gap-2 justify-end items-center">
                    {i.mine && <button onClick={() => remove(i.id)} className="btn btn-ghost btn-sm text-ash hover:text-error" title="Remove listing"><Trash2 size={12} /></button>}
                    {i.purchased && <span className="pill text-[10px] border-success/40 text-success">Owned</span>}
                    {unlocked ? (
                      <button disabled={busy === i.id} onClick={() => install(i)} className="btn btn-primary btn-sm"><Download size={12} />{i.type === "template" ? "Use" : i.type === "agent" ? "Add agent" : "Use prompt"}</button>
                    ) : (
                      <button disabled={busy === i.id} onClick={() => buy(i)} className="btn btn-signal btn-sm"><ShoppingBag size={12} />{busy === i.id ? "Starting checkout…" : `Buy for ${usd(i.price)}`}</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {tab === "mine" && (me ? (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4"><div className="label flex items-center gap-1.5"><Wallet size={12} />Balance to pay out</div><div className="mt-1 text-2xl font-semibold text-success">{usd(me.balanceCents)}</div><div className="mt-1 text-[11px] text-ash">Paid out so far {usd(me.paidOutCents)}</div></div>
            <div className="card p-4"><div className="label">Total earned</div><div className="mt-1 text-2xl font-semibold">{usd(me.earnedCents)}</div><div className="mt-1 text-[11px] text-ash">{usd(me.grossCents)} gross · {me.feePct}% platform fee</div></div>
            <div className="card p-4"><div className="label">Sales</div><div className="mt-1 text-2xl font-semibold">{me.sales.length}</div><div className="mt-1 text-[11px] text-ash">{me.listings.length} listings</div></div>
            <div className="card p-4"><div className="label">Purchases</div><div className="mt-1 text-2xl font-semibold">{me.purchases.filter((p) => p.status === "PAID").length}</div><div className="mt-1 text-[11px] text-ash">items you own</div></div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-graphite text-sm font-medium">My listings</div>
              <table className="w-full text-xs"><tbody>
                {me.listings.map((l) => <tr key={l.id} className="border-b border-graphite/60"><td className="p-3">{l.title}<div className="text-ash">{TYPES.find((t) => t.id === l.type)?.label}{!l.published && " · unpublished"}</div></td><td className="p-3 font-mono">{l.price ? usd(l.price) : "Free"}</td><td className="p-3 text-ash text-right">{l.price ? `${l.sales} sold` : `${l.installs} installs`}</td></tr>)}
                {me.listings.length === 0 && <tr><td className="p-4 text-ash">You have not published anything yet.</td></tr>}
              </tbody></table>
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Recent sales</div>
              <table className="w-full text-xs"><tbody>
                {me.sales.map((s) => <tr key={s.id} className="border-b border-graphite/60"><td className="p-3">{s.item}<div className="text-ash">{s.buyer}</div></td><td className="p-3 font-mono text-success">+{usd(s.sellerCents)}</td><td className="p-3 text-ash text-right whitespace-nowrap">{s.paidAt ? new Date(s.paidAt).toLocaleDateString() : ""}</td></tr>)}
                {me.sales.length === 0 && <tr><td className="p-4 text-ash">No sales yet.</td></tr>}
              </tbody></table>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-graphite text-sm font-medium">My purchases</div>
            <table className="w-full text-xs"><tbody>
              {me.purchases.map((p) => <tr key={p.id} className="border-b border-graphite/60"><td className="p-3">{p.item}</td><td className="p-3 font-mono">{usd(p.priceCents)}</td><td className="p-3"><span className={`pill text-[10px] ${p.status === "PAID" ? "border-success/40 text-success" : ""}`}>{p.status.toLowerCase()}</span></td><td className="p-3 text-ash text-right">{new Date(p.createdAt).toLocaleDateString()}</td></tr>)}
              {me.purchases.length === 0 && <tr><td className="p-4 text-ash">You have not bought anything yet.</td></tr>}
            </tbody></table>
          </div>
          <p className="text-[11px] text-ash">Payouts: your balance is transferred by IDÆVIA through Whop. Contact support to request a payout once your balance is above $25.</p>
        </div>
      ) : <div className="text-sm text-ash">Loading…</div>)}

      {preview && (
        <div className="fixed inset-0 z-50 bg-void/85 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <div className="card w-full max-w-5xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-graphite">
              <div><span className="text-sm font-medium">{preview.title}</span><span className="ml-2 text-xs text-ash">Preview only · scripts and links disabled</span></div>
              <div className="flex items-center gap-2">
                {preview.price > 0 && !preview.purchased && !preview.mine && <button onClick={() => buy(preview)} className="btn btn-signal btn-sm"><ShoppingBag size={12} />Buy for {usd(preview.price)}</button>}
                <button onClick={() => setPreview(null)} className="text-ash hover:text-paper"><X size={16} /></button>
              </div>
            </div>
            <iframe src={`/api/marketplace/${preview.id}/preview`} title={`${preview.title} full preview`} sandbox="" className="w-full block bg-white" style={{ height: "70vh" }} />
          </div>
        </div>
      )}
    </div>
  );
}
