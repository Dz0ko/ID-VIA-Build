import assert from "node:assert/strict";
import { test } from "node:test";
import { commissionFor, paymentAmounts, profitSummary, retainedRatio, usdCents } from "../src/lib/payment-math";
import { signReferral, verifyReferral } from "../src/lib/referral-cookie";

test("$100 gross, $20 AI, $3 fees and $5 referral produces $72 net", () => {
  const s = profitSummary({ grossCents: 10000, aiCostCents: 2000, feeCents: 300, referralCents: commissionFor(10000), affiliateCents: 0, sellerCents: 0, returnedCents: 0, expensesCents: 0 });
  assert.equal(s.netCents, 7200); assert.equal(s.marginPct, 72);
});
test("revenue excludes tax; absent fees remain unknown", () => {
  assert.deepEqual(paymentAmounts({ currency: "usd", subtotal: 100, total: 120, tax_amount: 20 }), { grossCents: 10000, feeCents: null });
  assert.deepEqual(paymentAmounts({ currency: "usd", subtotal: 120, tax_behavior: "inclusive", tax_amount: 20, fees: [{ amount: 3, currency: "usd" }] }), { grossCents: 10000, feeCents: 300 });
  for (const data of [{ currency: "eur", subtotal: 100 }, { currency: "usd" }, { currency: "usd", subtotal: 0 }]) assert.throws(() => paymentAmounts(data));
  for (const value of [null, undefined, "", NaN, Infinity, -1]) assert.equal(usdCents(value), null);
  assert.equal(commissionFor(9900), 495);
});
test("refunds and disputes cannot double-subtract the same sale", () => {
  assert.equal(retainedRatio(10000, 2500, 10000), 0);
  assert.equal(retainedRatio(10000, 2500, 0), 0.75);
  assert.equal(retainedRatio(0, 0, 0), 0);
});
test("attribution rejects forged IDs, signatures and expired links", () => {
  process.env.AUTH_SECRET = "test-only-secret-that-is-at-least-32-characters";
  const cookie = signReferral("user", "referrer", 1000);
  assert.deepEqual(verifyReferral(cookie, 2000), { kind: "user", id: "referrer" });
  assert.equal(verifyReferral(cookie.replace("referrer", "attacker"), 2000), null);
  assert.equal(verifyReferral(cookie, 31 * 86400000), null);
  assert.equal(verifyReferral("u:referrer", 2000), null);
});
