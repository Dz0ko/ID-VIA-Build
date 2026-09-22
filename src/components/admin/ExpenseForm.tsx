"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExpenseForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 items-end" onSubmit={async (e) => {
    e.preventDefault(); if (busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: Math.round(Number(data.get("amount")) * 100), category: data.get("category"), note: data.get("note"), incurredAt: new Date(String(data.get("date"))).toISOString() }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save expense.");
      form.reset(); setMessage("Expense recorded."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save expense."); }
    finally { setBusy(false); }
  }}>
    <label className="text-xs text-ash">Amount (USD)<input className="input mt-1" type="number" name="amount" min="0.01" step="0.01" required /></label>
    <label className="text-xs text-ash">Category<select className="input mt-1" name="category"><option value="hosting">Hosting</option><option value="tax">Tax</option><option value="payout_fee">Payout / missing payment fee</option><option value="provider_adjustment">Additional provider cost</option><option value="other">Other</option></select></label>
    <label className="text-xs text-ash">Date<input className="input mt-1" type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
    <label className="text-xs text-ash">Description<input className="input mt-1" name="note" minLength={3} maxLength={300} required /></label>
    <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Record expense"}</button>
    {message && <p className="sm:col-span-2 xl:col-span-5 text-sm text-signal-soft" role="status">{message}</p>}
  </form>;
}
