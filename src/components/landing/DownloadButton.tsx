"use client";

import { useEffect, useRef, useState } from "react";

type Os = "mac" | "win" | "linux" | "mobile" | "unknown";

const OPTIONS = [
  { id: "mac", label: "Download for macOS", href: "/download?os=mac" },
  { id: "win", label: "Download for Windows", href: "/download?os=win" },
  { id: "web", label: "Open the web app", href: "/signup" },
] as const;

function detect(): Os {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua) && window.innerWidth < 1024)) return "mobile";
  if (/Mac/.test(ua)) return "mac";
  if (/Win/.test(ua)) return "win";
  if (/Linux|X11|CrOS/.test(ua)) return "linux";
  return "unknown";
}

export function useDevice() {
  const [os, setOs] = useState<Os | null>(null);
  useEffect(() => { const t = setTimeout(() => setOs(detect()), 0); return () => clearTimeout(t); }, []);
  return os;
}

/**
 * Device-aware primary action: macOS / Windows get their installer, Linux and unknown
 * get the web app, phones and tablets get a notice (the product is desktop-only).
 */
export function DownloadButton({ size = "lg", loggedIn = false }: { size?: "lg" | "sm"; loggedIn?: boolean }) {
  const os = useDevice();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const pad = size === "lg" ? "px-5 py-3.5 text-[15px]" : "px-4 py-2 text-sm";
  if (os === null) return <span className={`inline-flex rounded-xl bg-paper/10 ${pad} min-w-[200px] h-[46px]`} aria-hidden />;
  if (os === "mobile") return <MobileNotice size={size} />;

  const main = os === "mac" ? OPTIONS[0] : os === "win" ? OPTIONS[1] : { id: "web" as const, label: loggedIn ? "Open your workspace" : "Start free in the browser", href: loggedIn ? "/app" : "/signup" };
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
        <div className="absolute right-0 top-full mt-2 min-w-[230px] rounded-xl border border-graphite bg-ink p-1.5 shadow-2xl z-50 pop-in">
          {OPTIONS.map((d) => (
            <a key={d.id} href={d.id === "web" && loggedIn ? "/app" : d.href} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-fog hover:bg-graphite hover:text-paper">{d.label}{d.id === os && <span className="text-[10px] text-ash">your device</span>}</a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Shown instead of a download on phones and tablets. */
export function MobileNotice({ size = "lg" }: { size?: "lg" | "sm" }) {
  if (size === "sm") return <a href="/signup" className="btn btn-primary btn-sm">Create account</a>;
  return (
    <div className="rounded-2xl border border-graphite bg-ink/70 px-5 py-4 text-left max-w-sm mx-auto">
      <div className="text-sm font-medium">IDÆVIA Build is a desktop tool</div>
      <p className="mt-1 text-xs text-ash leading-relaxed">Use it in a browser on your computer, or download the app for macOS or Windows. You can create your account now and pick up on desktop.</p>
      <a href="/signup" className="btn btn-primary btn-sm mt-3">Create account</a>
    </div>
  );
}
