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
  const isolation = await db.$queryRaw<{ schema: string }[]>`SELECT current_schema()::text AS schema`;
  assert.equal(isolation[0].schema, process.env.TEST_DATABASE_SCHEMA, "Database schema isolation must hold before tests run");
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

test("generation admission isolates owners, serializes one project and allows independent projects", async () => {
  const { acquireProjectLease } = await import('../src/lib/project-lock');
  const a = await user(); const b = await user();
  const create = (userId: string) => db.project.create({ data: { userId, name: 'Concurrent fixture', slug: uid() } });
  const p = await create(a.id); const q = await create(b.id);
  await assert.rejects(acquireProjectLease(p.id, b.id, true), /not found/);
  const attempts = await Promise.allSettled([acquireProjectLease(p.id, a.id, true), acquireProjectLease(p.id, a.id, true)]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  const held = (attempts.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof acquireProjectLease>>>).value;
  const other = await acquireProjectLease(q.id, b.id, true);
  try {
    assert.equal((await api(`/api/projects/${p.id}`, await token(a.id), 'PATCH', { html: '<html>overwrite</html>', saveVersion: true })).status, 409);
    assert.equal((await api(`/api/projects/${p.id}/files`, await token(a.id), 'PUT', { files: [] })).status, 409);
    assert.equal((await api(`/api/projects/${p.id}`, await token(a.id), 'DELETE')).status, 409);
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: p.id } })).html, '');
  } finally { await held.release(); await other.release(); }
  const next = await acquireProjectLease(p.id, a.id); await next.release();
});

test("generation capacity is bounded per user and globally, stale release cannot remove a newer lease", async () => {
  const { acquireProjectLease } = await import('../src/lib/project-lock');
  const a = await user(); const b = await user();
  const projects = await Promise.all([a.id, a.id, a.id, b.id].map((userId) => db.project.create({ data: { userId, name: 'Capacity', slug: uid() } })));
  const one = await acquireProjectLease(projects[0].id, a.id, true);
  const two = await acquireProjectLease(projects[1].id, a.id, true);
  try { await assert.rejects(acquireProjectLease(projects[2].id, a.id, true), /maximum number/); }
  finally { await two.release(); }
  const previous = process.env.AI_MAX_CONCURRENT; process.env.AI_MAX_CONCURRENT = '1';
  try { await assert.rejects(acquireProjectLease(projects[3].id, b.id, true), /capacity/); }
  finally { if (previous === undefined) delete process.env.AI_MAX_CONCURRENT; else process.env.AI_MAX_CONCURRENT = previous; }
  await db.setting.update({ where: { key: `project-write:${projects[0].id}` }, data: { updatedAt: new Date(Date.now() - 360_000) } });
  const replacement = await acquireProjectLease(projects[0].id, a.id, true);
  await one.release();
  await replacement.assertActive();
  await assert.rejects(one.assertActive(), /expired/);
  await replacement.release();
});

test("marketplace settlement and reversal are idempotent and reject underpayment", async () => {
  const { markPurchasePaid, reversePurchase } = await import('../src/lib/marketplace');
  const seller = await user(); const buyer = await user();
  const item = await db.marketItem.create({ data: { type: 'prompt', title: 'Paid fixture', description: 'A paid fixture prompt', price: 500, authorId: seller.id, authorName: 'Seller', payload: '{"prompt":"private prompt"}' } });
  const p = await db.purchase.create({ data: { itemId: item.id, buyerId: buyer.id, sellerId: seller.id, priceCents: 500, feeCents: 50, sellerCents: 450 } });
  for (const amount of [0, -1, 499, NaN]) assert.equal(await markPurchasePaid(p.id, 'fixture_payment', amount), null);
  await Promise.all([markPurchasePaid(p.id, `market_${p.id}`, 500), markPurchasePaid(p.id, `market_${p.id}`, 500)]);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: seller.id } })).sellerBalanceCents, 450);
  assert.equal((await db.marketItem.findUniqueOrThrow({ where: { id: item.id } })).sales, 1);
  await Promise.all([reversePurchase(`market_${p.id}`, 'test'), reversePurchase(`market_${p.id}`, 'test')]);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: seller.id } })).sellerBalanceCents, 0);
  assert.equal((await db.marketItem.findUniqueOrThrow({ where: { id: item.id } })).sales, 0);
});

