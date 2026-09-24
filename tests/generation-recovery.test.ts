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
    await provider(async inputs => {
      await assert.rejects(runAgent({ userId: owner.id, projectId: project.id, plan: "MAX", request: "Rebuild the whole website as a makeup marketplace in HTML", preferProvider: "openai" }));
      assert.equal(inputs.length, stopReason === "length" ? 2 : 1);
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

test('a truncated generation retries once, saves only the complete result and absorbs the failed attempt cost', async () => {
  const { owner, project } = await fixture('<!doctype html><html><body>Original</body></html>');
  const generate = PROVIDERS.openai.generate, available = PROVIDERS.openai.available;
  const inputs: GenerateInput[] = [];
  PROVIDERS.openai.available = () => true;
  PROVIDERS.openai.generate = async (_model, input) => {
    inputs.push(input);
    return { text: inputs.length === 1 ? '<!doctype html><html><body>Partial' : '<!doctype html><html><body>Complete</body></html>', stopReason: inputs.length === 1 ? 'length' : 'stop', model: 'gpt-6-astra', provider: 'openai', inputTokens: 2000, outputTokens: inputs.length === 1 ? 32000 : 100 };
  };
  try {
    const events: string[] = [];
    await runAgent({ userId: owner.id, projectId: project.id, plan: 'MAX', request: 'Rebuild the whole website', preferProvider: 'openai', onEvent: event => events.push(event.type) });
    assert.equal(events.filter(type => type === 'retry').length, 1);
    assert.ok(events.indexOf('retry') < events.indexOf('done'));
    assert.equal(inputs.length, 2);
    assert.ok(inputs[1].maxOutput! >= inputs[0].maxOutput!);
    assert.equal(inputs[1].messages.at(-1)!.content, inputs[0].messages.at(-1)!.content);
    assert.match((await db.project.findUniqueOrThrow({where:{id:project.id}})).html, /Complete/);
    assert.equal(await db.version.count({where:{projectId:project.id}}),1);
    const run = await db.agentRun.findFirstOrThrow({where:{projectId:project.id}});
    assert.equal(run.outputTokens,32100); assert.equal(run.inputTokens,4000);
    const ledger = await db.creditLedger.findMany({where:{projectId:project.id}});
    assert.equal(ledger.length,1);
    const meta = JSON.parse(ledger[0].meta!);
    assert.equal(meta.attempts,2); assert.ok(meta.totalProviderCostUsd > meta.costUsd);
    assert.equal(await db.platformIncident.count({where:{projectId:project.id}}),0);
  } finally { PROVIDERS.openai.generate=generate; PROVIDERS.openai.available=available; }
});

test('selected component uses targeted edits and preserves the working project', async () => {
  const { owner, project } = await fixture('<!doctype html><html><head></head><body><main>Original wheel</main><script>window.spin=()=>42;</script></body></html>');
  const request = 'Implement the selected components in this project: Solar eclipse.\n[COMPONENT:space-eclipse] add this component to the landing page';
  await provider(async inputs => {
    await runAgent({userId:owner.id,projectId:project.id,plan:'MAX',request,preferProvider:'openai'});
    assert.match(inputs[0].system, /OUTPUT FORMAT OVERRIDE/);
    const saved=await db.project.findUniqueOrThrow({where:{id:project.id}});
    assert.match(saved.html,/Solar eclipse/); assert.match(saved.html,/Original wheel/); assert.ok(saved.html.includes('window.spin=()=>42;'));
  },'<<<HTML_EDITS>>>[{"search":"</main>","replace":"<section>Solar eclipse</section></main>"}]<<<END HTML_EDITS>>>');
});
