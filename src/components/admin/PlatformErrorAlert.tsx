"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function PlatformErrorAlert() {
  const [summary, setSummary] = useState<{ openCount: number; criticalCount: number; providers?: { label: string; state: string }[] } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      if (!controller.signal.aborted && !document.hidden) {
        try {
          const response = await fetch("/api/admin/errors?summary=1", { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error();
          const data = await response.json();
          if (!controller.signal.aborted) { setSummary(data); setUnavailable(false); }
        } catch { if (!controller.signal.aborted) setUnavailable(true); }
      }
      if (!controller.signal.aborted) timer = setTimeout(tick, 10000);
    }
    void tick(); return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  const outage = summary?.providers?.find(p => p.state === "billing" || p.state === "auth");
  if (!unavailable && !summary?.openCount && !outage) return null;
  const text = unavailable ? "Error monitoring is unavailable. Open Platform errors to check."
    : outage ? `${outage.label} API ${outage.state === "billing" ? "has no credits: top up the account" : "rejected its API key: check the key"}. Generations use the other provider meanwhile. Open Platform errors →`
    : `${summary!.openCount} platform incident${summary!.openCount === 1 ? " needs" : "s need"} attention${summary!.criticalCount ? ` · ${summary!.criticalCount} critical` : ""}. View details →`;
  return <Link href="/admin/errors" className={`block border-b border-graphite px-8 py-3 text-sm ${outage ? "bg-red-950/60 text-red-200 font-medium" : "bg-ink text-signal-soft"}`} role={outage ? "alert" : "status"} aria-live={outage ? "assertive" : "polite"}>{text}</Link>;
}
