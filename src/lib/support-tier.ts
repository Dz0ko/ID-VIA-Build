export function supportTier(plan: string): "premium" | "priority" | "standard" {
  return plan === "MAX" || plan === "AGENCY" ? "premium" : plan === "PRO" ? "priority" : "standard";
}
