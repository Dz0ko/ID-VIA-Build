import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import { POST as whopWebhook } from "../src/app/api/webhooks/whop/route";
import { db } from "../src/lib/db";
import { settlePayment, adjustPayment } from "../src/lib/billing-ledger";
import { reserveCredits, finalizeCredits, releaseCredits, renewCreditsIfDue } from "../src/lib/credits";
import { PLANS, CREDIT_PACKS } from "../src/lib/plans";

if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Tests require an isolated schema");
let counter = 0;
const uid = () => `fixture_${++counter}`;
async function user(extra = {}) { return db.user.create({ data: { email: `${uid()}@security.invalid`, ...extra } }); }
async function checkout(buyerId: string, kind = "plan", extra = {}) {
  return db.whopCheckout.create({ data: { id: uid(), userId: buyerId, kind, ...(kind === "plan" ? { plan: "PRO" } : {}), ...extra } });
}
const payment = (ch: string, extra = {}) => ({ id: `pay${uid()}`.replace("fixture_", "_"), checkout_configuration_id: ch, currency: "usd", subtotal: PLANS.PRO.price, fees: [{ amount: 3, currency: "usd" }], status: "paid", ...extra });
const settle = (d: Record<string, unknown>) => db.$transaction((tx) => settlePayment(tx, d, 50), { timeout: 20000 });
const adjust = (d: Record<string, unknown>) => db.$transaction((tx) => adjustPayment(tx, d), { timeout: 20000 });
let server: ChildProcess;
let serverErrors = "";
const baseUrl = "http://localhost:3848";
before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3848"], { env: process.env, stdio: ["ignore", "ignore", "pipe"] });
  server.stderr?.on("data", (data) => { serverErrors += String(data); });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${baseUrl}/login`)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test app server did not start");
});
after(async () => { if (serverErrors) console.error(serverErrors.replaceAll(process.env.DATABASE_URL!, "[test database]")); server?.kill("SIGTERM"); await db.$disconnect(); });
async function token(userId: string, version = 0) {
  return new SignJWT({ sub: userId, ver: version }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
}
async function api(path: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(baseUrl + path, { method, headers: { origin: baseUrl, cookie: `idaevia_session=${cookie}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: "manual" });
}

test("verified plan payments reward exactly 5%, renewals earn again, replay earns nothing", async () => {
  const ref = await user(); const buyer = await user({ referredById: ref.id }); const ch = await checkout(buyer.id);
  const d = payment(ch.id, { membership: { id: uid() } });
  await Promise.all([settle(d), settle(d)]);
  assert.equal(await db.payment.count({ where: { id: d.id } }), 1);
  assert.equal(await db.referralCommission.count({ where: { buyerId: buyer.id } }), 1);
  const reward = Math.round(PLANS.PRO.price * 5);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ref.id } })).sellerBalanceCents, reward);
  assert.equal(await db.creditLedger.count({ where: { userId: ref.id, reason: "referral_paid" } }), 1);
  await settle(payment(ch.id));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ref.id } })).sellerBalanceCents, reward * 2);
  assert.equal(await db.creditLedger.count({ where: { userId: ref.id, reason: "referral_paid" } }), 1);
});

test("packs have no cash reward; unpaid, missing, wrong-currency and unowned payments fail closed", async () => {
  const ref = await user(); const buyer = await user({ referredById: ref.id }); const pack = CREDIT_PACKS[0];
  const ch = await checkout(buyer.id, "pack", { credits: pack.credits });
  for (const extra of [{ subtotal: 0 }, { subtotal: 1 }, { subtotal: null }, { currency: "eur" }, { status: "pending" }, { checkout_configuration_id: "forged" }]) await assert.rejects(settle(payment(ch.id, { subtotal: pack.price, ...extra })));
  const d = payment(ch.id, { subtotal: pack.price }); await settle(d); await settle(d);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).credits, 100 + pack.credits);
  assert.equal(await db.referralCommission.count({ where: { buyerId: buyer.id } }), 0);
});

test("partial refunds, replay, chargebacks and won disputes adjust wallet only once", async () => {
  const ref = await user(); const buyer = await user({ referredById: ref.id }); const ch = await checkout(buyer.id);
  const d = payment(ch.id); await settle(d);
  const full = Math.round(PLANS.PRO.price * 5);
  const correction = { ...d, refunded_amount: PLANS.PRO.price / 2, disputes: [] };
  await adjust(correction); await adjust(correction);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ref.id } })).sellerBalanceCents, Math.round(full / 2));
  await adjust({ ...correction, disputes: [{ status: "needs_response", amount: PLANS.PRO.price }] });
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ref.id } })).sellerBalanceCents, 0);
  await adjust({ ...correction, disputes: [{ status: "won", amount: PLANS.PRO.price }] });
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ref.id } })).sellerBalanceCents, Math.round(full / 2));
});

