"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "@/components/icons";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#product", label: "Product" },
  { href: "#agents", label: "Agents" },
  { href: "#templates", label: "Templates" },
  { href: "#pricing", label: "Pricing" },
];

/** Hamburger menu for the landing header on screens below md. */
export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(true)} aria-label="Open menu" className="w-10 h-10 grid place-items-center rounded-full text-fog hover:text-paper hover:bg-ink"><Menu size={20} /></button>
      {open && (
        <div className="fixed inset-0 z-50 bg-void/95 backdrop-blur-xl flex flex-col p-6 animate-[fade-in_.2s_ease-out]">
          <div className="flex items-center justify-between h-10">
            <span className="wordmark text-sm">IDÆVIA</span>
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="w-10 h-10 grid place-items-center rounded-full text-fog hover:text-paper hover:bg-ink"><X size={20} /></button>
          </div>
          <nav className="mt-10 flex flex-col gap-1">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-2xl font-medium py-3 border-b border-graphite/60 text-paper">{l.label}</a>
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
      )}
    </div>
  );
}
