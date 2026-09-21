"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { MARKETPLACE_FEE_PCT } from "@/lib/marketplace";

type Item = { id: string; type: string; title: string; category: string; price: number; authorName: string; installs: number; sales: number; published: boolean; createdAt: string };
type Order = { id: string; item: string; buyer: string; seller: string; priceCents: number; feeCents: number; sellerCents: number; status: string; createdAt: string; paidAt: string | null };
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export function MarketplaceAdminPanel() {
  const [data, setData] = useState<{ items: Item[]; orders: Order[] } | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(async () => setData(await fetch("/api/admin/marketplace").then((r) => r.json())), []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function setPublished(id: string, published: boolean) {
    await fetch("/api/admin/marketplace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, published }) }); load();
  }
  async function remove(id: string) {
    if (!confirm("Remove this listing? Sold items are unpublished instead so buyers keep access.")) return;
    await fetch("/api/marketplace", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); load();
  }

  if (!data) return <div className="text-sm text-ash">Loading…</div>;
  const paid = data.orders.filter((o) => o.status === "PAID");
  const gmv = paid.reduce((s, o) => s + o.priceCents, 0);
  const fees = paid.reduce((s, o) => s + o.feeCents, 0);
  const items = data.items.filter((i) => !q || `${i.title} ${i.authorName} ${i.category}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><div className="label">Listings</div><div className="mt-1 text-2xl font-semibold">{data.items.filter((i) => i.published).length}</div><div className="text-[11px] text-ash">{data.items.filter((i) => i.price > 0).length} paid · {data.items.filter((i) => !i.published).length} unpublished</div></div>
        <div className="card p-4"><div className="label">Paid orders</div><div className="mt-1 text-2xl font-semibold">{paid.length}</div><div className="text-[11px] text-ash">{data.orders.length - paid.length} pending / other</div></div>
        <div className="card p-4"><div className="label">GMV</div><div className="mt-1 text-2xl font-semibold">{usd(gmv)}</div></div>
        <div className="card p-4"><div className="label">Platform fees ({MARKETPLACE_FEE_PCT}%)</div><div className="mt-1 text-2xl font-semibold text-success">{usd(fees)}</div></div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Listings <span className="text-ash font-normal">({items.length})</span></div>
          <input className="input py-1 text-xs w-60" placeholder="Search title, author, category…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="w-full text-xs">
          <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Item</th><th className="text-left p-3 font-medium">Type</th><th className="text-left p-3 font-medium">Author</th><th className="text-left p-3 font-medium">Price</th><th className="text-left p-3 font-medium">Installs</th><th className="text-left p-3 font-medium">Sales</th><th className="text-left p-3 font-medium">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={`border-b border-graphite/60 ${i.published ? "" : "opacity-60"}`}>
                <td className="p-3"><div>{i.title}</div><div className="text-ash">{i.category} · {new Date(i.createdAt).toLocaleDateString()}</div></td>
                <td className="p-3 capitalize">{i.type}</td>
                <td className="p-3">{i.authorName}</td>
                <td className="p-3 font-mono">{i.price ? usd(i.price) : "Free"}</td>
                <td className="p-3 font-mono">{i.installs}</td>
                <td className="p-3 font-mono">{i.sales}</td>
                <td className="p-3"><span className={`pill text-[10px] ${i.published ? "text-success border-success/40" : ""}`}>{i.published ? "live" : "hidden"}</span></td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => setPublished(i.id, !i.published)} className="btn btn-ghost btn-sm mr-1">{i.published ? "Unpublish" : "Publish"}</button>
                  <button onClick={() => remove(i.id)} className="btn btn-ghost btn-sm text-ash hover:text-error"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="p-4 text-ash">No listings.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Orders</div>
        <table className="w-full text-xs">
          <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Item</th><th className="text-left p-3 font-medium">Buyer</th><th className="text-left p-3 font-medium">Seller</th><th className="text-left p-3 font-medium">Price</th><th className="text-left p-3 font-medium">Fee</th><th className="text-left p-3 font-medium">To seller</th><th className="text-left p-3 font-medium">Status</th><th className="text-right p-3 font-medium">Date</th></tr></thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id} className="border-b border-graphite/60">
                <td className="p-3">{o.item}</td><td className="p-3 text-ash">{o.buyer}</td><td className="p-3 text-ash">{o.seller}</td>
                <td className="p-3 font-mono">{usd(o.priceCents)}</td><td className="p-3 font-mono text-success">{usd(o.feeCents)}</td><td className="p-3 font-mono">{usd(o.sellerCents)}</td>
                <td className="p-3"><span className={`pill text-[10px] ${o.status === "PAID" ? "text-success border-success/40" : o.status === "PENDING" ? "text-warning border-warning/40" : ""}`}>{o.status.toLowerCase()}</span></td>
                <td className="p-3 text-ash text-right whitespace-nowrap">{new Date(o.paidAt ?? o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {data.orders.length === 0 && <tr><td colSpan={8} className="p-4 text-ash">No orders yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