test("HTTP: marketplace keeps paid content private, installs custom stacks and retains pending orders on unpublish", async () => {
  const seller = await user({ plan: 'PRO' }); const buyer = await user({ plan: 'PRO' }); const stranger = await user({ plan: 'PRO' });
  const item = await db.marketItem.create({ data: { type: 'template', title: 'Java fixture', description: 'A private Java application', price: 500, authorId: seller.id, authorName: 'Seller', payload: JSON.stringify({ kind: 'app', stack: 'Java + Spring Boot', files: [{ path: '/pom.xml', content: '<project>PRIVATE_SOURCE</project>' }] }) } });
  const pending = await db.purchase.create({ data: { itemId: item.id, buyerId: buyer.id, sellerId: seller.id, priceCents: 500, feeCents: 50, sellerCents: 450 } });
  const strangerToken = await token(stranger.id);
  assert.equal((await api(`/api/marketplace/${item.id}/install`, strangerToken, 'POST')).status, 402);
  assert.ok(!(await (await api('/api/marketplace', strangerToken)).text()).includes('PRIVATE_SOURCE'));
  assert.equal((await api('/api/marketplace', await token(seller.id), 'DELETE', { id: item.id })).status, 200);
  assert.ok(await db.purchase.findUnique({ where: { id: pending.id } }));
  const { markPurchasePaid } = await import('../src/lib/marketplace');
  await markPurchasePaid(pending.id, `fixture_${pending.id}`, 500);
  const response = await api(`/api/marketplace/${item.id}/install`, await token(buyer.id), 'POST');
  assert.equal(response.status, 200);
  const { projectId } = await response.json();
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { files: true, versions: true } });
  assert.equal(project.userId, buyer.id); assert.equal(JSON.parse(project.memory).stack, 'Java + Spring Boot');
  assert.equal(project.files[0].path, '/pom.xml'); assert.equal(project.versions.length, 1); assert.equal(project.envEncrypted, null);
  assert.equal((await api(`/api/projects/${projectId}/files`, strangerToken)).status, 404);
});

