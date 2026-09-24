"use client";
import { useCallback, useEffect, useState } from "react";

type Health = { provider: "anthropic" | "openai"; label: string; state: "healthy" | "billing" | "auth" | "capacity"; message?: string; since?: string; lastAt?: string; occurrences?: number; billingUrl: string };
const STATE: Record<Health["state"], { label: string; tone: string; hint: string }> = {
  healthy: { label: "Working", tone: "text-success border-success/40", hint: "The last request to this provider succeeded." },
  billing: { label: "No credits", tone: "text-red-400 border-red-400/40", hint: "The platform account has no API credits. Top up, then check again." },
  auth: { label: "Key rejected", tone: "text-red-400 border-red-400/40", hint: "The provider rejected the platform's API key. Check the hosting environment variables." },
  capacity: { label: "Rate-limited", tone: "text-amber-400 border-amber-400/40", hint: "Temporary rate limit or overload; requests fall back to the other provider." },
};
const date = (value?: string) => value ? new Date(value).toLocaleString() : "—";

export function ProviderHealthPanel() {
  const [providers, setProviders] = useState<Health[] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [checkedAt, setCheckedAt] = useState("");
  const load = useCallback(async (probe = false, signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/providers", { method: probe ? "POST" : "GET", cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load provider status.");
      if (!signal?.aborted) { setProviders(body.providers); setCheckedAt(body.checkedAt); setError(""); }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Provider status is unavailable."); }
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const tick = async () => { if (!document.hidden) await load(false, controller.signal); if (!controller.signal.aborted) timer = setTimeout(tick, 15000); };
    timer = setTimeout(tick, 100);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load]);
  const probe = async () => { setBusy(true); try { await load(true); } finally { setBusy(false); } };
  return <section aria-label="AI provider accounts" className="rounded-2xl border border-graphite bg-ink p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-base font-semibold">AI provider accounts</h2><p className="mt-1 text-xs text-ash">When a provider runs out of API credits or rejects its key, an alert shows here and every administrator is emailed (at most once per 6 hours). Generations fall back to the other provider while it is available.</p></div>
      <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void probe()}>{busy ? "Checking…" : "Check providers now"}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {(providers ?? []).map(p => <div key={p.provider} className="rounded-xl border border-graphite bg-void p-4">
        <div className="flex items-center justify-between gap-3"><div className="font-medium">{p.label}</div><span className={`pill text-[10px] ${STATE[p.state].tone}`}>{STATE[p.state].label}</span></div>
        <p className="mt-2 text-xs text-fog">{STATE[p.state].hint}</p>
        {p.state !== "healthy" && <div className="mt-3 space-y-1 text-xs text-ash"><div>Since {date(p.since)} · last seen {date(p.lastAt)}{p.occurrences ? ` · ${p.occurrences}×` : ""}</div>{p.message && <div className="font-mono break-words">{p.message}</div>}</div>}
        {p.state === "billing" && <a className="btn btn-primary btn-sm mt-3" href={p.billingUrl} target="_blank" rel="noreferrer">Top up {p.label.split(" ")[0]} ↗</a>}
      </div>)}
      {!providers && !error && <p className="text-sm text-ash">Loading provider status…</p>}
    </div>
    {checkedAt && <p className="text-xs text-ash">Checked {date(checkedAt)}</p>}
  </section>;
}
