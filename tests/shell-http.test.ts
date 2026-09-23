import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import { Sandbox } from "e2b";
import { db } from "../src/lib/db";

if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("An isolated schema is required");
const origin = "http://localhost:3848";

test("HTTP shell session is owned, streams commands, merges saved changes and preserves conflicts", { timeout: 120_000 }, async () => {
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3848"], { env: process.env, stdio: "ignore" });
  let projectId = "";
  const controller = new AbortController();
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${origin}/login`)).ok) break; } catch { /* Starting */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    const owner = await db.user.create({ data: { email: "shell-owner@test.invalid" } });
    const other = await db.user.create({ data: { email: "shell-other@test.invalid" } });
    const project = await db.project.create({ data: { userId: owner.id, name: "Shell test", slug: "shell-test", html: "<!doctype html><h1>Original</h1>" } });
    projectId = project.id;
    const jwt = async (id: string) => new SignJWT({ sub: id, ver: 0 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    const cookie = await jwt(owner.id);
    const endpoint = `${origin}/api/projects/${project.id}/shell`;
    const post = (body: object, token = cookie) => fetch(endpoint, { method: "POST", headers: { origin, cookie: `idaevia_session=${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await post({ action: "connect" }, "")).status, 401);
    const foreign = await jwt(other.id);
    for (const action of ["connect", "stop", "download", "sync"]) assert.equal((await post({ action }, foreign)).status, 404);
    const connected = await post({ action: "connect" });
    assert.equal(connected.status, 200, JSON.stringify(await connected.json()));
    const first = await db.setting.findUniqueOrThrow({ where: { key: `shell:${project.id}` } });
    assert.equal((await post({ action: "connect" })).status, 200);
    const second = await db.setting.findUniqueOrThrow({ where: { key: `shell:${project.id}` } });
    assert.equal(JSON.parse(first.value).pid, JSON.parse(second.value).pid);

    const stream = await fetch(endpoint, { headers: { cookie: `idaevia_session=${cookie}` }, signal: controller.signal });
    assert.equal(stream.status, 200);
    const reader = stream.body!.getReader();
    let output = ""; let ready = false;
    const reading = (async () => {
      let buffer = "";
      const decoder = new TextDecoder();
      try { for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const parts = buffer.split("\n\n"); buffer = parts.pop()!;
        for (const part of parts) {
          if (part.startsWith("event: ready")) ready = true;
          if (part.startsWith("event: output")) output += Buffer.from(JSON.parse(part.split("data: ")[1]), "base64").toString();
        }
      } } catch { /* Abort on cleanup */ }
    })();
    const wait = async (condition: () => boolean) => { const end = Date.now() + 15_000; while (!condition()) { if (Date.now() > end) throw new Error("HTTP terminal event timed out"); await new Promise((r) => setTimeout(r, 100)); } };
    await wait(() => ready);
    const command = await post({ action: "command", data: "printf '\\nHTTP_SHELL_OK\\n'" });
    assert.equal(command.status, 200, JSON.stringify(await command.json()));
    await wait(() => output.includes("\r\nHTTP_SHELL_OK\r\n"));
    await db.project.update({ where: { id: project.id }, data: { html: "<!doctype html><h1>Saved update</h1>" } });
    const updated = await post({ action: "command", data: "grep -q 'Saved update' index.html && printf '\\nSYNC_OK\\n'" });
    assert.equal(updated.status, 200);
    await wait(() => output.includes("\r\nSYNC_OK\r\n"));
    await post({ action: "command", data: "echo 'Shell edit' > index.html; printf '\\nEDIT_OK\\n'" });
    await wait(() => output.includes("\r\nEDIT_OK\r\n"));
    await db.project.update({ where: { id: project.id }, data: { html: "Another editor change" } });
    assert.equal((await post({ action: "sync" })).status, 409);
    const archive = await post({ action: "download" });
    assert.equal(archive.status, 200); assert.equal(archive.headers.get("content-type"), "application/gzip");
    assert.ok((await archive.arrayBuffer()).byteLength > 0);
    controller.abort(); await reading;
    assert.equal((await post({ action: "stop" })).status, 200);
  } finally {
    controller.abort();
    if (projectId) {
      const row = await db.setting.findUnique({ where: { key: `shell:${projectId}` } });
      if (row) await Sandbox.kill(JSON.parse(row.value).sandboxId).catch(() => {});
    }
    server.kill(); await db.$disconnect();
  }
});
