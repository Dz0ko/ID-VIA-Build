"use client";

import { useState } from "react";
import { Copy, Check, Gift } from "@/components/icons";

export function ReferralCard({ url, invited, converted, creditsEarned, rewards }: { url: string; invited: number; converted: number; creditsEarned: number; rewards: { referredSignupCredits: number; referrerSignupCredits: number; referrerPaidCredits: number } }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  const share = `I build websites and apps with IDÆVIA. Sign up with my link and we both get free credits: ${url}`;
  return (
    <section className="card p-5 grid md:grid-cols-[1.4fr_1fr] gap-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium"><Gift size={15} className="text-signal-soft" />Invite friends, earn credits</div>
        <p className="mt-1 text-xs text-ash">Your friend gets <b className="text-paper">{rewards.referredSignupCredits} credits</b> on signup. You get <b className="text-paper">{rewards.referrerSignupCredits}</b> when they join and <b className="text-paper">{rewards.referrerPaidCredits}</b> more the first time they buy any plan.</p>
        <div className="mt-3 flex gap-2">
          <input readOnly value={url} className="input font-mono text-xs flex-1" onFocus={(e) => e.currentTarget.select()} />
          <button onClick={copy} className="btn btn-primary btn-sm shrink-0">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy link"}</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <a className="pill hover:border-signal" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(share)}`}>Share on X</a>
          <a className="pill hover:border-signal" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}>LinkedIn</a>
          <a className="pill hover:border-signal" href={`mailto:?subject=${encodeURIComponent("Free credits on IDÆVIA")}&body=${encodeURIComponent(share)}`}>Email</a>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center self-center">
        <div><div className="text-xl font-semibold">{invited}</div><div className="text-[10px] text-ash uppercase tracking-wider">Invited</div></div>
        <div><div className="text-xl font-semibold">{converted}</div><div className="text-[10px] text-ash uppercase tracking-wider">Went paid</div></div>
        <div><div className="text-xl font-semibold text-success">+{creditsEarned}</div><div className="text-[10px] text-ash uppercase tracking-wider">Credits earned</div></div>
      </div>
    </section>
  );
}