test("HTTP: concurrent free installs count once and quota cannot be raced", async () => {
  const seller = await user(); const buyer = await user();
  const item = await db.marketItem.create({ data: { type: 'template', title: 'Free fixture', description: 'A free fixture site', authorId: seller.id, authorName: 'Seller', payload: JSON.stringify({ kind: 'website', html: '<html><body>Fixture</body></html>' }) } });
  const quota = PLANS.FREE.projectLimit; assert.equal(typeof quota, 'number');
  for (let i = 0; i < Number(quota) - 1; i++) await db.project.create({ data: { userId: buyer.id, name: 'Existing', slug: uid() } });
  const cookie = await token(buyer.id);
  const results = await Promise.all([api(`/api/marketplace/${item.id}/install`, cookie, 'POST'), api(`/api/marketplace/${item.id}/install`, cookie, 'POST'), api('/api/projects', cookie, 'POST', { name: 'Raced project' })]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(await db.project.count({ where: { userId: buyer.id } }), quota);
  assert.ok((await db.marketItem.findUniqueOrThrow({ where: { id: item.id } })).installs <= 1);
});

test("concurrent AI runs keep prompts, output, versions and credits isolated and reject duplicate runs", async () => {
  const { PROVIDERS } = await import('../src/lib/ai/provider');
  const { runAgent } = await import('../src/lib/ai/generate');
  const previousGenerate = PROVIDERS.openai.generate;
  const previousAvailable = PROVIDERS.openai.available;
  const a = await user({ plan: 'MAX', credits: 100000 }); const b = await user({ plan: 'MAX', credits: 100000 });
  const pa = await db.project.create({ data: { userId: a.id, name: 'Alpha', slug: uid() } });
  const pb = await db.project.create({ data: { userId: b.id, name: 'Beta', slug: uid() } });
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  let ready!: () => void; const started = new Promise<void>((resolve) => { ready = resolve; }); let count = 0;
  PROVIDERS.openai.available = () => true;
  PROVIDERS.openai.generate = async (model, input) => {
    const prompt = input.messages[0].content;
    assert.equal(prompt.includes('COMPONENT REFERENCE: Glass switch'), prompt.includes('ALPHA_ONLY'));
    assert.equal(input.effort, 'xhigh');
    if (++count === 2) ready();
    await gate;
    const name = prompt.includes('ALPHA_ONLY') ? 'ALPHA_ONLY' : 'BETA_ONLY';
    return { text: `<!DOCTYPE html><html><body><nav>${name}</nav></body></html>`, provider: 'openai', model, inputTokens: 100, outputTokens: 100, stopReason: 'stop' };
  };
  const runs = [
    runAgent({ userId: a.id, projectId: pa.id, plan: 'MAX', request: 'Build a HTML navbar ALPHA_ONLY [COMPONENT:glass-switch]', preferProvider: 'openai' }),
    runAgent({ userId: b.id, projectId: pb.id, plan: 'MAX', request: 'Build a HTML navbar BETA_ONLY', preferProvider: 'openai' }),
  ];
  try {
    await Promise.race([started, Promise.all(runs).then(() => { throw new Error('Runs unexpectedly completed before gate'); })]);
    await assert.rejects(runAgent({ userId: a.id, projectId: pa.id, plan: 'MAX', request: 'Overwrite HTML' }), /already being updated/);
    release(); await Promise.all(runs);
    for (const [owner, project, marker, other] of [[a, pa, 'ALPHA_ONLY', 'BETA_ONLY'], [b, pb, 'BETA_ONLY', 'ALPHA_ONLY']] as const) {
      const saved = await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { versions: true, messages: true, agentRuns: true } });
      assert.ok(saved.html.includes(marker)); assert.ok(!saved.html.includes(other));
      assert.equal(saved.versions.length, 1); assert.equal(saved.agentRuns.length, 1);
      assert.ok(saved.messages.every((m) => !m.content.includes(other)));
      const ledgers = await db.creditLedger.findMany({ where: { userId: owner.id } });
      assert.equal(ledgers.length, 1); assert.equal(ledgers[0].projectId, project.id);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).credits, 100000 + ledgers[0].delta);
    }
  } finally {
    release(); await Promise.allSettled(runs);
    PROVIDERS.openai.generate = previousGenerate; PROVIDERS.openai.available = previousAvailable;
  }
});

test("generation setup failure refunds the hold and frees its project lease", async () => {
  const { PROVIDERS } = await import('../src/lib/ai/provider');
  const { runAgent } = await import('../src/lib/ai/generate');
  const { acquireProjectLease } = await import('../src/lib/project-lock');
  const owner = await user({ plan: 'MAX', credits: 100000 });
  const project = await db.project.create({ data: { userId: owner.id, name: 'Failure fixture', slug: uid() } });
  const available = PROVIDERS.openai.available; const create = db.agentRun.create;
  PROVIDERS.openai.available = () => true;
  db.agentRun.create = (async () => { throw new Error('simulated run persistence failure'); }) as unknown as typeof db.agentRun.create;
  try {
    await assert.rejects(runAgent({ userId: owner.id, projectId: project.id, plan: 'MAX', request: 'Build a HTML website', preferProvider: 'openai' }), /simulated/);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).credits, 100000);
    const ledger = await db.creditLedger.findFirstOrThrow({ where: { userId: owner.id } });
    assert.equal(ledger.delta, 0); assert.equal(JSON.parse(ledger.meta!).settlement, 'refunded');
    const lease = await acquireProjectLease(project.id, owner.id); await lease.release();
  } finally { PROVIDERS.openai.available = available; db.agentRun.create = create; }
});

