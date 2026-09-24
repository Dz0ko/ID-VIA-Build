import type { PlanId } from "./plans";

export const CREDIT_NOTICE_EVENT = "idaevia:credits-required";
export const PLAN_NOTICE_EVENT = "idaevia:plan-required";

export type PlanNotice = { code: "PLAN" | "AGENT_LOCKED" | "PROJECT_LIMIT"; message?: string; minPlan?: PlanId; minPlanName?: string };

export function notifyCreditShortfall(detail: { have?: number; needed?: number }) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CREDIT_NOTICE_EVENT, { detail }));
}

export function notifyPlanLimit(detail: PlanNotice) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PLAN_NOTICE_EVENT, { detail }));
}

/**
 * A response that says "not enough credits" or "not on your plan" is an offer, not a failure: it opens the
 * upgrade dialog and returns true so the caller shows no error. Anything else returns false.
 */
export function notifyLimit(body: { code?: string; error?: string; message?: string; have?: number; needed?: number; minPlan?: PlanId; minPlanName?: string } | null | undefined): boolean {
  if (!body?.code) return false;
  if (body.code === "INSUFFICIENT_CREDITS") { notifyCreditShortfall({ have: body.have, needed: body.needed }); return true; }
  if (body.code === "PLAN" || body.code === "AGENT_LOCKED" || body.code === "PROJECT_LIMIT") { notifyPlanLimit({ code: body.code, message: body.error ?? body.message, minPlan: body.minPlan, minPlanName: body.minPlanName }); return true; }
  return false;
}

/** Thrown by a client flow after the dialog opened, so the usual error handling stays quiet. */
export class LimitNotice extends Error {
  constructor(message = "This needs more credits or a bigger plan.") { super(message); this.name = "LimitNotice"; }
}
