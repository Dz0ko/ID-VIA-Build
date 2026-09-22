/** Money is always rounded once into integer USD cents at the API boundary. */
export function usdCents(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return Math.round(n * 100);
}

export const REFERRAL_PERCENT = 5;
export function commissionFor(amountCents: number, pct = REFERRAL_PERCENT) {
  return Math.round(amountCents * pct / 100);
}

/** Refund/dispute overlaps must not remove the same dollar twice. */
export function retainedRatio(gross: number, refunded: number, disputed: number) {
  return gross > 0 ? Math.max(0, gross - Math.min(gross, Math.max(refunded, disputed))) / gross : 0;
}

export function paymentAmounts(data: Record<string, unknown>) {
  if (String(data.currency).toLowerCase() !== "usd") throw new Error("Unsupported payment currency");
  // Whop subtotal excludes buyer fees; inclusive taxes must not become our revenue.
  const subtotal = usdCents(data.subtotal);
  const total = usdCents(data.total ?? data.final_amount);
  const tax = usdCents(data.tax_amount) ?? 0;
  const grossCents = subtotal !== null
    ? subtotal - (data.tax_behavior === "inclusive" ? tax : 0)
    : total !== null ? total - tax : null;
  if (grossCents === null || grossCents <= 0) throw new Error("Missing positive payment amount");
  let feeCents: number | null = null;
  if (Array.isArray(data.fees)) {
    const values = data.fees.map((fee: { amount?: unknown; currency?: unknown }) =>
      String(fee.currency).toLowerCase() === "usd" ? usdCents(fee.amount) : null);
    if (values.every((n) => n !== null)) feeCents = values.reduce<number>((s, n) => s + (n ?? 0), 0);
  } else {
    const after = usdCents(data.amount_after_fees);
    if (after !== null && after <= grossCents) feeCents = grossCents - after;
  }
  return { grossCents, feeCents };
}

export function profitSummary(input: {
  grossCents: number; returnedCents: number; feeCents: number; sellerCents: number;
  referralCents: number; affiliateCents: number; aiCostCents: number; expensesCents: number;
}) {
  const netCents = input.grossCents - input.returnedCents - input.feeCents - input.sellerCents
    - input.referralCents - input.affiliateCents - input.aiCostCents - input.expensesCents;
  return { ...input, netCents, marginPct: input.grossCents ? netCents / input.grossCents * 100 : null };
}
