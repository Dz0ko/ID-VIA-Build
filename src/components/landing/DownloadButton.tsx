"use client";

import { useEffect, useRef, useState } from "react";

const DOWNLOADS = [
  { id: "mac", label: "Download for macOS", short: "macOS", href: "/download?os=mac" },
  { id: "win", label: "Download for Windows", short: "Windows", href: "/download?os=win" },
  { id: "web", label: "Use in the browser", short: "Web app", href: "/signup" },
];

/** Tempo-style primary download button with an OS dropdown; detects the visitor's OS. */
export function DownloadButton({ size = "lg" }: { size?: "lg" | "sm" }) {
  const [open, setOpen] = useState(false);
  const [os, setOs] = useState<"mac" | "win" | "web">("mac");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const ua = navigator.userAgent;
      setOs(/Mac|iPhone|iPad/.test(ua) ? "mac" : /Win/.test(ua) ? "win" : "web");
    }, 0);
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => { clearTimeout(t); document.removeEventListener("click", onDoc); };
  }, []);
  const main = DOWNLOADS.find((d) => d.id === os)!;
  const pad = size === "lg" ? "px-5 py-3.5 text-[15px]" : "px-4 py-2 text-sm";
  return (
    <div ref={ref} className="relative inline-flex">
      <a href={main.href} className={`inline-flex items-center gap-2.5 rounded-l-xl bg-paper text-void font-semibold ${pad} hover:bg-white transition`}>
        {os === "mac" && <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.9-1.1-2.9-4zM14 5.3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>}
        {os === "win" && <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M3 5.5 11 4.4v7.2H3V5.5zm9-1.2L22 3v8.6h-10V4.3zM3 12.4h8v7.2L3 18.5v-6.1zm9 0h10V21l-10-1.4v-7.2z"/></svg>}
        {main.label}
      </a>
      <button type="button" aria-label="Other platforms" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`inline-flex items-center rounded-r-xl border-l border-void/15 bg-paper text-void ${size === "lg" ? "px-3" : "px-2.5"} hover:bg-white transition`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[220px] rounded-xl border border-graphite bg-ink p-1.5 shadow-2xl z-50 pop-in">
          {DOWNLOADS.map((d) => (
            <a key={d.id} href={d.href} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-fog hover:bg-graphite hover:text-paper">{d.label}{d.id === os && <span className="text-[10px] text-ash">detected</span>}</a>
          ))}
        </div>
      )}
    </div>
  );
}