test("admin projects are read-only, searchable and restricted to administrators", async () => {
  const owner = await user(); const other = await user(); const admin = await user({ role: "ADMIN" });
  const project = await db.project.create({ data: { name: "Admin project fixture", slug: uid(), userId: owner.id, html: "<!doctype html><h1>Fixture preview</h1>", envEncrypted: "SECRET_ENV_SENTINEL", memory: '{"secret":"SECRET_MEMORY_SENTINEL"}', files: { create: { path: "/src/example.ts", content: "export const fixture = true;" } } } });
  const adminToken = await token(admin.id), otherToken = await token(other.id);
  const preview = `/api/admin/projects/${project.id}/preview`;
  assert.equal((await api(preview)).status, 401);
  assert.equal((await api(preview, otherToken)).status, 403);
  const response = await api(preview, adminToken);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy")!, /sandbox allow-scripts/);
  assert.doesNotMatch(response.headers.get("content-security-policy")!, /allow-same-origin/);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.match(await response.text(), /Fixture preview/);
  assert.equal((await api(`/api/projects/${project.id}/preview`, otherToken)).status, 404);
  assert.equal((await api(`/api/projects/${project.id}`, adminToken, "PATCH", { name: "Forbidden edit" })).status, 404);
  const list = await api(`/admin/projects?owner=${owner.id}`, adminToken);
  assert.equal(list.status, 200); assert.match(await list.text(), /Admin project fixture/);
  const empty = await api(`/admin/projects?owner=${other.id}`, adminToken);
  assert.doesNotMatch(await empty.text(), /Admin project fixture/);
  const search = await api(`/admin/projects?q=${encodeURIComponent(owner.email)}`, adminToken);
  assert.match(await search.text(), /Admin project fixture/);
  const detail = await api(`/admin/projects/${project.id}`, adminToken);
  const html = await detail.text(); assert.equal(detail.status, 200);
  assert.match(html, /export const fixture/);
  assert.doesNotMatch(html, /SECRET_ENV_SENTINEL|SECRET_MEMORY_SENTINEL/);
  assert.equal((await api(`/api/admin/projects/missing/preview`, adminToken)).status, 404);
});

test('project questions persist answers and history without creating versions or changing source', async () => {
  const { PROVIDERS } = await import('../src/lib/ai/provider');
  const { runAgent } = await import('../src/lib/ai/generate');
  const owner = await user({ plan: 'MAX', credits: 100000 });
  const project = await db.project.create({ data: { userId: owner.id, name: 'Chat fixture', slug: uid() } });
  const other = await db.project.create({ data: { userId: owner.id, name: 'Other', slug: uid(), messages: { create: { role: 'user', content: 'OTHER_PROJECT_SECRET' } } } });
  assert.ok(other.id);
  const generate = PROVIDERS.openai.generate, available = PROVIDERS.openai.available;
  const responses = ['Open Integrations and connect GitHub. Then run git push in Terminal.', 'Step 2: open this project’s Terminal.', '<!doctype html><html><body>Built website</body></html>', '<<<ANSWER>>>That is the navigation menu.<<<END_ANSWER>>>'];
  let calls = 0;
  PROVIDERS.openai.available = () => true;
  PROVIDERS.openai.generate = async (model, input) => {
    assert.ok(input.messages.every(m => !m.content.includes('OTHER_PROJECT_SECRET')));
    if (calls === 0) assert.match(input.system, /helpful technical assistant/);
    if (calls === 1) assert.ok(input.messages.some(m => m.role === 'assistant' && m.content.includes('connect GitHub')));
    const text = responses[calls++]; input.onText?.(text);
    return { text, model, provider: 'openai', inputTokens: 100, outputTokens: 100, stopReason: 'stop' };
  };
  const run = (request: string) => runAgent({ userId: owner.id, projectId: project.id, plan: 'MAX', request, preferProvider: 'openai' });
  try {
    assert.equal((await run('what i need to do to push this project to github ?')).mode, 'report');
    assert.equal((await run('Explain step 2')).mode, 'report');
    let saved = await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { versions: true } });
    assert.equal(saved.html, ''); assert.equal(saved.versions.length, 0); assert.equal(saved.memory, '{}');
    assert.equal((await run('Build a HTML website')).mode, 'rewrite');
    assert.equal((await run('Navigation details')).mode, 'report');
    saved = await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { versions: true } });
    assert.equal(saved.versions.length, 1); assert.match(saved.html, /Built website/);
    assert.equal(await db.agentRun.count({ where: { projectId: project.id, status: 'FAILED' } }), 0);
    assert.equal(await db.message.count({ where: { projectId: project.id, content: { contains: 'That is the navigation menu.' } } }), 1);
  } finally { PROVIDERS.openai.generate = generate; PROVIDERS.openai.available = available; }
});