test("refund cancels an unsent payout and preserves debt for already paid earnings", async () => {
  const ref = await user(); const buyer = await user({ referredById: ref.id }); const ch = await checkout(buyer.id); const d = payment(ch.id); await settle(d);
  const reward = Math.round(PLANS.PRO.price * 5);
  await db.user.update({ where: { id: ref.id }, data: { sellerBalanceCents: 0 } });
  const pending = await db.payoutRequest.create({ data: { userId: ref.id, amountCents: reward, method: "paypal", details: '{"email":"test@security.invalid"}' } });
  await adjust({ ...d, refunded_amount: PLANS.PRO.price });
  assert.equal((await db.payoutRequest.findUniqueOrThrow({ where: { id: pending.id } })).status, "REJECTED");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ref.id } })).sellerBalanceCents, 0);
  const d2 = payment(ch.id); await settle(d2);
  await db.user.update({ where: { id: ref.id }, data: { sellerBalanceCents: 0, sellerPaidOutCents: reward } });
  await adjust({ ...d2, refunded_amount: PLANS.PRO.price });
  const after = await db.user.findUniqueOrThrow({ where: { id: ref.id } });
  assert.equal(after.sellerBalanceCents, -reward); assert.equal(after.sellerPaidOutCents, reward);
});

test("affiliate and friend commission cannot stack; failed transaction grants nothing", async () => {
  const aff = await db.affiliate.create({ data: { name: "Fixture", code: uid(), commissionPct: 20 } });
  const ref = await user(); const buyer = await user({ referredById: ref.id, affiliateId: aff.id }); const ch = await checkout(buyer.id); const d = payment(ch.id);
  await assert.rejects(db.$transaction(async (tx) => { await settlePayment(tx, d, 50); throw new Error("simulated failure"); }));
  assert.equal(await db.payment.count({ where: { id: d.id } }), 0);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: ref.id } })).sellerBalanceCents, 0);
  await settle(d); assert.equal(await db.affiliateCommission.count({ where: { userId: buyer.id } }), 0);
});

test("concurrent credit reservations cannot overspend; failure after finalization cannot inflate balance", async () => {
  const buyer = await user({ credits: 100, purchasedCredits: 100 });
  const attempts = await Promise.allSettled([reserveCredits(buyer.id, 80, "test"), reserveCredits(buyer.id, 80, "test")]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  const held = attempts.find((r) => r.status === "fulfilled")! as PromiseFulfilledResult<Awaited<ReturnType<typeof reserveCredits>>>;
  const opts = { userId: buyer.id, ledgerId: held.value.ledgerId, hold: 80, byClassCredits: 20, costUsd: 0, k: 150, purchasedHeld: 80, note: "test", meta: {} };
  await finalizeCredits(opts); await finalizeCredits(opts);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).credits, 80);
  await releaseCredits({ ...opts, keep: 0 }); await releaseCredits({ ...opts, keep: 0 });
  const after = await db.user.findUniqueOrThrow({ where: { id: buyer.id } });
  assert.equal(after.credits, 100); assert.equal(after.purchasedCredits, 100);
  await assert.rejects(reserveCredits(buyer.id, -20, "forged"));
});

