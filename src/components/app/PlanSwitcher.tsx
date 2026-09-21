"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";

export function PlanSwitcher({ current, whopEnabled, checkout }: { current: PlanId; whopEnabled: boolean; checkout: Partial<Record<PlanId, boolean>> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<PlanId | null>(null);
  async function devSwitch(plan: PlanId) {
    setBusy(plan);
    await fetch("/api/billing/dev-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    setBusy(null);
    router.refresh();
  }
  return (
    <div className="grid md:grid-cols-5 gap-3">
      {PLAN_ORDER.map((id) => {
        const p = PLANS[id];
        const isCurrent = id === current;
        return (
          <div key={id} className={`card p-4 flex flex-col ${isCurrent ? "border-signal" : ""}`}>
            <div className="text-sm font-medium">{p.name}</div>
            <div className="text-2xl font-semibold mt-1">${p.price}<span className="text-xs text-ash font-normal">/mo</span></div>
            <div className="text-xs text-ash mt-1 flex-1">{p.credits.toLocaleString()} credits · {p.agentLimit === "all" ? "all" : p.agentLimit} agents</div>
            {isCurrent ? (
              <span className="pill mt-3 self-start text-signal-soft border-signal">Current plan</span>
            ) : whopEnabled ? (
              id === "FREE" ? <span className="text-[11px] text-ash mt-3">Cancel in Whop to return to Free</span> : (
                checkout[id]
                  ? <a href={`/api/billing/checkout?plan=${id}`} className="btn btn-primary btn-sm mt-3">Upgrade</a>
                  : <button disabled className="btn btn-outline btn-sm mt-3 opacity-60">Temporarily unavailable</button>
              )
            ) : (
              <button disabled={busy !== null} onClick={() => devSwitch(id)} className="btn btn-outline btn-sm mt-3">{busy === id ? "…" : "Switch (local dev)"}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