test('build releases are separate from changes, concurrent builds deduplicate and deploy keeps the version', async () => {
  const { recordProjectRelease, projectReleases } = await import('../src/lib/project-releases');
  const owner = await user(); const stranger = await user();
  const source = await db.project.create({ data: { userId: owner.id, name: 'Release fixture', slug: uid(), html: '<html><body>First build</body></html>', versions: { create: { number: 1, html: '<html></html>', message: 'First change' } } } });
  assert.deepEqual(await projectReleases(source.id, owner.id), []);
  const first = await Promise.all([recordProjectRelease(source), recordProjectRelease(source)]);
  assert.deepEqual(first.map(r => r.number), [1, 1]);
  const deployment = await recordProjectRelease(source, { provider: 'idaevia', url: '/s/fixture' });
  assert.equal(deployment.number, 1); assert.ok(deployment.deployedAt);
  const second = await recordProjectRelease({ ...source, html: '<html><body>Second build</body></html>' });
  assert.equal(second.number, 2);
  assert.equal(await db.version.count({ where: { projectId: source.id } }), 1);
  assert.equal((await api(`/api/projects/${source.id}/releases`, await token(stranger.id))).status, 404);
  assert.equal((await api(`/api/projects/${source.id}/releases`, await token(owner.id))).status, 200);
  const published = await api(`/api/projects/${source.id}/publish`, await token(owner.id), 'POST');
  assert.equal(published.status, 200); assert.equal((await published.json()).release.number, 1);
});

test('project ZIP import and named export preserve source/assets and enforce ownership', async () => {
  const { default: JSZip } = await import('jszip');
  const owner = await user({ plan: 'PRO' }), other = await user({ plan: 'PRO' });
  const cookie = await token(owner.id);
  const zip = new JSZip();
  zip.file('repo/package.json', '{"scripts":{"build":"vite build"},"dependencies":{"react":"18"}}');
  zip.file('repo/src/App.tsx', 'export default function App(){return <h1>Fixture</h1>}');
  zip.file('repo/public/logo.png', new Uint8Array([137,80,78,71,1,2,3]));
  zip.file('repo/.env', 'PRIVATE_TOKEN=secret'); zip.file('repo/.env.example', 'PRIVATE_TOKEN=');
  const form = new FormData(); form.set('name', 'Imported SaaS'); form.set('file', new Blob([await zip.generateAsync({ type: 'arraybuffer' })]), 'source.zip');
  const response = await fetch(baseUrl + '/api/import/zip', { method: 'POST', headers: { cookie: `idaevia_session=${cookie}`, origin: baseUrl }, body: form });
  assert.equal(response.status, 200);
  const { project } = await response.json(); assert.equal(project.kind, 'app');
  const stored = await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { files: true, versions: true } });
  assert.equal(stored.versions.length, 1); assert.equal(stored.files.length, 4);
  const exported = await api(`/api/projects/${project.id}/export?name=My%20SaaS&folder=1`, cookie);
  assert.equal(exported.status, 200); assert.match(exported.headers.get('content-disposition')!, /My%20SaaS.zip/);
  const downloaded = await JSZip.loadAsync(await exported.arrayBuffer());
  assert.ok(downloaded.file('My SaaS/package.json')); assert.ok(downloaded.file('My SaaS/src/App.tsx'));
  assert.equal(await downloaded.file('My SaaS/public/logo.png')!.async('base64'), Buffer.from([137,80,78,71,1,2,3]).toString('base64'));
  assert.equal(downloaded.file('My SaaS/.env'), null);
  assert.equal((await api(`/api/projects/${project.id}/export`, await token(other.id))).status, 404);
  const bad = new FormData(); bad.set('file', new Blob(['not zip']), 'bad.zip');
  assert.equal((await fetch(baseUrl + '/api/import/zip', { method: 'POST', headers: { cookie: `idaevia_session=${cookie}`, origin: baseUrl }, body: bad })).status, 422);
  assert.equal(await db.project.count({ where: { userId: owner.id } }), 1);
});
