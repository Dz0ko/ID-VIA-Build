"use client";

import { useCallback, useEffect, useState } from "react";
import { CRYPTO_NETWORKS } from "@/lib/wallet";
import { BrandIcon } from "@/components/BrandIcon";

type Wallet = {
  marketplaceEarnedCents: number; referralEarnedCents: number; balanceCents: number; paidOutCents: number; earnedCents: number; pendingCents: number; minPayoutCents: number;
  payout: { method: "crypto"; network: string; address: string } | { method: "paypal"; email: string } | null;
  payoutLabel: string;
  requests: { id: string; amountCents: number; method: string; status: string; note: string | null; createdAt: string; resolvedAt: string | null }[];
};
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Seller wallet: marketplace earnings, payout destination (crypto or PayPal) and payout requests. */
export function WalletCard() {
  const [w, setW] = useState<Wallet | null>(null);
  const [edit, setEdit] = useState(false);
  const [method, setMethod] = useState<"crypto" | "paypal">("crypto");
  const [network, setNetwork] = useState<string>(CRYPTO_NETWORKS[0].id);
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = (await fetch("/api/wallet").then((r) => r.json())) as Wallet;
    setW(data);
    if (data.payout?.method === "crypto") { setMethod("crypto"); setNetwork(data.payout.network); setAddress(data.payout.address); }
    if (data.payout?.method === "paypal") { setMethod("paypal"); setEmail(data.payout.email); }
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function save() {
    setBusy(true); setMsg(null);
    const body = method === "crypto" ? { method, network, address: address.trim() } : { method, email: email.trim() };
    const res = await fetch("/api/wallet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? "Could not save." });
    setMsg({ ok: true, text: "Payout destination saved." }); setEdit(false); load();
  }
  async function request() {
    if (!w) return;
    if (!confirm(`Request a payout of ${usd(w.balanceCents)} to ${w.payoutLabel}?`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/wallet", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? "Could not request a payout." });
    setMsg({ ok: true, text: "Payout requested. The IDÆVIA team reviews requests within 3 business days." }); load();
  }

  if (!w) return <section className="card p-6 text-sm text-ash">Loading wallet…</section>;
  const canRequest = w.balanceCents >= w.minPayoutCents && w.payout && w.pendingCents === 0;

  return (
    <section className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-graphite flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><BrandIcon name="wallet" size={16} /><h2 className="text-sm font-medium">Wallet & payouts</h2></div>
        <span className="text-[11px] text-ash">Marketplace earnings + 5% referral rewards</span>
      </div>
      <div className="p-6 grid md:grid-cols-[1.2fr_1fr] gap-6">
        <div>
          <div className="grid grid-cols-3 gap-3">
            <div><div className="label">Available</div><div className="mt-1 text-2xl font-semibold text-success">{usd(w.balanceCents)}</div></div>
            <div><div className="label">Pending payout</div><div className="mt-1 text-2xl font-semibold">{usd(w.pendingCents)}</div></div>
            <div><div className="label">Paid out</div><div className="mt-1 text-2xl font-semibold text-ash">{usd(w.paidOutCents)}</div></div>
          </div>
          <div className="mt-2 text-[11px] text-ash">Marketplace {usd(w.marketplaceEarnedCents)} · referrals {usd(w.referralEarnedCents)} · minimum payout {usd(w.minPayoutCents)}</div>
          <div className="mt-5 flex flex-wrap gap-2 items-center">
            <button disabled={!canRequest || busy} onClick={request} className="btn btn-primary btn-sm">Request payout {w.balanceCents > 0 ? `· ${usd(w.balanceCents)}` : ""}</button>
            {!w.payout && <span className="text-xs text-warning">Add a payout destination first.</span>}
            {w.payout && w.pendingCents > 0 && <span className="text-xs text-ash">A request is waiting for approval.</span>}
            {w.payout && w.pendingCents === 0 && w.balanceCents < w.minPayoutCents && <span className="text-xs text-ash">Available balance is below the minimum.</span>}
          </div>
          {msg && <div className={`mt-3 text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</div>}
          {w.requests.length > 0 && (
            <div className="mt-5 rounded-xl border border-graphite overflow-hidden">
              <table className="w-full text-xs"><tbody>
                {w.requests.slice(0, 6).map((r) => (
                  <tr key={r.id} className="border-b border-graphite/60 last:border-0">
                    <td className="p-2.5 text-ash whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="p-2.5 font-mono">{usd(r.amountCents)}</td>
                    <td className="p-2.5 text-ash">{r.method === "crypto" ? "Crypto" : "PayPal"}</td>
                    <td className="p-2.5 text-right"><span className={`pill text-[10px] ${r.status === "PAID" ? "border-success/40 text-success" : r.status === "REJECTED" ? "border-error/40 text-error" : "border-warning/40 text-warning"}`}>{r.status.toLowerCase()}</span>{r.note && <div className="mt-1 text-[10px] text-ash">{r.note}</div>}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-graphite p-4 bg-ink/40">
          <div className="flex items-center justify-between"><div className="label">Payout destination</div>{!edit && <button onClick={() => setEdit(true)} className="text-xs text-signal-soft hover:underline">{w.payout ? "Change" : "Add"}</button>}</div>
          {!edit ? (
            <div className="mt-2 text-sm">{w.payout ? w.payoutLabel : <span className="text-ash">Not set. Add a crypto wallet or PayPal to receive payouts.</span>}</div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMethod("crypto")} className={`btn btn-sm ${method === "crypto" ? "btn-primary" : "btn-outline"}`}>Crypto</button>
                <button type="button" onClick={() => setMethod("paypal")} className={`btn btn-sm ${method === "paypal" ? "btn-primary" : "btn-outline"}`}>PayPal</button>
              </div>
              {method === "crypto" ? (
                <>
                  <label className="block text-xs"><span className="label">Network / coin</span>
                    <select className="input mt-1" value={network} onChange={(e) => setNetwork(e.target.value)}>{CRYPTO_NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
                  </label>
                  <label className="block text-xs"><span className="label">Wallet address</span><input className="input mt-1 font-mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Paste the receiving address" spellCheck={false} /></label>
                  <p className="text-[11px] text-ash">Double-check the network: funds sent to the wrong network cannot be recovered.</p>
                </>
              ) : (
                <label className="block text-xs"><span className="label">PayPal email</span><input type="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
              )}
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => setEdit(false)} className="btn btn-outline btn-sm">Cancel</button><button type="button" disabled={busy} onClick={save} className="btn btn-primary btn-sm">Save</button></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
