"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X } from "@/components/icons";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#agents", label: "Agents" },
  { href: "#templates", label: "Templates" },
  { href: "#pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/download", label: "Download app" },
];

/** Hamburger menu for the landing header on screens below md. */
export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    const media = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => { document.body.style.overflow = previous; media.removeEventListener("change", closeOnDesktop); };
  }, [open]);
  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-navigation" className="w-10 h-10 grid place-items-center rounded-full text-fog hover:text-paper hover:bg-ink"><Menu size={20} /></button>
      {open && createPortal(
        <dialog ref={dialog} id="mobile-navigation" aria-label="Navigation" onCancel={() => setOpen(false)} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-void text-paper border-0 p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop:bg-void">
          <div className="min-h-full flex flex-col">
          <div className="flex items-center justify-between h-10">
            <span className="wordmark text-sm">IDÆVIA</span>
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="w-10 h-10 grid place-items-center rounded-full text-fog hover:text-paper hover:bg-ink"><X size={20} /></button>
          </div>
          <nav className="my-6 flex flex-col gap-1">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-xl font-medium py-2.5 border-b border-graphite/60 text-paper">{l.label}</a>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2">
            {loggedIn ? (
              <Link href="/app" onClick={() => setOpen(false)} className="btn btn-signal w-full py-3.5">Open workspace</Link>
            ) : (
              <>
                <Link href="/signup" onClick={() => setOpen(false)} className="btn btn-signal w-full py-3.5">Start building free</Link>
                <Link href="/login" onClick={() => setOpen(false)} className="btn btn-outline w-full py-3.5">Log in</Link>
              </>
            )}
            <p className="text-[11px] text-ash text-center mt-2">The workspace runs on desktop. Sign up here, build on your computer.</p>
          </div>
          </div>
        </dialog>, document.body
      )}
    </div>
  );
}
