"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ReconcilePaymentsButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  return <div className="space-y-2"><button className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/admin/finance/reconcile", { method: "POST" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Reconciliation failed.");
      setMessage(`${d.imported} events reconciled; ${d.remaining} remaining.${d.unresolved.length ? ` ${d.unresolved.length} need review: check Whop payment read permissions and checkout attribution.` : ""}`);
      router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Reconciliation failed."); }
    finally { setBusy(false); }
  }}>{busy ? "Checking Whop…" : "Reconcile 10 legacy payment events"}</button><p className="text-xs text-ash">Imports verified payment history without paying rewards or granting credits again.</p>{message && <p role="status" className="text-xs text-signal-soft">{message}</p>}</div>;
}
