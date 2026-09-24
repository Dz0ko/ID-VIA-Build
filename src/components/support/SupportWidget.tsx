"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, X } from "@/components/icons";
import { SupportChat } from "./SupportChat";

export function SupportWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const fullPage = pathname === "/app/support";
  const visible = open && !fullPage;
  const project = /^\/app\/projects\/[^/]+$/.test(pathname);
  function close() { setOpen(false); launcher.current?.focus(); }
  useEffect(() => {
    if (!visible) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); launcher.current?.focus(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [visible]);
  return <div className="support-widget" data-project={project} data-open={visible} hidden={fullPage}>
    {started && <section id="support-widget-panel" className="support-widget-panel" role="dialog" aria-label="Live support" hidden={!visible}>
      <div className="support-widget-toolbar"><span className="support-widget-brand">Æ<span /> <span>Here to help</span></span><div className="flex items-center gap-1"><Link href="/app/support" title="Open full conversation" aria-label="Open full support conversation" className="btn btn-ghost btn-sm"><ExternalLink size={15} /></Link><button ref={closeButton} onClick={close} className="btn btn-ghost btn-sm" aria-label="Close live support"><X size={18} /></button></div></div>
      <SupportChat active={visible} />
    </section>}
    <div className="support-launcher-dock"><button ref={launcher} className="support-launcher" aria-label={visible ? "Minimize live support" : "Open live support"} aria-expanded={visible} aria-controls={started ? "support-widget-panel" : undefined} onClick={() => { if (visible) close(); else { setStarted(true); setOpen(true); } }}>
      {visible ? <X size={23} /> : <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M23 13.5c0 5-4 9-9.5 9-1.5 0-3-.3-4.2-1L4 23l1.5-5A9 9 0 0 1 4 13.5C4 8.5 8 4.5 13.5 4.5S23 8.5 23 13.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 11h9M9 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
      {!visible && <span className="support-launcher-dot" />}
      <span className="support-launcher-label">Live support</span>
    </button></div>
  </div>;
}
