import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { db } from "../src/lib/db";
import { PROMPT_LIBRARY } from "../src/lib/library";
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
async function account(role = "USER") {
  const user = await db.user.create({ data: { email: `${randomUUID()}@support.invalid`, role } });
  const cookie = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return { ...user, cookie };
}
async function api(path: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(base + path, { method, headers: { origin: base, cookie: `idaevia_session=${cookie}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const input = (message: string, action = "message") => ({ message, action, clientId: randomUUID() });

test("support is private, tenant-isolated and customers cannot access the staff inbox", async () => {
  const a = await account(), b = await account(), admin = await account("ADMIN");
  const created = await Promise.all([api("/api/support", a.cookie, "POST"), api("/api/support", a.cookie, "POST")]);
  const [one, two] = await Promise.all(created.map(r => r.json()));
  assert.equal(created[0].status, 200, JSON.stringify(one));
  assert.equal(created[1].status, 200, JSON.stringify(two));
  assert.equal(one.thread.id, two.thread.id);
  const path = `/api/support/${one.thread.id}`;
  assert.equal((await api(path)).status, 401);
  assert.equal((await api(path, b.cookie)).status, 404);
  assert.equal((await api(path, b.cookie, "POST", input("read this"))).status, 404);
  assert.equal((await api(path + "/events", b.cookie)).status, 404);
  assert.equal((await api("/api/admin/support", a.cookie)).status, 403);
  assert.equal((await api(path, a.cookie, "POST", input("", "claim"))).status, 403);
  assert.equal((await api("/api/admin/support", admin.cookie)).status, 200);
  assert.match((await api(path, a.cookie)).headers.get("cache-control")!, /no-store/);
});

test("admins can grant supporter; supporters reply live without other admin or project permissions", async () => {
  const admin = await account("ADMIN"), supporter = await account(), customer = await account();
  const thread = await db.supportThread.create({ data: { userId: customer.id, status: "WAITING" } });
  const path = `/api/support/${thread.id}`;
  assert.equal((await api("/api/admin/users", supporter.cookie, "PATCH", { id: supporter.id, role: "SUPPORTER" })).status, 403);
  assert.equal((await api("/api/admin/users", admin.cookie, "PATCH", { id: supporter.id, role: "SUPPORTER" })).status, 200);
  // The existing session sees the new role without logging out or minting another token.
  assert.equal((await api("/api/admin/support", supporter.cookie)).status, 200);
  const page = await (await api("/app/support", supporter.cookie)).text();
  assert.match(page, /Select a conversation to read and reply/);
  assert.doesNotMatch(page, /href="\/admin"/);
  for (const route of ["users", "settings", "email", "payouts", "affiliates", "marketplace"]) {
    assert.equal((await api(`/api/admin/${route}`, supporter.cookie)).status, 403, route);
  }
  assert.equal((await api("/api/admin/users", supporter.cookie, "PATCH", { id: supporter.id, role: "ADMIN" })).status, 403);
  assert.equal((await api("/api/admin/users", supporter.cookie, "PATCH", { id: customer.id, addCredits: 1000 })).status, 403);
  const project = await db.project.create({ data: { userId: customer.id, name: "Private customer project", slug: randomUUID() } });
  assert.equal((await api(`/api/projects/${project.id}`, supporter.cookie)).status, 404);
  assert.equal((await api(`/api/admin/projects/${project.id}/runtime`, supporter.cookie)).status, 403);
  assert.equal((await api(path, supporter.cookie, "POST", input("", "claim"))).status, 200);
  assert.equal((await api(path, admin.cookie, "POST", input("Competing reply"))).status, 409);
  const stream = await api(path + "/events", customer.cookie);
  const reader = stream.body!.getReader();
  await reader.read();
  const message = input("A supporter is here to help.");
  assert.equal((await api(path, supporter.cookie, "POST", message)).status, 200);
  assert.equal((await api(path, supporter.cookie, "POST", message)).status, 200);
  let received = "";
  for (let i = 0; i < 5 && !received.includes(message.message); i++) {
    const chunk = await reader.read(); if (chunk.done) break;
    received += new TextDecoder().decode(chunk.value);
  }
  await reader.cancel();
  assert.ok(received.includes(message.message), "Customer receives the supporter reply live");
  const saved = await db.supportMessage.findMany({ where: { threadId: thread.id, clientId: message.clientId } });
  assert.equal(saved.length, 1); assert.equal(saved[0].role, "manager");
  assert.equal((await api(path, supporter.cookie, "POST", input("", "close"))).status, 200);
  assert.equal((await (await api(path, customer.cookie)).json()).thread.status, "CLOSED");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: customer.id } })).credits, customer.credits);
});

test("removing supporter immediately blocks inbox, replies and open event streams", async () => {
  const admin = await account("ADMIN"), supporter = await account("SUPPORTER"), customer = await account();
  const thread = await db.supportThread.create({ data: { userId: customer.id, status: "WAITING" } });
  const path = `/api/support/${thread.id}`;
  const stream = await api(path + "/events", supporter.cookie);
  assert.equal(stream.status, 200);
  const reader = stream.body!.getReader(); await reader.read();
  assert.equal((await api("/api/admin/users", admin.cookie, "PATCH", { id: supporter.id, role: "USER" })).status, 200);
  let closed = false;
  for (let i = 0; i < 5; i++) { if ((await reader.read()).done) { closed = true; break; } }
  await reader.cancel(); assert.ok(closed, "Demoted supporters stop receiving customer messages");
  assert.equal((await api("/api/admin/support", supporter.cookie)).status, 403);
  assert.equal((await api(path, supporter.cookie)).status, 404);
  assert.equal((await api(path + "/events", supporter.cookie)).status, 404);
  assert.equal((await api(path, supporter.cookie, "POST", { ...input("Blocked reply"), asManager: true })).status, 404);
});

test("provider failure hands off durably, retries are idempotent and support costs no user credits", async () => {
  const customer = await account(); const { thread } = await (await api("/api/support", customer.cookie, "POST")).json();
  const path = `/api/support/${thread.id}`; const message = input("How do I connect GitHub?");
  const response = await api(path, customer.cookie, "POST", message);
  assert.equal(response.status, 200); const snapshot = await response.json();
  assert.equal(snapshot.thread.status, "WAITING");
  assert.equal(snapshot.messages.length, 2);
  assert.equal(snapshot.messages[1].role, "assistant");
  await api(path, customer.cookie, "POST", message);
  assert.equal(await db.supportMessage.count({ where: { threadId: thread.id } }), 2);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: customer.id } })).credits, 100);
  assert.equal(await db.creditLedger.count({ where: { userId: customer.id } }), 0);
});

test("human escalation, concurrent sends, manager ownership and reopening preserve the conversation", async () => {
  const customer = await account(), admin = await account("ADMIN"), second = await account("ADMIN");
  const { thread } = await (await api("/api/support", customer.cookie, "POST")).json(); const path = `/api/support/${thread.id}`;
  await db.supportThread.update({ where: { id: thread.id }, data: { botTurns: 3 } });
  await api(path, customer.cookie, "POST", input("It still fails."));
  assert.equal((await db.supportThread.findUniqueOrThrow({ where: { id: thread.id } })).status, "WAITING");
  assert.equal((await api(path, admin.cookie, "POST", input("", "claim"))).status, 200);
  assert.equal((await api(path, second.cookie, "POST", input("competing reply"))).status, 409);
  const duplicate = input("Here is the exact error.");
  const responses = await Promise.all([api(path, customer.cookie, "POST", duplicate), api(path, customer.cookie, "POST", duplicate)]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(await db.supportMessage.count({ where: { threadId: thread.id, clientId: duplicate.clientId } }), 1);
  await api(path, admin.cookie, "POST", input("Please use Integrations first."));
  await api(path, admin.cookie, "POST", input("", "close"));
  assert.equal((await (await api(path, customer.cookie)).json()).thread.status, "CLOSED");
  await api(path, customer.cookie, "POST", input("Need a real person again", "handoff"));
  assert.equal((await (await api(path, customer.cookie)).json()).thread.status, "WAITING");
  assert.ok((await (await api(path, customer.cookie)).json()).messages.some((m: { content: string }) => m.content === "Please use Integrations first."));
});

test("manager takeover clears a pending bot; expired leases recover and history paginates", async () => {
  const customer = await account(), admin = await account("ADMIN");
  const thread = await db.supportThread.create({ data: { userId: customer.id, botToken: "pending", botUntil: new Date(Date.now() + 30000) } });
  const path = `/api/support/${thread.id}`;
  assert.equal((await api(path, customer.cookie, "POST", input("second question"))).status, 409);
  await api(path, admin.cookie, "POST", input("", "claim"));
  assert.equal((await db.supportThread.findUniqueOrThrow({ where: { id: thread.id } })).botToken, null);
  await db.supportThread.update({ where: { id: thread.id }, data: { status: "BOT", botToken: "expired", botUntil: new Date(Date.now() - 1000) } });
  assert.equal((await (await api(path, customer.cookie)).json()).thread.status, "WAITING");
  await db.supportMessage.createMany({ data: Array.from({ length: 105 }, (_, i) => ({ threadId: thread.id, clientId: randomUUID(), role: "user", content: `History ${i}` })) });
  const recent = await (await api(path, customer.cookie)).json();
  assert.equal(recent.messages.length, 100); assert.equal(recent.hasMore, true);
  const earlier = await (await api(`${path}?before=${recent.messages[0].id}`, customer.cookie)).json();
  assert.equal(earlier.messages.length, 6); assert.equal(earlier.hasMore, false);
});

test("live event stream delivers a manager reply and stops after session revocation", async () => {
  const customer = await account(), admin = await account("ADMIN");
  const thread = await db.supportThread.create({ data: { userId: customer.id, status: "WAITING" } });
  const response = await api(`/api/support/${thread.id}/events`, customer.cookie);
  assert.equal(response.status, 200); assert.match(response.headers.get("content-type")!, /text\/event-stream/);
  const reader = response.body!.getReader(); const decoder = new TextDecoder();
  await reader.read();
  await api(`/api/support/${thread.id}`, admin.cookie, "POST", input("A real manager reply"));
  let received = "";
  for (let i = 0; i < 8 && !received.includes("A real manager reply"); i++) { const part = await reader.read(); if (part.done) break; received += decoder.decode(part.value); }
  assert.match(received, /A real manager reply/);
  await db.user.update({ where: { id: customer.id }, data: { sessionVersion: 1 } });
  let closed = false;
  for (let i = 0; i < 4; i++) { if ((await reader.read()).done) { closed = true; break; } }
  await reader.cancel(); assert.ok(closed, "revoked sessions must stop receiving events");
});

test("detailed briefs cover applications and fit the generation limit", () => {
  assert.equal(PROMPT_LIBRARY.length, 32);
  assert.ok(PROMPT_LIBRARY.filter(p => p.category === "SaaS applications").length >= 12);
  for (const item of PROMPT_LIBRARY) { assert.ok(item.prompt.length > 1500, item.id); assert.ok(item.prompt.length < 7800, item.id); }
});

test("admin accounts can request automated help as customers without impersonating a manager", async () => {
  const admin = await account("ADMIN");
  const { thread } = await (await api("/api/support", admin.cookie, "POST")).json();
  const response = await api(`/api/support/${thread.id}`, admin.cookie, "POST", input("How do I use Components?"));
  const snapshot = await response.json();
  assert.equal(snapshot.messages[0].role, "user");
  assert.equal(snapshot.messages[1].role, "assistant");
  const claimed = await api(`/api/support/${thread.id}`, admin.cookie, "POST", { ...input("", "claim"), asManager: true });
  assert.equal(claimed.status, 200);
});
