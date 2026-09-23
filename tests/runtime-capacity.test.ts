import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../src/lib/db";
import { reserveRuntimeCapacity } from "../src/lib/runtime-capacity";
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Isolated database schema required");

test("parallel runtime reservations enforce per-user limits without blocking other users", async () => {
  const user = await db.user.create({ data: { email: "runtime-owner@fixture.invalid" } });
  const other = await db.user.create({ data: { email: "runtime-other@fixture.invalid" } });
  const reservations = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => reserveRuntimeCapacity(user.id, `shell:test-${i}`)));
  const active = reservations.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof reserveRuntimeCapacity>>> => r.status === "fulfilled");
  assert.equal(active.length, 3);
  assert.equal(reservations.filter(r => r.status === "rejected").length, 3);
  const otherRelease = await reserveRuntimeCapacity(other.id, "shell:other");
  await otherRelease();
  await Promise.all(active.map(r => r.value()));
});
test("existing sessions count, replacements reuse a slot, and expired sessions release capacity", async () => {
  const user = await db.user.create({ data: { email: "runtime-counts@fixture.invalid" } });
  const projects = await Promise.all([0,1,2].map(i => db.project.create({ data: { userId: user.id, name: `Runtime ${i}`, slug: `runtime-counts-${i}` } })));
  for (const p of projects) await db.setting.create({ data: { key: `shell:${p.id}`, value: JSON.stringify({ expiresAt: Date.now() + 60000 }) } });
  await assert.rejects(reserveRuntimeCapacity(user.id, "shell:fourth"), /3 active/);
  const replace = await reserveRuntimeCapacity(user.id, `shell:${projects[0].id}`); await replace();
  await db.setting.update({ where: { key: `shell:${projects[0].id}` }, data: { value: JSON.stringify({ expiresAt: Date.now() - 1 }) } });
  const retry = await reserveRuntimeCapacity(user.id, "shell:fourth"); await retry();
});
