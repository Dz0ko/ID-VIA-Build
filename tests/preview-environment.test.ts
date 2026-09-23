import assert from "node:assert/strict";
import { test } from "node:test";
import type { Sandbox } from "e2b";
import { preparePreviewEnvironment } from "../src/lib/preview-environment";
const files = [{ path: "/prisma/schema.prisma", content: 'provider = "postgresql"' }, { path: "/.env.example", content: "JWT_SECRET=example" }];
function fake() {
  const commands: string[] = [];
  return { commands, sandbox: { commands: { run: async (command: string) => { commands.push(command); } } } as unknown as Sandbox };
}
test("missing database provisions sandbox-local Postgres and fresh preview secrets", async () => {
  const f = fake();
  const first = await preparePreviewEnvironment(f.sandbox, files, {});
  const second = await preparePreviewEnvironment(fake().sandbox, files, {});
  assert.equal(new URL(first.DATABASE_URL).hostname, "127.0.0.1");
  assert.equal(first.IDAEVIA_LOCAL_DATABASE, "1");
  assert.notEqual(first.DATABASE_URL, second.DATABASE_URL);
  assert.notEqual(first.JWT_SECRET, second.JWT_SECRET);
  assert.equal(first.NODE_OPTIONS, "--max-old-space-size=1536");
  assert.match(f.commands[0], /listen_addresses=127.0.0.1/);
});
test("configured project database is preserved and never automatically migrated", async () => {
  const f = fake();
  const env = await preparePreviewEnvironment(f.sandbox, files, { DATABASE_URL: "postgresql://project.example/db", JWT_SECRET: "project-owned-secret", NODE_OPTIONS: "--max-old-space-size=256", IDAEVIA_LOCAL_DATABASE: "1" });
  assert.equal(env.DATABASE_URL, "postgresql://project.example/db");
  assert.equal(env.JWT_SECRET, "project-owned-secret");
  assert.equal(env.IDAEVIA_LOCAL_DATABASE, undefined);
  assert.deepEqual(f.commands, []);
  assert.equal(env.NODE_OPTIONS, "--max-old-space-size=1536");
});
test("SQLite uses the project's declared variable and the app memory budget", async () => {
  const f = fake();
  const env = await preparePreviewEnvironment(f.sandbox, [{ path: "/prisma/schema.prisma", content: 'datasource db { provider = "sqlite"\nurl = env("PROJECT_DB") }' }], {}, 4096);
  assert.equal(env.PROJECT_DB, "file:./idaevia-preview.db");
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.IDAEVIA_LOCAL_DATABASE, "1");
  assert.equal(env.NODE_OPTIONS, "--max-old-space-size=3072");
  assert.deepEqual(f.commands, []);
});
