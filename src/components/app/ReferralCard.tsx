"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Check, Gift } from "@/components/icons";

export function ReferralCard({ url, invited, converted, creditsEarned, rewards, cashEarnedCents, history }: { cashEarnedCents: number; history: { id: string; amountCents: number; commissionCents: number; reversedCents: number; createdAt: string }[]; url: string; invited: number; converted: number; creditsEarned: number; rewards: { referredSignupCredits: number; referrerSignupCredits: number; referrerPaidCredits: number } }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  const share = `I build websites and apps with IDÆVIA. Sign up with my link and we both get free credits: ${url}`;
  return (
    <section className="card p-5 grid md:grid-cols-[1.4fr_1fr] gap-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium"><Gift size={15} className="text-signal-soft" />Invite friends, earn credits + 5%</div>
        <p className="mt-1 text-xs text-ash">Your friend gets <b className="text-paper">{rewards.referredSignupCredits} credits</b> on signup. You get <b className="text-paper">{rewards.referrerSignupCredits}</b> when they join and <b className="text-paper">{rewards.referrerPaidCredits}</b> more the first time they buy any plan.</p>
        <p className="mt-3 text-sm text-fog">Earn <strong className="text-signal-soft">5% of every paid plan payment</strong> from friends who signed up through your link, including renewals. No commission on credit packs or marketplace orders. Refunds and disputes adjust earnings.</p>
        <p className="mt-2 text-xs text-ash">Signup bonuses are limited to 10 invites per 30 days. Cash rewards go to your wallet, with a $10 minimum withdrawal via Crypto or PayPal after admin review.</p>
        <div className="mt-3 flex gap-2">
          <input aria-label="Your referral link" readOnly value={url} className="input font-mono text-xs flex-1" onFocus={(e) => e.currentTarget.select()} />
          <button onClick={copy} className="btn btn-primary btn-sm shrink-0">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy link"}</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <a className="pill hover:border-signal" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(share)}`}>Share on X</a>
          <a className="pill hover:border-signal" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}>LinkedIn</a>
          <a className="pill hover:border-signal" href={`mailto:?subject=${encodeURIComponent("Free credits on IDÆVIA")}&body=${encodeURIComponent(share)}`}>Email</a>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center self-center">
        <div><div className="text-xl font-semibold">{invited}</div><div className="text-[10px] text-ash uppercase tracking-wider">Invited</div></div>
        <div><div className="text-xl font-semibold">{converted}</div><div className="text-[10px] text-ash uppercase tracking-wider">Went paid</div></div>
        <div><div className="text-xl font-semibold text-success">+{creditsEarned}</div><div className="text-[10px] text-ash uppercase tracking-wider">Credits earned</div></div>
        <div><div className="text-xl font-semibold text-signal-soft">${(cashEarnedCents / 100).toFixed(2)}</div><div className="text-[10px] text-ash uppercase tracking-wider">Cash earned</div></div>
        <Link href="/app/profile?section=wallet" className="col-span-2 btn btn-outline btn-sm mt-3">Manage wallet & payouts →</Link>
      </div>
      <div className="md:col-span-2 border-t border-graphite pt-4"><h3 className="text-sm font-medium mb-3">Recent referral earnings</h3>{history.length ? <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-ash"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-right">Plan payment</th><th className="p-2 text-right">5% reward</th><th className="p-2 text-right">Refund adjustment</th></tr></thead><tbody>{history.map((h) => <tr key={h.id} className="border-t border-graphite"><td className="p-2">{new Date(h.createdAt).toLocaleDateString()}</td><td className="p-2 text-right">${(h.amountCents / 100).toFixed(2)}</td><td className="p-2 text-right text-signal-soft">${(h.commissionCents / 100).toFixed(2)}</td><td className="p-2 text-right">−${(h.reversedCents / 100).toFixed(2)}</td></tr>)}</tbody></table></div> : <p className="text-xs text-ash">Your rewards appear here after a referred friend pays for a plan.</p>}</div>
    </section>
  );
}
