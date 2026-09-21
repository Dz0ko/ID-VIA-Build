"use client";

import { useCallback, useEffect, useState } from "react";

type Seller = { id: string; email: string; name: string | null; owedCents: number; paidCents: number; sales: number };
type Aff = { id: string; name: string; code: string; contact: string | null; owedCents: number; paidCents: number };
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PayoutsPanel() {
  const [data, setData] = useState<{ sellers: Seller[]; affiliates: Aff[] } | null>(null);
  const load = useCallback(async () => setData(await fetch("/api/admin/payouts").then((r) => r.json())), []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function pay(body: Record<string, string>, label: string) {
    if (!confirm(`Mark ${label} as paid out? Do this after you have sent the money.`)) return;
    await fetch("/api/admin/payouts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }

  if (!data) return <div className="text-sm text-ash">Loading…</div>;
  const sellersOwed = data.sellers.reduce((s, x) => s + x.owedCents, 0);
  const affOwed = data.affiliates.reduce((s, x) => s + x.owedCents, 0);

  return (
    <div className="space-y-6">
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><div className="label">Owed to sellers</div><div className={`mt-1 text-2xl font-semibold ${sellersOwed ? "text-warning" : ""}`}>{usd(sellersOwed)}</div><div className="text-[11px] text-ash">{data.sellers.filter((s) => s.owedCents > 0).length} sellers waiting</div></div>
        <div className="card p-4"><div className="label">Owed to affiliates</div><div className={`mt-1 text-2xl font-semibold ${affOwed ? "text-warning" : ""}`}>{usd(affOwed)}</div><div className="text-[11px] text-ash">{data.affiliates.filter((a) => a.owedCents > 0).length} partners waiting</div></div>
        <div className="card p-4"><div className="label">Total owed</div><div className="mt-1 text-2xl font-semibold">{usd(sellersOwed + affOwed)}</div></div>
        <div className="card p-4"><div className="label">Paid out so far</div><div className="mt-1 text-2xl font-semibold text-success">{usd(data.sellers.reduce((s, x) => s + x.paidCents, 0) + data.affiliates.reduce((s, x) => s + x.paidCents, 0))}</div></div>
      </section>

      <p className="text-xs text-ash">Payouts are recorded here, not sent automatically: transfer the money (PayPal, bank, Whop payout) and then press “Mark paid”. Marketplace sales credit sellers with 90% of the price; affiliates earn their percentage of each plan payment.</p>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Marketplace sellers</div>
        <table className="w-full text-xs">
          <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Seller</th><th className="text-left p-3 font-medium">Sales</th><th className="text-left p-3 font-medium">Owed</th><th className="text-left p-3 font-medium">Paid out</th><th className="p-3" /></tr></thead>
          <tbody>
            {data.sellers.map((s) => (
              <tr key={s.id} className="border-b border-graphite/60">
                <td className="p-3"><div>{s.name ?? s.email}</div><div className="text-ash">{s.email}</div></td>
                <td className="p-3 font-mono">{s.sales}</td>
                <td className={`p-3 font-mono ${s.owedCents ? "text-warning" : ""}`}>{usd(s.owedCents)}</td>
                <td className="p-3 font-mono text-ash">{usd(s.paidCents)}</td>
                <td className="p-3 text-right">{s.owedCents > 0 && <button onClick={() => pay({ sellerId: s.id }, `${usd(s.owedCents)} to ${s.email}`)} className="btn btn-outline btn-sm">Mark paid</button>}</td>
              </tr>
            ))}
            {data.sellers.length === 0 && <tr><td colSpan={5} className="p-4 text-ash">No seller earnings yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Affiliates</div>
        <table className="w-full text-xs">
          <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Partner</th><th className="text-left p-3 font-medium">Link</th><th className="text-left p-3 font-medium">Owed</th><th className="text-left p-3 font-medium">Paid out</th><th className="p-3" /></tr></thead>
          <tbody>
            {data.affiliates.map((a) => (
              <tr key={a.id} className="border-b border-graphite/60">
                <td className="p-3"><div>{a.name}</div><div className="text-ash">{a.contact ?? "no payout contact"}</div></td>
                <td className="p-3 font-mono">/r/{a.code}</td>
                <td className={`p-3 font-mono ${a.owedCents ? "text-warning" : ""}`}>{usd(a.owedCents)}</td>
                <td className="p-3 font-mono text-ash">{usd(a.paidCents)}</td>
                <td className="p-3 text-right">{a.owedCents > 0 && <button onClick={() => pay({ affiliateId: a.id }, `${usd(a.owedCents)} to ${a.name}`)} className="btn btn-outline btn-sm">Mark paid</button>}</td>
              </tr>
            ))}
            {data.affiliates.length === 0 && <tr><td colSpan={5} className="p-4 text-ash">No affiliates yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
