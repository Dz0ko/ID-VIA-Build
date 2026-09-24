import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db } from "../src/lib/db";
import { runAgent } from "../src/lib/ai/generate";
import { PROVIDERS, type GenerateInput } from "../src/lib/ai/provider";
import { ProjectBusyError } from "../src/lib/project-lock";
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Isolated schema required");
after(() => db.$disconnect());

const ORIGINAL = "<!doctype html><html><head><title>Site</title></head><body><h1>Original</h1></body></html>";
function mockProvider(delayMs: number) {
  const generate = PROVIDERS.openai.generate, available = PROVIDERS.openai.available, tools = PROVIDERS.openai.generateWithTools;
  const inputs: GenerateInput[] = [];
  PROVIDERS.openai.available = () => true;
  PROVIDERS.openai.generateWithTools = undefined; // the single-shot edit path is under test here
  PROVIDERS.openai.generate = async (_model, input) => {
    inputs.push(input);
    await new Promise(r => setTimeout(r, delayMs));
    return { text: '<<<HTML_EDITS>>>[{"search":"Original","replace":"Updated"}]<<<END HTML_EDITS>>>', stopReason: "stop", model: "gpt-5.6-terra", provider: "openai", inputTokens: 200, outputTokens: 40 };
  };
  return { inputs, restore() { PROVIDERS.openai.generate = generate; PROVIDERS.openai.available = available; PROVIDERS.openai.generateWithTools = tools; } };
}

test("many users generating at the same time all finish, are charged once and leave no leases behind", async () => {
  const users = await Promise.all(Array.from({ length: 24 }, (_, i) => db.user.create({ data: { email: `concurrent-${i}@fixture.invalid`, plan: "PRO", credits: 5000 } })));
  const projects = await Promise.all(users.map((u, i) => db.project.create({ data: { userId: u.id, name: `P${i}`, slug: `concurrent-${i}`, html: ORIGINAL, memory: '{"stack":"HTML + CSS + JavaScript"}' } })));
  const mock = mockProvider(400);
  try {
    const results = await Promise.allSettled(projects.map((p, i) => runAgent({ userId: users[i].id, projectId: p.id, plan: "PRO", request: "Change the title text to Updated", preferProvider: "openai" })));
    const failed = results.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason?.message);
    assert.deepEqual(failed, []);
    assert.equal(mock.inputs.length, 24);
    for (const p of projects) {
      assert.match((await db.project.findUniqueOrThrow({ where: { id: p.id } })).html, /Updated/);
      assert.equal(await db.version.count({ where: { projectId: p.id } }), 1);
      const runs = await db.agentRun.findMany({ where: { projectId: p.id } });
      assert.equal(runs.length, 1); assert.equal(runs[0].status, "DONE");
      const ledger = await db.creditLedger.findMany({ where: { projectId: p.id } });
      assert.equal(ledger.length, 1); assert.equal(JSON.parse(ledger[0].meta!).settlement, "final");
      assert.equal(runs[0].ledgerId, ledger[0].id);
    }
    for (const u of users) {
      const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      const spent = (await db.creditLedger.aggregate({ where: { userId: u.id }, _sum: { delta: true } }))._sum.delta ?? 0;
      assert.equal(user.credits, 5000 + spent); assert.ok(spent < 0);
    }
    assert.equal(await db.setting.count({ where: { key: { startsWith: "project-write:" } } }), 0);
    assert.equal(await db.platformIncident.count(), 0);
  } finally { mock.restore(); }
});

test("one user cannot run more than the per-user limit at once, and the extra request costs nothing", async () => {
  const user = await db.user.create({ data: { email: "burst@fixture.invalid", plan: "PRO", credits: 5000 } });
  const projects = await Promise.all([0, 1, 2, 3].map(i => db.project.create({ data: { userId: user.id, name: `B${i}`, slug: `burst-${i}`, html: ORIGINAL, memory: '{"stack":"HTML + CSS + JavaScript"}' } })));
  const mock = mockProvider(600);
  try {
    const results = await Promise.allSettled(projects.map(p => runAgent({ userId: user.id, projectId: p.id, plan: "PRO", request: "Change the title text to Updated", preferProvider: "openai" })));
    const busy = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
    assert.equal(results.length - busy.length, 2);
    for (const r of busy) { assert.ok(r.reason instanceof ProjectBusyError, String(r.reason)); assert.equal(r.reason.status, 429); }
    assert.equal(await db.creditLedger.count({ where: { userId: user.id } }), 2);
    assert.equal(await db.agentRun.count({ where: { userId: user.id } }), 2);
    assert.equal(await db.setting.count({ where: { key: { startsWith: "project-write:" } } }), 0);
    // The same project twice at once: the second caller is told to wait, nothing is double-charged.
    const shared = await db.project.create({ data: { userId: user.id, name: "Shared", slug: "burst-shared", html: ORIGINAL, memory: '{"stack":"HTML + CSS + JavaScript"}' } });
    const same = await Promise.allSettled([0, 1].map(() => runAgent({ userId: user.id, projectId: shared.id, plan: "PRO", request: "Change the title text to Updated", preferProvider: "openai" })));
    assert.equal(same.filter(r => r.status === "fulfilled").length, 1, same.map(r => r.status === "rejected" ? String(r.reason?.message) : "ok").join(" | "));
    assert.ok(same.some(r => r.status === "rejected" && (r as PromiseRejectedResult).reason instanceof ProjectBusyError));
    assert.equal(await db.version.count({ where: { projectId: shared.id } }), 1);
    assert.equal(await db.creditLedger.count({ where: { projectId: shared.id } }), 1);
  } finally { mock.restore(); }
});
