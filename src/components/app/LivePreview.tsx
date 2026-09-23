"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "@/components/icons";

/** Only visible demos run. Sandboxed frames have no parent DOM, cookies or navigation access. */
export function LivePreview({ html, title, height = 176 }: { html: string; title: string; height?: number }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "100px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <>
    <div ref={container} className="relative group rounded-xl overflow-hidden border border-graphite bg-void" style={{ height }}>
      {visible && !open ? <iframe srcDoc={html} title={`${title} preview`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="w-full h-full block" /> : <div className="h-full grid place-items-center text-xs text-ash">{open ? "Preview expanded" : "Preview loads when visible"}</div>}
      <button type="button" onClick={() => setOpen(true)} aria-label={`Expand ${title} preview`} title="Open large preview" className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-void/80 border border-graphite text-ash hover:text-paper grid place-items-center focus-visible:outline-2 focus-visible:outline-paper"><Maximize2 size={12} /></button>
    </div>
    <dialog ref={dialog} aria-label={`${title} expanded preview`} onClose={() => setOpen(false)} className="m-auto w-[calc(100%-2rem)] max-w-4xl rounded-2xl overflow-hidden border border-graphite bg-ink text-paper p-0 backdrop:bg-black/80">
      <div className="flex items-center justify-between px-4 py-3 border-b border-graphite"><span className="text-sm font-medium">{title}</span><button type="button" onClick={() => setOpen(false)} aria-label="Close preview" className="btn btn-ghost btn-sm"><X size={16} /></button></div>
      {open && <iframe srcDoc={html} title={`${title} large preview`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="w-full h-[65vh] block" />}
    </dialog>
  </>;
}
