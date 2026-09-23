"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "@/components/icons";
import type { Announcement } from "@/lib/announcements";

export function AnnouncementBanner({ userId }: { userId: string }) {
  const [item, setItem] = useState<Announcement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/announcements", { cache: "no-store" });
        if (!response.ok) return;
        const { announcement } = await response.json();
        let dismissed = false;
        try { dismissed = localStorage.getItem(`idaevia-announcement:${userId}`) === announcement?.id; } catch {}
        if (!cancelled) setItem(dismissed ? null : announcement);
      } catch { /* Keep the workspace usable when offline. */ }
    }
    void refresh(); const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [userId]);
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => setItem(null), Math.max(0, Math.min(2147483647, Date.parse(item.expiresAt) - Date.now())));
    return () => clearTimeout(timer);
  }, [item]);
  if (!item) return null;
  return <>
    <aside className="announcement-banner" aria-label="Platform announcement"><span className="announcement-badge">News</span><p className="min-w-0 flex-1 truncate">{item.subject}</p><button className="announcement-action" onClick={() => dialog.current?.showModal()}>View details <span aria-hidden="true">↗</span></button><button className="btn btn-ghost btn-sm" aria-label="Dismiss announcement" onClick={() => { try { localStorage.setItem(`idaevia-announcement:${userId}`, item.id); } catch {} setItem(null); }}><X size={14} /></button></aside>
    <dialog ref={dialog} className="promotion-dialog m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-graphite bg-ink text-paper p-6 backdrop:bg-black/70" aria-labelledby="announcement-title"><div className="flex justify-between gap-4"><p className="label text-signal-soft">IDÆVIA · News & offers</p><button aria-label="Close announcement" className="btn btn-ghost btn-sm" onClick={() => dialog.current?.close()}><X size={18} /></button></div><h2 id="announcement-title" className="text-2xl font-semibold mt-4">{item.subject}</h2><p className="text-sm text-fog whitespace-pre-wrap leading-relaxed my-5">{item.body}</p>{item.ctaUrl && <a href={item.ctaUrl} className="btn btn-primary" onClick={() => dialog.current?.close()}>{item.ctaLabel || "Learn more"} →</a>}</dialog>
  </>;
}
