import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { db } from "../src/lib/db";
import { recordPlatformError } from "../src/lib/platform-errors";
import { readRuntimeReport, sourceFingerprint } from "../src/lib/runtime-report-store";
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Isolated schema required");
const base = "http://localhost:3848";
let server: ChildProcess;
before(async () => {
  const isolation = await db.$queryRaw<{ schema: string }[]>`SELECT current_schema()::text AS schema`;
  assert.equal(isolation[0].schema, process.env.TEST_DATABASE_SCHEMA);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3848"], { env: { ...process.env, E2B_API_KEY: "" }, stdio: "ignore" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/login")).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error("App did not start");
});
after(async () => { server?.kill("SIGTERM"); await db.$disconnect(); });
async function account(role = "USER") {
  const user = await db.user.create({ data: { email: `${randomUUID()}@incidents.invalid`, name: "Monitoring Customer", plan: "PRO", role } });
  const cookie = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return { ...user, cookie };
}
async function api(path: string, cookie = "", method = "GET", body?: unknown, origin = base) {
  return fetch(base + path, { method, headers: { origin, cookie: `idaevia_session=${cookie}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function project(userId: string) { return db.project.create({ data: { userId, name: "Incident preview project", slug: randomUUID(), kind: "app", memory: JSON.stringify({ stack: "React + TypeScript" }), files: { create: [{ path: "src/App.tsx", content: "export default function App(){return <main>Demo</main>}" }] } }, include: { files: true } }); }

test("incidents aggregate concurrent repeats, isolate projects and reopen on recurrence", async () => {
  const user = await account(), p = await project(user.id), other = await project(user.id);
  const context = { source: "build", userId: user.id, projectId: p.id };
  const ids = await Promise.all(Array.from({ length: 3 }, () => recordPlatformError(new Error("JavaScript heap out of memory"), context)));
  assert.ok(ids.every(Boolean)); assert.equal(new Set(ids).size, 1);
  const row = await db.platformIncident.findUniqueOrThrow({ where: { id: ids[0]! } });
  assert.ok(row.firstSeenAt <= row.lastSeenAt);
  assert.equal(row.occurrences, 3); assert.equal(row.revision, 3); assert.equal(row.code, "RUNTIME_MEMORY");
  assert.notEqual(await recordPlatformError(new Error("JavaScript heap out of memory"), { ...context, projectId: other.id }), row.id);
  await db.platformIncident.update({ where: { id: row.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  await recordPlatformError(new Error("JavaScript heap out of memory"), context);
  const reopened = await db.platformIncident.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(reopened.status, "NEW"); assert.equal(reopened.resolvedAt, null); assert.equal(reopened.occurrences, 4);
});

test("only admins can read or update incidents; stale resolution cannot hide a new error", async () => {
  const admin = await account("ADMIN"), user = await account(), supporter = await account("SUPPORTER");
  const id = await recordPlatformError(new Error("Provider quota exhausted"), { source: "generation", userId: user.id });
  assert.equal((await api("/api/admin/errors")).status, 401);
  for (const cookie of [user.cookie, supporter.cookie]) {
    assert.equal((await api("/api/admin/errors", cookie)).status, 403);
    assert.equal((await api("/api/admin/errors", cookie, "PATCH", { id, status: "RESOLVED", revision: 1, note: "" })).status, 403);
  }
  const response = await api(`/api/admin/errors?q=${user.email}&area=PROVIDER`, admin.cookie);
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /no-store/);
  const data = await response.json(); assert.equal(data.incidents.length, 1); assert.equal(data.incidents[0].user.id, user.id);
  assert.ok(data.incidents[0].steps.length > 0);
  const input = { id, status: "RESOLVED", revision: data.incidents[0].revision, note: "API_KEY=do-not-retain-this" };
  await recordPlatformError(new Error("Provider quota exhausted"), { source: "generation", userId: user.id });
  assert.equal((await api("/api/admin/errors", admin.cookie, "PATCH", input)).status, 409);
  assert.equal((await api("/api/admin/errors", admin.cookie, "PATCH", { ...input, revision: 2 })).status, 200);
  const row = await db.platformIncident.findUniqueOrThrow({ where: { id: id! } });
  assert.equal(row.status, "RESOLVED"); assert.ok(!row.note.includes("do-not-retain-this"));
});

test("browser ingestion is authenticated, bounded, untrusted and project-owner checked", async () => {
  const user = await account(), other = await account(), p = await project(user.id);
  const report = { message: "Prisma P1001 unexpected UI failure password=remove-this-secret", stack: "Error\n at /_next/static/failure.js:1:1", path: `/app/projects/${p.id}?token=do-not-store`, source: "billing", severity: "CRITICAL" };
  assert.equal((await api("/api/monitoring", "", "POST", report)).status, 401);
  assert.equal((await api("/api/monitoring", other.cookie, "POST", report)).status, 404);
  assert.equal((await api("/api/monitoring", user.cookie, "POST", report, "https://attacker.invalid")).status, 403);
  assert.equal((await api("/api/monitoring", user.cookie, "POST", { ...report, message: "x".repeat(2001) })).status, 400);
  assert.equal((await api("/api/monitoring", user.cookie, "POST", { ...report, message: "signal is aborted without reason" })).status, 200);
  assert.equal(await db.platformIncident.count({ where: { userId: user.id, source: "browser" } }), 0); // a cancelled request is not an incident
  assert.equal((await api("/api/monitoring", user.cookie, "POST", report)).status, 200);
  const row = await db.platformIncident.findFirstOrThrow({ where: { userId: user.id, source: "browser" } });
  assert.equal(row.severity, "MEDIUM"); assert.equal(row.area, "UNKNOWN"); assert.equal(row.route, `/app/projects/${p.id}`);
  assert.ok(!row.message.includes("remove-this-secret")); assert.ok(!JSON.stringify(row).includes("do-not-store"));
  for (let i = 0; i < 11; i++) await api("/api/monitoring", user.cookie, "POST", report);
  assert.equal((await api("/api/monitoring", user.cookie, "POST", report)).status, 429);
});

test("build, terminal and AI failures reach the admin feed without spending customer credits", async () => {
  const user = await account(), p = await project(user.id);
  const build = await api(`/api/projects/${p.id}/terminal`, user.cookie, "POST", { cmd: "build" });
  assert.equal(build.status, 200); assert.match(await build.text(), /runtime is not configured/);
  assert.equal((await db.platformIncident.findFirstOrThrow({ where: { projectId: p.id, source: "build" } })).code, "PROVIDER_CONFIGURATION");
  const shell = await api(`/api/projects/${p.id}/shell`, user.cookie, "POST", { action: "connect" });
  assert.equal(shell.status, 409);
  assert.ok(await db.platformIncident.findFirst({ where: { projectId: p.id, source: "shell" } }));
  const generation = await api(`/api/projects/${p.id}/run`, user.cookie, "POST", { request: "Build this React + TypeScript marketplace", agentId: "builder" });
  assert.match(await generation.text(), /"type":"error"/);
  assert.ok(await db.platformIncident.findFirst({ where: { projectId: p.id, source: "generation", userId: user.id } }));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).credits, user.credits);
});

test("handled API errors are recorded and normal forbidden requests do not create incidents", async () => {
  const admin = await account("ADMIN"), user = await account();
  const response = await api("/api/admin/users", admin.cookie, "PATCH", { id: "missing-user", role: "SUPPORTER" });
  assert.equal(response.status, 500); const body = await response.json(); assert.ok(body.incidentId);
  const incident = await db.platformIncident.findUniqueOrThrow({ where: { id: body.incidentId } });
  assert.equal(incident.userId, admin.id); assert.equal(incident.code, "DATABASE_FAILURE");
  const before = await db.platformIncident.count();
  assert.equal((await api("/api/admin/users", user.cookie)).status, 403);
  assert.equal(await db.platformIncident.count(), before);
});

test("an interrupted build is recorded once when its durable status is read", async () => {
  const user = await account(), p = await project(user.id);
  await db.setting.create({ data: { key: `runtime-report:${p.id}`, value: JSON.stringify({ status: "running", label: "React", startedAt: new Date(Date.now() - 7 * 60000).toISOString(), fingerprint: sourceFingerprint(p), log: "Starting build…" }) } });
  assert.equal((await readRuntimeReport(p))?.status, "error");
  await readRuntimeReport(p);
  const incidents = await db.platformIncident.findMany({ where: { projectId: p.id } });
  assert.equal(incidents.length, 1); assert.equal(incidents[0].occurrences, 1); assert.equal(incidents[0].userId, user.id);
});

test("monitoring persistence failure never replaces the original failure", async () => {
  // PostgreSQL rejects NUL text; failure to store diagnostics must not throw to the caller.
  assert.equal(await recordPlatformError(new Error("Capture failure"), { source: "test", userId: "\u0000" }), null);
});
