import Link from "next/link";
import { Lock, ArrowRight } from "@/components/icons";
import { PLANS } from "@/lib/plans";

/** Shown to Free users on the Learn pages: the course unlocks with the Starter plan. */
export function LearnLocked() {
  return (
    <div className="rounded-2xl border border-signal/40 bg-signal/10 p-5 flex flex-col md:flex-row md:items-center gap-4">
      <span className="w-10 h-10 rounded-xl bg-signal/20 text-signal-soft grid place-items-center shrink-0"><Lock size={18} /></span>
      <div className="flex-1">
        <div className="text-sm font-medium">The Academy is included with Starter and above</div>
        <p className="text-xs text-fog mt-1">All 18 lessons, the two tutorials and the glossary unlock with the {PLANS.STARTER.name} plan (${PLANS.STARTER.price}/mo), together with {PLANS.STARTER.credits} credits, vision, imports and the production audit.</p>
      </div>
      <Link href="/pricing" className="btn btn-signal btn-sm shrink-0">See plans<ArrowRight size={13} /></Link>
    </div>
  );
}
