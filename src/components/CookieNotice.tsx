"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "idaevia_cookie_notice";

/** Informational cookie notice (only strictly necessary cookies are used, so no consent gating). */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (!document.cookie.split("; ").some((c) => c.startsWith(`${KEY}=`))) setShow(true);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      document.cookie = `${KEY}=1; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  return (
    <div role="dialog" aria-label="Cookie notice" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[90] rounded-2xl border border-graphite bg-ink/95 backdrop-blur p-4 shadow-2xl text-sm">
      <p className="text-fog">We use cookies to sign you in and run the app, plus anonymous traffic analytics from Whop. No ads.{" "}
        <Link href="/cookies" className="text-paper underline">Cookie Policy</Link>
      </p>
      <div className="mt-3 flex justify-end">
        <button onClick={dismiss} className="btn btn-primary btn-sm">Got it</button>
      </div>
    </div>
  );
}
