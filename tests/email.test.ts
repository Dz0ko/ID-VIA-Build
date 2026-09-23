import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { db } from "../src/lib/db";
import { enqueueEmail, enqueueWelcome, processEmailQueue, saveEmailConfig, renderEmail } from "../src/lib/email";
import { settlePayment } from "../src/lib/billing-ledger";
import { PLANS } from "../src/lib/plans";
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Isolated schema required");
const base = "http://localhost:3848";
let server: ChildProcess;
before(async () => {
  const isolation = await db.$queryRaw<{ schema: string }[]>`SELECT current_schema()::text AS schema`;
  assert.equal(isolation[0].schema, process.env.TEST_DATABASE_SCHEMA, "Database schema isolation must hold before tests run");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3848"], { env: process.env, stdio: "ignore" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/login")).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error("App did not start");
});
after(async () => { server?.kill("SIGTERM"); await db.$disconnect(); });
async function account(extra = {}) {
  const user = await db.user.create({ data: { email: `${randomUUID()}@email.invalid`, ...extra } });
  const cookie = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return { ...user, cookie };
}
async function api(path: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(base + path, { method, headers: { origin: base, cookie: `idaevia_session=${cookie}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const config = (enabled: boolean, from = "IDAEVIA <sender@example.invalid>") => saveEmailConfig({ enabled, from, replyTo: "reply@example.invalid", apiKey: "re_fixture_not_a_real_key" });
async function mail(userId: string, extra = {}) { return enqueueEmail(db, { eventKey: randomUUID(), userId, kind: "test", subject: "A test notification", body: "Message body for a test notification.", ...extra }); }
const originalFetch = globalThis.fetch;
function transport(fn: (payload: Record<string, unknown>, key: string) => Promise<Response> | Response) {
  globalThis.fetch = ((url, init) => String(url) === "https://api.resend.com/emails" ? Promise.resolve(fn(JSON.parse(String(init?.body)), new Headers(init?.headers).get("Idempotency-Key")!)) : originalFetch(url, init)) as typeof fetch;
}

test("signup queues one welcome and password changes queue security notices without passwords", async () => {
  await config(false);
  const email = `${randomUUID()}@signup.invalid`, password = "first-password-123";
  const signup = await api("/api/auth/signup", "", "POST", { email, password, name: "New Customer", marketingEmails: true });
  assert.equal(signup.status, 200);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.marketingEmails, true); assert.ok(user.marketingConsentAt);
  assert.equal((await api("/api/auth/signup", "", "POST", { email, password })).status, 409);
  assert.equal(await db.emailDelivery.count({ where: { userId: user.id, kind: "welcome" } }), 1);
  await enqueueWelcome(db, user);
  assert.equal(await db.emailDelivery.count({ where: { userId: user.id, kind: "welcome" } }), 1);
  const cookie = signup.headers.get("set-cookie")!.match(/idaevia_session=([^;]+)/)![1];
  assert.equal((await api("/api/me", cookie, "PATCH", { currentPassword: "wrong", newPassword: "new-password-456" })).status, 403);
  assert.equal(await db.emailDelivery.count({ where: { userId: user.id, kind: "password" } }), 0);
  assert.equal((await api("/api/me", cookie, "PATCH", { currentPassword: password, newPassword: "new-password-456" })).status, 200);
  const notice = await db.emailDelivery.findFirstOrThrow({ where: { userId: user.id, kind: "password" } });
  assert.doesNotMatch(notice.body, /first-password-123|new-password-456/);
  assert.equal(notice.status, "PENDING");
  assert.equal((await processEmailQueue()).configured, false);
});

test("verified plan payment creates one atomic notification and replay cannot duplicate it", async () => {
  const user = await account(); const id = randomUUID();
  await db.whopCheckout.create({ data: { id, userId: user.id, kind: "plan", plan: "MAX" } });
  const payment = { id: `pay_${randomUUID()}`, checkout_configuration_id: id, currency: "usd", subtotal: PLANS.MAX.price, status: "paid" };
  await db.$transaction(tx => settlePayment(tx, payment, 0));
  await db.$transaction(tx => settlePayment(tx, payment, 0));
  assert.equal(await db.emailDelivery.count({ where: { userId: user.id, kind: "plan" } }), 1);
  assert.match((await db.emailDelivery.findFirstOrThrow({ where: { userId: user.id } })).subject, /Max/);
  const key = randomUUID();
  await assert.rejects(db.$transaction(async tx => { await enqueueEmail(tx, { eventKey: key, userId: user.id, kind: "test", subject: "Rollback", body: "Never sent" }); throw new Error("rollback"); }));
  assert.equal(await db.emailDelivery.count({ where: { eventKey: key } }), 0);
});

test("premium support is derived from subscriptions, ordered first and changes after downgrade", async () => {
  const admin = await account({ role: "ADMIN" });
  const free = await account({ plan: "FREE" }), max = await account({ plan: "MAX" }), agency = await account({ plan: "AGENCY" }), pro = await account({ plan: "PRO" });
  for (const user of [free, max, agency, pro]) await db.supportThread.create({ data: { userId: user.id, status: "WAITING" } });
  const inbox = await (await api("/api/admin/support?status=WAITING", admin.cookie)).json();
  assert.deepEqual(inbox.threads.map((t: { supportTier: string }) => t.supportTier), ["premium", "premium", "priority", "standard"]);
  const thread = await db.supportThread.findUniqueOrThrow({ where: { userId: max.id } });
  assert.equal((await (await api(`/api/support/${thread.id}`, max.cookie)).json()).thread.supportTier, "premium");
  await db.user.update({ where: { id: max.id }, data: { plan: "FREE" } });
  assert.equal((await (await api(`/api/support/${thread.id}`, max.cookie)).json()).thread.supportTier, "standard");
  const premium = await (await api("/api/admin/support?tier=premium", admin.cookie)).json();
  assert.equal(premium.total, 1); assert.equal(premium.threads[0].user.plan, "AGENCY");
});

test("email configuration is admin-only, encrypted and never returns the provider key", async () => {
  const user = await account(), admin = await account({ role: "ADMIN" });
  assert.equal((await api("/api/admin/email", user.cookie)).status, 403);
  assert.equal((await api("/api/admin/email", user.cookie, "PUT", { enabled: true })).status, 403);
  assert.equal((await api("/api/admin/email/campaigns", user.cookie, "POST", { action: "draft" })).status, 403);
  const result = await api("/api/admin/email", admin.cookie); const text = await result.text();
  assert.doesNotMatch(text, /re_fixture/); assert.match(text, /hasKey/);
  assert.doesNotMatch((await db.setting.findUniqueOrThrow({ where: { key: "email-config" } })).value, /re_fixture|sender@example/);
  assert.equal((await api("/api/cron/email")).status, 401);
  const html = renderEmail({ subject: '<img src=x onerror="alert(1)">', body: "<script>bad()</script>" }).html;
  assert.doesNotMatch(html, /<script>|<img src=x/);
});

test("campaigns require review, target only consenting users and cannot be queued twice", async () => {
  const admin = await account({ role: "ADMIN" }); const opted = await account({ marketingEmails: true, plan: "AGENCY" });
  await account({ marketingEmails: false, plan: "AGENCY" });
  const draft = await (await api("/api/admin/email/campaigns", admin.cookie, "POST", { action: "draft", subject: "Agency offer", body: "A promotion for agency customers who opted in.", plan: "AGENCY" })).json();
  assert.equal((await api("/api/admin/email/campaigns", admin.cookie, "POST", { action: "send", id: draft.campaign.id, expectedRecipients: 1 })).status, 400);
  await config(true);
  // Keep the HTTP route's background worker paused. Provider calls are mocked in the next tests.
  await db.setting.upsert({ where: { key: "email-worker-lease" }, create: { key: "email-worker-lease", value: JSON.stringify({ token: "fixture", until: Date.now() + 600000 }) }, update: { value: JSON.stringify({ token: "fixture", until: Date.now() + 600000 }) } });
  try {
    assert.equal((await api("/api/admin/email/campaigns", admin.cookie, "POST", { action: "send", id: draft.campaign.id, expectedRecipients: 99 })).status, 409);
    const send = await api("/api/admin/email/campaigns", admin.cookie, "POST", { action: "send", id: draft.campaign.id, expectedRecipients: 1 });
    assert.equal(send.status, 200); assert.equal((await send.json()).queued, 1);
    assert.equal((await api("/api/admin/email/campaigns", admin.cookie, "POST", { action: "send", id: draft.campaign.id, expectedRecipients: 1 })).status, 409);
    assert.equal(await db.emailDelivery.count({ where: { campaignId: draft.campaign.id, userId: opted.id } }), 1);
    await api("/api/admin/email/campaigns", admin.cookie, "POST", { action: "cancel", id: draft.campaign.id });
    assert.equal((await db.emailDelivery.findFirstOrThrow({ where: { campaignId: draft.campaign.id } })).status, "SUPPRESSED");
  } finally { await config(false); await db.setting.deleteMany({ where: { key: "email-worker-lease" } }); }
});

test("unsubscribe is safe from GET scanners and suppresses queued promotions but not security notices", async () => {
  const user = await account({ marketingEmails: true });
  const promotion = await mail(user.id, { marketing: true, kind: "promotion" }); const security = await mail(user.id, { kind: "password" });
  assert.equal((await api(`/api/email/unsubscribe?token=${user.emailOptOutToken}`)).status, 405);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).marketingEmails, true);
  assert.equal((await fetch(`${base}/api/email/unsubscribe?token=${user.emailOptOutToken}`, { method: "POST", headers: { origin: "https://mail.example", "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" })).status, 200);
  assert.equal((await db.emailDelivery.findUniqueOrThrow({ where: { id: promotion.id } })).status, "SUPPRESSED");
  assert.equal((await db.emailDelivery.findUniqueOrThrow({ where: { id: security.id } })).status, "PENDING");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).marketingEmails, false);
  assert.equal((await api("/api/email/preferences", user.cookie, "PUT", { marketingEmails: true })).status, 200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).marketingEmails, true);
});

test("concurrent mail workers send once and recover a legacy user's unsubscribe token", async () => {
  await db.emailDelivery.updateMany({ where: { status: "PENDING" }, data: { status: "SUPPRESSED" } });
  const user = await account({ marketingEmails: true, emailOptOutToken: null }); const item = await mail(user.id, { marketing: true });
  const sent: { payload: Record<string, unknown>; key: string }[] = [];
  transport((payload, key) => { sent.push({ payload, key }); return Response.json({ id: "provider_fixture" }); });
  await config(true);
  try {
    await Promise.all([processEmailQueue(), processEmailQueue()]);
    assert.equal(sent.length, 1); assert.equal(sent[0].key, `idaevia/${item.id}`);
    assert.match(JSON.stringify(sent[0].payload), /List-Unsubscribe-Post/);
    assert.doesNotMatch(JSON.stringify(sent[0].payload), /token=null/);
    assert.equal((await db.emailDelivery.findUniqueOrThrow({ where: { id: item.id } })).status, "SENT");
    await processEmailQueue(); assert.equal(sent.length, 1);
  } finally { globalThis.fetch = originalFetch; await config(false); }
});

test("ambiguous failures retry identical payloads inside the idempotency window, then require review", async () => {
  const user = await account(); const item = await mail(user.id);
  const attempts: string[] = []; const keys: string[] = []; let fail = true;
  transport((payload, key) => { attempts.push(JSON.stringify(payload)); keys.push(key); if (fail) throw new Error("connection interrupted"); return Response.json({ id: "recovered" }); });
  await config(true);
  try {
    await processEmailQueue();
    assert.equal((await db.emailDelivery.findUniqueOrThrow({ where: { id: item.id } })).uncertain, true);
    await config(true, "Changed Sender <changed@example.invalid>");
    await db.emailDelivery.update({ where: { id: item.id }, data: { nextAttemptAt: new Date() } }); fail = false;
    await processEmailQueue(); assert.equal(attempts.length, 2); assert.equal(attempts[0], attempts[1]); assert.equal(keys[0], keys[1]);
    const stale = await mail(user.id); await db.emailDelivery.update({ where: { id: stale.id }, data: { uncertain: true, firstAttemptAt: new Date(Date.now() - 25 * 3600000) } });
    await processEmailQueue(); assert.equal(attempts.length, 2); assert.equal((await db.emailDelivery.findUniqueOrThrow({ where: { id: stale.id } })).status, "REVIEW");
  } finally { globalThis.fetch = originalFetch; await config(false); }
});

test("branded examples include the logo, contact address, safe markup and unsubscribe", async () => {
  const admin = await account({ role: "ADMIN" });
  const data = await (await api("/api/admin/email", admin.cookie)).json();
  assert.equal(data.examples.length, 5);
  for (const example of data.examples) {
    assert.match(example.html, /brand\/monogram\/lockup-on-dark.png/);
    assert.match(example.html, /mailto:info@idaevia.app/);
    assert.match(example.text, /info@idaevia.app/);
  }
  assert.match(data.examples.find((x: { id: string }) => x.id === "promotion").html, /Unsubscribe/);
  assert.doesNotMatch(renderEmail({ subject: "Safe", body: '<script>alert(1)</script>', ctaUrl: "javascript:alert(1)" }).html, /href="javascript:|<script>/);
});

test("announcements require admins, reach opted-out users, respect plan/expiry and do not send email", async () => {
  await config(false);
  const admin = await account({ role: "ADMIN" }), free = await account({ marketingEmails: false }), pro = await account({ plan: "PRO", marketingEmails: false });
  assert.equal((await api("/api/announcements")).status, 401);
  const campaign = await db.emailCampaign.create({ data: { subject: "New components are here", body: "Explore the latest components in your workspace.", createdBy: admin.id, ctaLabel: "Explore", ctaUrl: "https://idaevia.app/app/components" } });
  const publish = { action: "publish-banner", id: campaign.id, expiresHours: 24 };
  assert.equal((await api("/api/admin/email/campaigns", free.cookie, "POST", publish)).status, 403);
  assert.equal((await api("/api/admin/email/campaigns", admin.cookie, "POST", { ...publish, expiresHours: 0 })).status, 400);
  assert.equal((await api("/api/admin/email/campaigns", admin.cookie, "POST", publish)).status, 200);
  const first = (await (await api("/api/announcements", free.cookie)).json()).announcement;
  assert.equal(first.subject, campaign.subject);
  assert.equal(await db.emailDelivery.count({ where: { campaignId: campaign.id } }), 0);
  await db.emailCampaign.update({ where: { id: campaign.id }, data: { plan: "PRO" } });
  await api("/api/admin/email/campaigns", admin.cookie, "POST", publish);
  assert.equal((await (await api("/api/announcements", free.cookie)).json()).announcement, null);
  const targeted = (await (await api("/api/announcements", pro.cookie)).json()).announcement;
  assert.notEqual(targeted.id, first.id);
  const response = await api("/api/announcements", pro.cookie);
  assert.match(response.headers.get("cache-control")!, /private, no-store/);
  await db.setting.update({ where: { key: "platform-announcement" }, data: { value: JSON.stringify({ ...targeted, expiresAt: new Date(Date.now() - 1000).toISOString() }) } });
  assert.equal((await (await api("/api/announcements", pro.cookie)).json()).announcement, null);
  await api("/api/admin/email/campaigns", admin.cookie, "POST", publish);
  await api("/api/admin/email/campaigns", admin.cookie, "POST", { action: "hide-banner", id: campaign.id });
  assert.equal((await (await api("/api/announcements", pro.cookie)).json()).announcement, null);
  await api("/api/admin/email/campaigns", admin.cookie, "POST", publish);
  await api("/api/admin/email/campaigns", admin.cookie, "POST", { action: "cancel", id: campaign.id });
  assert.equal((await (await api("/api/announcements", pro.cookie)).json()).announcement, null);
  assert.equal((await api("/api/admin/email/campaigns", admin.cookie, "POST", publish)).status, 409);
});

test("both agent streams return structured credit shortfalls without charging or calling providers", async () => {
  const user = await account({ credits: 0, plan: "PRO" });
  const project = await db.project.create({ data: { userId: user.id, name: "Credit test", slug: randomUUID(), html: "<!doctype html><html><body>Saved work</body></html>" } });
  for (const [path, body] of [["/api/assistant", { message: "How do I connect GitHub?" }], [`/api/projects/${project.id}/run`, { request: "How do I connect GitHub?", agentId: "builder" }]] as const) {
    const response = await api(path, user.cookie, "POST", body);
    assert.equal(response.status, 200);
    const events = (await response.text()).split("\n\n").filter(x => x.startsWith("data: ")).map(x => JSON.parse(x.slice(6)));
    const error = events.find(x => x.code === "INSUFFICIENT_CREDITS");
    assert.ok(error, "Both streams must explicitly identify a credit shortfall");
    assert.equal(error.have, 0); assert.ok(error.needed > 0);
  }
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 0);
  assert.equal(await db.creditLedger.count({ where: { userId: user.id } }), 0);
  assert.match((await db.project.findUniqueOrThrow({ where: { id: project.id } })).html, /Saved work/);
});
