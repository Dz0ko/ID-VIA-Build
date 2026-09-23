import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db } from "../src/lib/db";
import { runAgent } from "../src/lib/ai/generate";
import { PROVIDERS, type GenerateInput } from "../src/lib/ai/provider";
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Isolated schema required");
after(() => db.$disconnect());
let serial = 0;
async function fixture(html = "") {
  const owner = await db.user.create({ data: { email: `generation-${++serial}@fixture.invalid`, plan: "MAX", credits: 100000, purchasedCredits: 50000 } });
  const project = await db.project.create({ data: { userId: owner.id, name: "Fixture", slug: `generation-${serial}`, html } });
  return { owner, project };
}
async function provider(work: (inputs: GenerateInput[]) => Promise<void>, text = "<!doctype html><html><body><h1>Makeup Marketplace</h1></body></html>", stopReason = "stop") {
  const generate = PROVIDERS.openai.generate, available = PROVIDERS.openai.available;
  const inputs: GenerateInput[] = [];
  PROVIDERS.openai.available = () => true;
  PROVIDERS.openai.generate = async (_model, input) => { inputs.push(input); return { text, stopReason, model: "gpt-5.6-terra", provider: "openai", inputTokens: 20, outputTokens: 40 }; };
  try { await work(inputs); } finally { PROVIDERS.openai.generate = generate; PROVIDERS.openai.available = available; }
}
test("the product brief survives clarification, reload and a bare technology reply", async () => {
  const { owner, project } = await fixture();
  const brief = "Build a makeup marketplace for independent beauty brands with a blush pink storefront";
  const options = { userId: owner.id, projectId: project.id, plan: "MAX" as const, preferProvider: "openai" as const };
  await provider(async inputs => {
    assert.equal((await runAgent({ ...options, request: brief })).mode, "clarification");
    assert.equal(inputs.length, 0);
    const pending = await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { messages: true } });
    assert.equal(JSON.parse(pending.memory!).pendingBuildRequest, brief);
    assert.ok(pending.messages.some(m => m.content === brief));
    // A new call has no browser state, exactly like a refresh or another device.
    await runAgent({ ...options, request: "HTML + CSS + JavaScript" });
    assert.ok(inputs[0].messages.at(-1)!.content.includes(brief));
    assert.ok(inputs[0].messages.at(-1)!.content.includes("STACK CHOICE: HTML + CSS + JavaScript"));
    const saved = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(JSON.parse(saved.memory!).pendingBuildRequest, undefined);
  });
});
test("a stack alone cannot spend credits inventing an unrelated product", async () => {
  const { owner, project } = await fixture();
  await provider(async inputs => {
    const result = await runAgent({ userId: owner.id, projectId: project.id, plan: "MAX", request: "Next.js + TypeScript + PostgreSQL", preferProvider: "openai" });
    assert.equal(result.mode, "clarification"); assert.equal(inputs.length, 0);
    assert.equal(await db.creditLedger.count({ where: { userId: owner.id } }), 0);
  });
});
for (const [name, text, stopReason] of [["malformed", "No usable files", "stop"], ["truncated", "<!doctype html><html><body>Partial</body></html>", "length"]]) {
  test(`${name} output preserves source and fully refunds plan and purchased credits`, async () => {
    const original = "<!doctype html><html><body>Original</body></html>";
    const { owner, project } = await fixture(original);
    await db.user.update({ where: { id: owner.id }, data: { purchasedCredits: 100000 } });
    await provider(async () => {
      await assert.rejects(runAgent({ userId: owner.id, projectId: project.id, plan: "MAX", request: "Rebuild the whole website as a makeup marketplace in HTML", preferProvider: "openai" }));
      const user = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
      assert.equal(user.credits, 100000); assert.equal(user.purchasedCredits, 100000);
      assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).html, original);
      assert.equal(await db.version.count({ where: { projectId: project.id } }), 0);
      assert.equal((await db.creditLedger.findFirstOrThrow({ where: { userId: owner.id } })).delta, 0);
    }, text, stopReason);
  });
}
test("successful generation charges the class/cost floor, not the larger estimate", async () => {
  const { owner, project } = await fixture("<!doctype html><html><body>Original</body></html>");
  await provider(async () => {
    await runAgent({ userId: owner.id, projectId: project.id, plan: "MAX", request: "Change text to Hello", preferProvider: "openai" });
    const row = await db.creditLedger.findFirstOrThrow({ where: { userId: owner.id } });
    const meta = JSON.parse(row.meta!);
    assert.ok(meta.estimated > meta.byClass);
    assert.equal(-row.delta, meta.byClass);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).credits, 100000 + row.delta);
  });
});
test("a save failure after billing restores the debit exactly once", async () => {
  const { owner, project } = await fixture("<!doctype html><html><body>Original</body></html>");
  const create = db.version.create;
  db.version.create = (() => { throw new Error("simulated save failure"); }) as unknown as typeof create;
  try {
    await provider(async () => {
      await assert.rejects(runAgent({ userId: owner.id, projectId: project.id, plan: "MAX", request: "Change text to Hello", preferProvider: "openai" }), /save failure/);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).credits, 100000);
      assert.equal((await db.creditLedger.findFirstOrThrow({ where: { userId: owner.id } })).delta, 0);
      assert.match((await db.project.findUniqueOrThrow({ where: { id: project.id } })).html, /Original/);
    });
  } finally { db.version.create = create; }
});
