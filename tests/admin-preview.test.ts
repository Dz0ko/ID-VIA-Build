import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import { Sandbox } from "e2b";
import { sourceFingerprint } from "../src/lib/runtime-report-store";
import { db } from "../src/lib/db";

if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Isolated schema required");
test("admin preview runs a separate snapshot, excludes secrets and preserves the owner's session", { timeout: 180000 }, async () => {
  const base = "http://localhost:3848";
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3848"], { env: process.env, stdio: "ignore" });
  let previewKey: string | undefined;
  const token = (id: string) => new SignJWT({ sub: id, ver: 0 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const api = (path: string, session = "", action?: string) => fetch(base + path, { method: action ? "POST" : "GET", headers: { Cookie: `idaevia_session=${session}`, ...(action ? { "Content-Type": "application/json" } : {}) }, ...(action ? { body: JSON.stringify({ action }) } : {}) });
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const owner = await db.user.create({ data: { email: "preview-owner@fixture.invalid" } });
    const admin = await db.user.create({ data: { email: "preview-admin@fixture.invalid", role: "ADMIN" } });
    const project = await db.project.create({ data: { userId: owner.id, name: "Admin app fixture", slug: "admin-app-fixture", kind: "app", envEncrypted: "MUST_NOT_BE_DECRYPTED", files: { create: [
      { path: "/package.json", content: JSON.stringify({ name: "preview-fixture", scripts: { dev: "node server.cjs" } }) },
      { path: "/server.cjs", content: "require('http').createServer((q,s)=>s.end('<!doctype html><html><h1>Admin app preview</h1></html>')).listen(3000,'0.0.0.0')" },
      { path: "/.env", content: "PRIVATE_TOKEN=OWNER_SECRET" },
      { path: "/.env.local", content: "DATABASE_URL=PRIVATE_DATABASE" },
      { path: "/.env.example", content: "JWT_SECRET=" },
    ] } } });
    const originalFiles = await db.projectFile.findMany({ where: { projectId: project.id }, orderBy: { path: "asc" } });
    const ownerState = JSON.stringify({ sandboxId: "OWNER_SESSION_MUST_NOT_BE_TOUCHED", pid: 123, expiresAt: Date.now() + 600000 });
    await db.setting.create({ data: { key: `shell:${project.id}`, value: ownerState } });
    const endpoint = `/api/admin/projects/${project.id}/runtime`, ownerToken = await token(owner.id), adminToken = await token(admin.id);
    assert.equal((await api(endpoint)).status, 401);
    const ownerRuntime = `/api/projects/${project.id}/runtime`;
    assert.equal((await api(ownerRuntime)).status, 401);
    assert.equal((await api(ownerRuntime, adminToken)).status, 404);
    const ownerInfo = await api(ownerRuntime, ownerToken);
    assert.equal(ownerInfo.status, 200);
    assert.equal((await ownerInfo.json()).profile.id, "node");
    assert.equal(ownerInfo.headers.get("cache-control"), "private, no-store");
    assert.equal((await api(endpoint, ownerToken)).status, 403);
    assert.equal((await api(endpoint, ownerToken, "start")).status, 403);
    assert.equal((await api(endpoint, adminToken, "command")).status, 400);
    assert.equal((await api("/api/admin/projects/missing/runtime", adminToken)).status, 404);
    assert.deepEqual(await (await api(endpoint, adminToken)).json(), { ready: false });
    const page = await api(`/admin/projects/${project.id}`, adminToken);
    assert.match(await page.text(), /Start preview/);
    const share = await db.shareLink.create({ data: { projectId: project.id, token: "multilang-shared-fixture" } });
    const source = { ...project, files: originalFiles };
    const sharedUrl = "https://3000-shared-fixture.e2b.app/";
    await db.setting.create({ data: { key: `runtime:${project.id}`, value: JSON.stringify({ sandboxId: "fixture", url: sharedUrl, expiresAt: Date.now() + 600000, fingerprint: sourceFingerprint(source) }) } });
    const shared = await (await api(`/api/portal/${share.token}`)).json();
    assert.equal(shared.project.browserSandbox, false);
    assert.equal(shared.project.previewUrl, sharedUrl);
    assert.equal((await api(`/api/portal/${share.token}/files`)).status, 403);
    assert.equal((await api('/api/portal/invalid-link/files')).status, 404);
    assert.equal(JSON.stringify(shared).includes("OWNER_SECRET"), false);
    const redirect = await fetch(`${base}/api/projects/${project.id}/preview`, { headers: { Cookie: `idaevia_session=${ownerToken}` }, redirect: "manual" });
    assert.equal(redirect.status, 307); assert.equal(redirect.headers.get("location"), sharedUrl);
    await db.shareLink.update({ where: { id: share.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.notEqual((await api(`/api/portal/${share.token}`)).status, 200);
    await db.setting.delete({ where: { key: `runtime:${project.id}` } });
    const started = await api(endpoint, adminToken, "start");
    const events = (await started.text()).split("\n\n").filter(x => x.startsWith("data: ")).map(x => JSON.parse(x.slice(6)));
    assert.equal(events.some(e => e.type === "error"), false, JSON.stringify(events));
    const ready = events.find(e => e.type === "ready"); assert.ok(ready);
    assert.match(await (await fetch(ready.url)).text(), /Admin app preview/);
    previewKey = `admin-preview:${admin.id}:${project.id}`;
    const state = JSON.parse((await db.setting.findUniqueOrThrow({ where: { key: previewKey } })).value);
    const sandbox = await Sandbox.connect(state.sandboxId);
    assert.equal((await sandbox.getInfo()).memoryMB, 4096);
    assert.equal(await sandbox.files.exists("/home/user/project/.env"), false);
    assert.equal(await sandbox.files.exists("/home/user/project/.env.local"), false);
    assert.equal(await sandbox.files.exists("/home/user/project/.env.example"), true);
    const reused = await api(endpoint, adminToken, "start");
    assert.ok((await reused.text()).includes(ready.url));
    assert.equal((await (await api(endpoint, adminToken)).json()).ready, true);
    assert.equal((await db.setting.findUniqueOrThrow({ where: { key: `shell:${project.id}` } })).value, ownerState);
    assert.deepEqual(await db.projectFile.findMany({ where: { projectId: project.id }, orderBy: { path: "asc" } }), originalFiles);
    assert.equal(await db.creditLedger.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.version.count({ where: { projectId: project.id } }), 0);
    await db.projectFile.update({ where: { projectId_path: { projectId: project.id, path: "/server.cjs" } }, data: { content: "// New saved source" } });
    assert.equal((await (await api(endpoint, adminToken)).json()).ready, false);
    assert.equal((await api(endpoint, adminToken, "stop")).status, 200);
    assert.equal(await db.setting.findUnique({ where: { key: previewKey } }), null);
    assert.equal((await db.setting.findUniqueOrThrow({ where: { key: `shell:${project.id}` } })).value, ownerState);
  } finally {
    if (previewKey) { const row = await db.setting.findUnique({ where: { key: previewKey } }); if (row) await Sandbox.kill(JSON.parse(row.value).sandboxId).catch(() => {}); }
    server.kill(); await db.$disconnect();
  }
});
