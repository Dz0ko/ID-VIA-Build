"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X } from "@/components/icons";
import { CREDIT_PACKS, PLANS, type PlanId } from "@/lib/plans";
import { CREDIT_NOTICE_EVENT } from "@/lib/credit-notice";

export function CreditUpsell({ credits, plan }: { credits: number; plan: PlanId }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const warned = useRef(false);
  const pathname = usePathname();
  const [balance, setBalance] = useState(credits);
  const [needed, setNeeded] = useState<number | null>(null);
  useEffect(() => {
    function show(event: Event) {
      const detail = (event as CustomEvent<{ have?: number; needed?: number }>).detail;
      setBalance(Number.isFinite(detail?.have) ? detail.have! : credits);
      setNeeded(Number.isFinite(detail?.needed) ? detail.needed! : null);
      if (!dialog.current?.open) dialog.current?.showModal();
      warned.current = true;
    }
    window.addEventListener(CREDIT_NOTICE_EVENT, show);
    return () => window.removeEventListener(CREDIT_NOTICE_EVENT, show);
  }, [credits]);
  useEffect(() => {
    if (credits > 0) { warned.current = false; return; }
    if (warned.current || pathname.startsWith("/app/settings")) return;
    const timer = setTimeout(() => { setBalance(credits); setNeeded(null); dialog.current?.showModal(); warned.current = true; }, 350);
    return () => clearTimeout(timer);
  }, [credits, pathname]);
  return <dialog ref={dialog} className="credit-dialog m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-graphite bg-ink text-paper p-7 backdrop:bg-black/75" aria-labelledby="credit-dialog-title">
    <div className="flex items-center justify-between"><span className="label text-signal-soft">Keep your ideas moving</span><button className="btn btn-ghost btn-sm" aria-label="Close credit options" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
    <h2 id="credit-dialog-title" className="text-2xl font-semibold mt-4">{balance <= 0 ? "You’re out of AI credits." : "This task needs more credits."}</h2>
    <p className="text-sm text-ash mt-3 leading-relaxed">{needed ? `${needed.toLocaleString()} credits needed · ${Math.max(0, balance).toLocaleString()} available. ` : ""}Your projects and conversations are saved. {plan === "FREE" ? "Choose a plan to continue building. Credit top-ups unlock with a paid plan." : "Add a one-time credit pack or explore a plan with more monthly credits."}</p>
    <div className="mt-6"><div className="flex justify-between text-xs mb-3"><span>One-time credit packs</span><span className="text-ash">{PLANS[plan].name} plan</span></div><div className="grid grid-cols-2 gap-3">{CREDIT_PACKS.map(pack => <a key={pack.credits} href={plan === "FREE" ? "/app/settings#plans" : `/api/billing/pack?credits=${pack.credits}`} onClick={() => dialog.current?.close()} className="credit-pack"><strong>{pack.credits.toLocaleString()} <span className="text-xs font-normal text-ash">credits</span></strong><span className="text-sm text-fog">${pack.price} <span className="text-ash">USD · one time</span></span><span className="text-xs text-signal-soft">{plan === "FREE" ? "Choose a plan first" : "Buy top-up"} →</span></a>)}</div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-graphite"><button className="btn btn-ghost btn-sm" onClick={() => dialog.current?.close()}>Maybe later</button><Link href="/app/settings#plans" onClick={() => dialog.current?.close()} className="btn btn-primary">{plan === "FREE" ? "Choose a plan" : "Compare plans"} →</Link></div>
    <p className="text-[11px] text-ash mt-4">Checkout is handled by Whop. Credits are added after payment is confirmed.</p>
  </dialog>;
}