test("monthly renewal creates one audit row under concurrency", async () => {
  const buyer = await user({ credits: 0, creditsResetAt: new Date("2025-01-01") });
  const results = await Promise.all([renewCreditsIfDue(buyer.id), renewCreditsIfDue(buyer.id)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await db.creditLedger.count({ where: { userId: buyer.id } }), 1);
});


test("HTTP: unauthenticated protected APIs fail, ordinary users cannot reach admin or forge balances", async () => {
  for (const path of ["/api/projects", "/api/integrations", "/api/wallet", "/api/teams", "/api/custom-agents", "/api/assistant", "/api/me", "/api/admin/users", "/api/admin/settings", "/api/admin/payouts", "/api/admin/affiliates"]) {
    const r = await api(path); assert.equal(r.status, 401, path);
  }
  const buyer = await user(); const session = await token(buyer.id);
  for (const path of ["/api/admin/users", "/api/admin/payouts", "/api/admin/affiliates", "/api/admin/settings"]) assert.equal((await api(path, session)).status, 403, path);
  assert.equal((await api("/api/admin/expenses", session, "POST", { amountCents: 1 })).status, 403);
  assert.equal((await api("/api/admin/finance/reconcile", session, "POST")).status, 403);
  assert.equal((await api("/api/billing/dev-plan", session, "POST", { plan: "MAX" })).status, 403);
  assert.equal((await api("/api/me", session, "PATCH", { role: "ADMIN", credits: 999999, sellerBalanceCents: 99999 })).status, 400);
  const after = await db.user.findUniqueOrThrow({ where: { id: buyer.id } });
  assert.equal(after.role, "USER"); assert.equal(after.credits, 100); assert.equal(after.sellerBalanceCents, 0);
  const forged = session.slice(0, -8) + "forged00";
  assert.equal((await api("/api/me", forged)).status, 401);
  await db.user.update({ where: { id: buyer.id }, data: { sessionVersion: 1 } });
  assert.equal((await api("/api/me", session)).status, 401);
});

test("HTTP: project ownership is enforced and encrypted secrets never appear in project responses", async () => {
  const owner = await user(); const attacker = await user({ plan: "PRO" });
  const project = await db.project.create({ data: { userId: owner.id, name: "Private project", slug: uid(), envEncrypted: "encrypted-secret-fixture" } });
  const session = await token(attacker.id);
  for (const [suffix, method, body] of [["", "GET", undefined], ["", "PATCH", { name: "Hijacked" }], ["/files", "GET", undefined], ["/export", "GET", undefined], ["/terminal", "POST", { cmd: "env list" }], ["/run", "POST", { request: "Build me a site" }]] as const) {
    assert.equal((await api(`/api/projects/${project.id}${suffix}`, session, method, body)).status, 404, suffix);
  }
  const own = await api(`/api/projects/${project.id}`, await token(owner.id));
  assert.equal(own.status, 200); assert.ok(!(await own.text()).includes("envEncrypted"));
});

test("HTTP: concurrent payout requests and admin approvals move money exactly once", async () => {
  const seller = await user({ sellerBalanceCents: 2500, payoutMethod: "paypal", payoutDetails: JSON.stringify({ email: "fixture@security.invalid" }) });
  const admin = await user({ role: "ADMIN" });
  const session = await token(seller.id);
  const results = await Promise.all([api("/api/wallet", session, "POST"), api("/api/wallet", session, "POST")]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const req = await db.payoutRequest.findFirstOrThrow({ where: { userId: seller.id } });
  assert.equal(req.amountCents, 2500);
  const adminSession = await token(admin.id);
  const approvals = await Promise.all([api("/api/admin/payouts", adminSession, "PATCH", { requestId: req.id, action: "approve", note: "test-reference" }), api("/api/admin/payouts", adminSession, "PATCH", { requestId: req.id, action: "approve", note: "test-reference" })]);
  assert.deepEqual(approvals.map((r) => r.status).sort(), [200, 409]);
  const after = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
  assert.equal(after.sellerBalanceCents, 0); assert.equal(after.sellerPaidOutCents, 2500);
});

test("webhook signature, failed verification, event replay and transaction rollback are enforced", async () => {
  const ref = await user(); const buyer = await user({ referredById: ref.id }); const ch = await checkout(buyer.id);
  const d = payment(ch.id, { company: { id: "biz_test" } });
  const nativeFetch = globalThis.fetch;
  function request(id: string, valid = true) {
    const raw = JSON.stringify({ type: "payment.succeeded", data: { id: d.id } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", process.env.WHOP_WEBHOOK_SECRET!).update(`${id}.${ts}.${raw}`).digest("base64");
    return new Request(baseUrl + "/api/webhooks/whop", { method: "POST", body: raw, headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": valid ? `v1,${sig}` : "v1,invalid" } });
  }
  try {
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    assert.equal((await whopWebhook(request("evt_failed", false))).status, 401);
    assert.equal((await whopWebhook(request("evt_failed"))).status, 503);
    assert.equal(await db.webhookEvent.count({ where: { id: "evt_failed" } }), 0);
    globalThis.fetch = async () => Response.json(d);
    for (const id of ["evt_failed", "evt_failed", "evt_second_delivery"]) assert.equal((await whopWebhook(request(id))).status, 200);
    assert.equal(await db.referralCommission.count({ where: { buyerId: buyer.id } }), 1);
    assert.equal(await db.payment.count({ where: { id: d.id } }), 1);
  } finally { globalThis.fetch = nativeFetch; }
});

test("profile sections and admin finance render with server-owned account data", async () => {
  const account = await user({ name: "Profile fixture" }); const session = await token(account.id);
  for (const [section, text] of [["account", "Display name"], ["credits", "Credit usage"], ["plan", "Manage plan"], ["referrals", "5% of every paid plan payment"], ["security", "Set a password"], ["wallet", "Loading wallet"]]) {
    const r = await api(`/app/profile?section=${section}`, session); assert.equal(r.status, 200, section); assert.ok((await r.text()).includes(text), section);
  }
  const admin = await user({ role: "ADMIN" }); const r = await api("/admin/payments", await token(admin.id));
  assert.equal(r.status, 200); const html = await r.text(); assert.ok(html.includes("Net profit")); assert.ok(html.includes("Profit by customer"));
});
