"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function PlatformErrorAlert() {
  const [summary, setSummary] = useState<{ openCount: number; criticalCount: number } | null>(null);
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
  if (!unavailable && !summary?.openCount) return null;
  return <Link href="/admin/errors" className="block border-b border-graphite bg-ink px-8 py-3 text-sm text-signal-soft" role="status" aria-live="polite">{unavailable ? "Error monitoring is unavailable. Open Platform errors to check." : `${summary!.openCount} platform incident${summary!.openCount === 1 ? " needs" : "s need"} attention${summary!.criticalCount ? ` · ${summary!.criticalCount} critical` : ""}. View details →`}</Link>;
}
