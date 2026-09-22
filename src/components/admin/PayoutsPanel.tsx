"use client";

import { useCallback, useEffect, useState } from "react";

type Req = { id: string; seller: string; email: string; amountCents: number; method: string; destination: string; details: Record<string, string> | null; status: string; note: string | null; createdAt: string; resolvedAt: string | null };
type Seller = { id: string; email: string; name: string | null; owedCents: number; paidCents: number; sales: number; destination: string };
type Sale = { id: string; item: string; buyer: string; seller: string; priceCents: number; sellerCents: number; feeCents: number; status: string; paidAt: string | null; createdAt: string };
type Aff = { id: string; name: string; code: string; contact: string | null; owedCents: number; paidCents: number };
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PayoutsPanel() {
  const [data, setData] = useState<{ requests: Req[]; sellers: Seller[]; sales: Sale[]; affiliates: Aff[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => setData(await fetch("/api/admin/payouts").then((r) => r.json())), []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function resolve(r: Req, action: "approve" | "reject") {
    const note = action === "approve"
      ? prompt(`Confirm you have SENT ${usd(r.amountCents)} to:\n${r.destination}\n\nRequired transaction hash / payment reference:`, "")
      : prompt(`Reject the ${usd(r.amountCents)} request from ${r.email}? The balance goes back to the user.\n\nReason shown to the seller:`, "");
    if (note === null) return;
    setBusy(r.id); setError("");
    const response = await fetch("/api/admin/payouts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: r.id, action, note }) });
    setBusy(null);
    if (!response.ok) { setError((await response.json()).error ?? "Could not update payout."); return; }
    load();
  }
  async function payAffiliate(a: Aff) {
    if (!confirm(`Mark ${usd(a.owedCents)} to ${a.name} as paid out? Do this after you have sent the money.`)) return;
    await fetch("/api/admin/payouts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ affiliateId: a.id }) });
    load();
  }

  if (!data) return <div className="text-sm text-ash">Loading…</div>;
  const pending = data.requests.filter((r) => r.status === "PENDING");
  const pendingCents = pending.reduce((s, r) => s + r.amountCents, 0);
  const sellersOwed = data.sellers.reduce((s, x) => s + x.owedCents, 0);
  const affOwed = data.affiliates.reduce((s, x) => s + x.owedCents, 0);
  const paidOut = data.sellers.reduce((s, x) => s + x.paidCents, 0) + data.affiliates.reduce((s, x) => s + x.paidCents, 0);

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><div className="label">Payout requests</div><div className={`mt-1 text-2xl font-semibold ${pending.length ? "text-warning" : ""}`}>{pending.length}</div><div className="text-[11px] text-ash">{usd(pendingCents)} waiting for your approval</div></div>
        <div className="card p-4"><div className="label">User wallet balances</div><div className="mt-1 text-2xl font-semibold">{usd(sellersOwed)}</div><div className="text-[11px] text-ash">not yet requested</div></div>
        <div className="card p-4"><div className="label">Owed to affiliates</div><div className={`mt-1 text-2xl font-semibold ${affOwed ? "text-warning" : ""}`}>{usd(affOwed)}</div><div className="text-[11px] text-ash">{data.affiliates.filter((a) => a.owedCents > 0).length} partners waiting</div></div>
        <div className="card p-4"><div className="label">Paid out so far</div><div className="mt-1 text-2xl font-semibold text-success">{usd(paidOut)}</div></div>
      </section>

      <p className="text-xs text-ash">How it works: a sale is paid to IDÆVIA through Whop; 90% is credited to the seller’s wallet. When the seller requests a payout, it appears here with their crypto wallet or PayPal. Send the money from your Whop balance, then press <strong className="text-paper">Approve</strong>. Reject returns the amount to the seller’s wallet.</p>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite text-sm font-medium flex items-center justify-between"><span>Payout requests</span>{pending.length > 0 && <span className="pill text-[10px] border-warning/40 text-warning">{pending.length} pending</span>}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">User</th><th className="text-left p-3 font-medium">Amount</th><th className="text-left p-3 font-medium">Send to</th><th className="text-left p-3 font-medium">Requested</th><th className="text-left p-3 font-medium">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {data.requests.map((r) => (
                <tr key={r.id} className="border-b border-graphite/60 align-top">
                  <td className="p-3"><div>{r.seller}</div><div className="text-ash">{r.email}</div></td>
                  <td className="p-3 font-mono font-medium">{usd(r.amountCents)}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.method === "crypto" ? "Crypto" : "PayPal"}</div>
                    {r.details && r.method === "crypto" && <><div className="text-ash">{r.destination.split(" · ")[0]}</div><code className="block mt-1 font-mono text-[10px] break-all select-all">{r.details.address}</code></>}
                    {r.details && r.method === "paypal" && <code className="block mt-1 font-mono text-[10px] select-all">{r.details.email}</code>}
                  </td>
                  <td className="p-3 text-ash whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-3"><span className={`pill text-[10px] ${r.status === "PAID" ? "border-success/40 text-success" : r.status === "REJECTED" ? "border-error/40 text-error" : "border-warning/40 text-warning"}`}>{r.status.toLowerCase()}</span>{r.note && <div className="mt-1 text-ash max-w-[220px]">{r.note}</div>}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {r.status === "PENDING" && (
                      <div className="flex gap-2 justify-end">
                        <button disabled={busy === r.id} onClick={() => resolve(r, "reject")} className="btn btn-outline btn-sm">Reject</button>
                        <button disabled={busy === r.id} onClick={() => resolve(r, "approve")} className="btn btn-primary btn-sm">Approve</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {data.requests.length === 0 && <tr><td colSpan={6} className="p-4 text-ash">No payout requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Marketplace sales</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Item</th><th className="text-left p-3 font-medium">Buyer</th><th className="text-left p-3 font-medium">User</th><th className="text-left p-3 font-medium">Price</th><th className="text-left p-3 font-medium">Seller share</th><th className="text-left p-3 font-medium">Platform fee</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Date</th></tr></thead>
            <tbody>
              {data.sales.map((s) => (
                <tr key={s.id} className="border-b border-graphite/60">
                  <td className="p-3">{s.item}</td><td className="p-3 text-ash">{s.buyer}</td><td className="p-3 text-ash">{s.seller}</td>
                  <td className="p-3 font-mono">{usd(s.priceCents)}</td><td className="p-3 font-mono text-success">{usd(s.sellerCents)}</td><td className="p-3 font-mono">{usd(s.feeCents)}</td>
                  <td className="p-3"><span className={`pill text-[10px] ${s.status === "PAID" ? "border-success/40 text-success" : "border-error/40 text-error"}`}>{s.status.toLowerCase()}</span></td>
                  <td className="p-3 text-ash whitespace-nowrap">{new Date(s.paidAt ?? s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {data.sales.length === 0 && <tr><td colSpan={8} className="p-4 text-ash">No sales yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-graphite text-sm font-medium">Seller wallets</div>
        <table className="w-full text-xs">
          <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">User</th><th className="text-left p-3 font-medium">Sales</th><th className="text-left p-3 font-medium">Balance</th><th className="text-left p-3 font-medium">Paid out</th><th className="text-left p-3 font-medium">Payout destination</th></tr></thead>
          <tbody>
            {data.sellers.map((s) => (
              <tr key={s.id} className="border-b border-graphite/60">
                <td className="p-3"><div>{s.name ?? s.email}</div><div className="text-ash">{s.email}</div></td>
                <td className="p-3 font-mono">{s.sales}</td>
                <td className="p-3 font-mono">{usd(s.owedCents)}</td>
                <td className="p-3 font-mono text-ash">{usd(s.paidCents)}</td>
                <td className="p-3 text-ash">{s.destination}</td>
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
                <td className="p-3 text-right">{a.owedCents > 0 && <button onClick={() => payAffiliate(a)} className="btn btn-outline btn-sm">Mark paid</button>}</td>
              </tr>
            ))}
            {data.affiliates.length === 0 && <tr><td colSpan={5} className="p-4 text-ash">No affiliates yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
