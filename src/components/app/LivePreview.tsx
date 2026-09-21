"use client";

import { useState } from "react";
import { Maximize2, X } from "lucide-react";

/**
 * Sandboxed live demo of a component or effect. Scripts run inside the iframe
 * only (no same-origin access), so hover/scroll/cursor effects are real.
 */
export function LivePreview({ html, title, height = 176 }: { html: string; title: string; height?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative group rounded-xl overflow-hidden border border-graphite bg-void" style={{ height }}>
        <iframe srcDoc={html} title={`${title} preview`} sandbox="allow-scripts" loading="lazy" className="w-full h-full block" />
        <button type="button" onClick={() => setOpen(true)} title="Open large preview" className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-void/80 border border-graphite text-ash hover:text-paper grid place-items-center opacity-0 group-hover:opacity-100 transition"><Maximize2 size={12} /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-void/85 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-4xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-graphite"><span className="text-sm font-medium">{title}</span><button onClick={() => setOpen(false)} className="text-ash hover:text-paper"><X size={16} /></button></div>
            <iframe srcDoc={html} title={`${title} large preview`} sandbox="allow-scripts" className="w-full block" style={{ height: "60vh" }} />
          </div>
        </div>
      )}
    </>
  );
}
