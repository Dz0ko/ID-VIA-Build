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
    // After the technology the project asks once for its quality mode, with real credit numbers.
    const quality = await runAgent({ ...options, request: "HTML + CSS + JavaScript", onEvent: e => { if (e.type === "clarification") { assert.equal(e.kind, "quality"); assert.equal(e.choices!.length, 2); assert.ok(e.choices!.find(c => c.id === "xhigh")!.credits > e.choices!.find(c => c.id === "high")!.credits); assert.ok(e.choices!.some(c => c.recommended)); } } });
    assert.equal(quality.mode, "clarification"); assert.equal(inputs.length, 0);
    const asked = JSON.parse((await db.project.findUniqueOrThrow({ where: { id: project.id } })).memory!);
    assert.ok(asked.pendingBuildRequest.includes("STACK CHOICE: HTML + CSS + JavaScript")); assert.equal(asked.pendingQuality.length, 2);
    assert.equal(await db.creditLedger.count({ where: { userId: owner.id } }), 0);
    // An older tab wraps the answer as a technology choice; it is still the quality answer, never the stack.
    await runAgent({ ...options, request: `${brief}\n\nSTACK CHOICE: QUALITY CHOICE: xhigh` });
    assert.ok(inputs[0].messages.at(-1)!.content.includes(brief));
    assert.ok(inputs[0].messages.at(-1)!.content.includes("STACK CHOICE: HTML + CSS + JavaScript"));
    assert.ok(!inputs[0].messages.at(-1)!.content.includes("QUALITY CHOICE"));
    assert.equal(inputs[0].effort, "high"); // GPT-6 Astra stays at high even in best-quality mode
    const saved = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(JSON.parse(saved.memory!).pendingBuildRequest, undefined);
    assert.equal(JSON.parse(saved.memory!).pendingQuality, undefined);
    assert.equal(JSON.parse(saved.memory!).quality, "xhigh");
    assert.equal(JSON.parse(saved.memory!).stack, "HTML + CSS + JavaScript");
    // Changing the mode later is free and needs no build.
    assert.equal((await runAgent({ ...options, request: "balanced quality" })).mode, "clarification");
    assert.equal(JSON.parse((await db.project.findUniqueOrThrow({ where: { id: project.id } })).memory!).quality, "high");
    assert.equal(inputs.length, 1);
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
      assert.equal(inputs.length, 2);
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
  }, '<<<HTML_EDITS>>>[{"search":"Original","replace":"Hello"}]<<<END HTML_EDITS>>>');
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
    }, '<<<HTML_EDITS>>>[{"search":"Original","replace":"Hello"}]<<<END HTML_EDITS>>>');
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

test('a new overall look rewrites the whole document instead of exact edits and keeps the content', async () => {
  const original = '<!doctype html><html><head><title>KIKO</title></head><body><main>Original wheel</main><script>window.spin=()=>42;</script></body></html>';
  const { owner, project } = await fixture(original);
  await provider(async inputs => {
    const events: string[] = [];
    await runAgent({ userId: owner.id, projectId: project.id, plan: 'MAX', request: 'change the design to more moderen and proffesional', agentId: 'designer', preferProvider: 'openai', onEvent: event => events.push(event.type) });
    assert.match(inputs[0].system, /WHOLE-SITE RESTYLE/); assert.doesNotMatch(inputs[0].system, /OUTPUT FORMAT OVERRIDE/);
    assert.match(inputs[0].messages.at(-1)!.content, /return the full updated HTML/);
    assert.equal(inputs[0].effort, 'high'); // GPT-6 Astra deep level; Claude runs restyles at xhigh
    const saved = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    assert.match(saved.html, /Restyled wheel/); assert.ok(saved.html.includes('window.spin=()=>42;'));
    const ledger = await db.creditLedger.findFirstOrThrow({ where: { projectId: project.id } });
    assert.match(ledger.note!, /full restyle/); assert.equal(JSON.parse(ledger.meta!).taskClass, 'page');
    const run = await db.agentRun.findFirstOrThrow({ where: { projectId: project.id } });
    assert.equal(run.status, 'DONE'); assert.equal(run.ledgerId, ledger.id);
  }, '<!doctype html><html><head><title>KIKO</title></head><body class="bg-neutral-950"><main>Restyled wheel</main><script>window.spin=()=>42;</script></body></html>');
});

test('a restyle of a document too large for one pass asks for a section without charging', async () => {
  const { owner, project } = await fixture(`<!doctype html><html><body>${'<section>Large section content that repeats</section>'.repeat(3200)}</body></html>`);
  await provider(async inputs => {
    const result = await runAgent({ userId: owner.id, projectId: project.id, plan: 'MAX', request: 'make it more modern', agentId: 'designer', preferProvider: 'openai' });
    assert.equal(result.mode, 'clarification'); assert.equal(inputs.length, 0);
    assert.equal(await db.creditLedger.count({ where: { userId: owner.id } }), 0);
    assert.equal(await db.agentRun.count({ where: { projectId: project.id } }), 0);
    assert.match((await db.message.findFirstOrThrow({ where: { projectId: project.id, role: 'assistant' } })).content, /which part to restyle first/);
  });
});

test('a repair attempt is skipped and refunded when the time budget cannot fit it', async () => {
  const { owner, project } = await fixture('<!doctype html><html><body>Original</body></html>');
  const generate = PROVIDERS.openai.generate, available = PROVIDERS.openai.available;
  let calls = 0;
  PROVIDERS.openai.available = () => true;
  PROVIDERS.openai.generate = async () => { calls++; await new Promise(r => setTimeout(r, 120)); return { text: '<!doctype html><html><body>Partial', stopReason: 'length', model: 'gpt-6-astra', provider: 'openai', inputTokens: 20, outputTokens: 40 }; };
  try {
    const events: string[] = [];
    // 20 s covers the database setup but is under the minimum a repair attempt requires.
    await assert.rejects(runAgent({ userId: owner.id, projectId: project.id, plan: 'MAX', request: 'Rebuild the whole website', preferProvider: 'openai', budgetMs: 20_000, onEvent: event => events.push(event.type) }));
    assert.equal(calls, 1); assert.ok(!events.includes('retry'));
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).credits, 100000);
    assert.equal((await db.agentRun.findFirstOrThrow({ where: { projectId: project.id } })).status, 'FAILED');
  } finally { PROVIDERS.openai.generate = generate; PROVIDERS.openai.available = available; }
});

test('progress heartbeats report thinking, writing, checking and saving with elapsed time', async () => {
  const { owner, project } = await fixture('<!doctype html><html><body>Original</body></html>');
  const generate = PROVIDERS.openai.generate, available = PROVIDERS.openai.available;
  PROVIDERS.openai.available = () => true;
  PROVIDERS.openai.generate = async (_model, input) => {
    await new Promise(r => setTimeout(r, 3400));
    input.onText?.('<<<HTML_EDITS>>>');
    await new Promise(r => setTimeout(r, 3400));
    return { text: '<<<HTML_EDITS>>>[{"search":"Original","replace":"Updated"}]<<<END HTML_EDITS>>>', stopReason: 'stop', model: 'gpt-5.6-terra', provider: 'openai', inputTokens: 20, outputTokens: 40 };
  };
  try {
    const events: { type: string; phase?: string; message?: string; elapsedMs?: number }[] = [];
    await runAgent({ userId: owner.id, projectId: project.id, plan: 'MAX', request: 'Change the title text to Updated', preferProvider: 'openai', onEvent: event => events.push(event as typeof events[number]) });
    const progress = events.filter(e => e.type === 'progress');
    const phases = progress.map(e => e.phase);
    assert.ok(phases.indexOf('thinking') >= 0 && phases.indexOf('writing') > phases.indexOf('thinking'), phases.join(','));
    assert.ok(phases.indexOf('checking') > phases.indexOf('writing') && phases.indexOf('saving') > phases.indexOf('checking'), phases.join(','));
    assert.ok(progress.every(e => /\d+:\d\d$/.test(e.message!)), progress.map(e => e.message).join(' | '));
    assert.ok(progress.find(e => e.phase === 'writing')!.message!.includes('so far'));
    assert.ok(progress.some(e => e.elapsedMs! >= 3000));
  } finally { PROVIDERS.openai.generate = generate; PROVIDERS.openai.available = available; }
});

test('a run whose server process was stopped is refunded, closed and reported once', async () => {
  const { reconcileStaleRuns, STALE_RUN_MS } = await import('../src/lib/stale-runs');
  const { reserveCredits } = await import('../src/lib/credits');
  const { owner, project } = await fixture('<html><body>Kept</body></html>');
  await db.user.update({ where: { id: owner.id }, data: { credits: 1000, purchasedCredits: 300 } });
  const hold = await reserveCredits(owner.id, 900, 'agent:designer', project.id, 'Designer · full restyle · running…');
  assert.equal(hold.purchasedSpent, 200);
  const stale = await db.agentRun.create({ data: { userId: owner.id, projectId: project.id, agentId: 'designer', status: 'RUNNING', task: 'make it more modern', model: 'claude-fable-5-1', creditsUsed: 900, ledgerId: hold.ledgerId, startedAt: new Date(Date.now() - STALE_RUN_MS - 1000) } });
  const fresh = await db.agentRun.create({ data: { userId: owner.id, projectId: project.id, agentId: 'designer', status: 'RUNNING', task: 'still running', creditsUsed: 1 } });
  assert.equal(await reconcileStaleRuns(owner.id), 1);
  assert.equal(await reconcileStaleRuns(owner.id), 0);
  const user = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
  assert.equal(user.credits, 1000); assert.equal(user.purchasedCredits, 300);
  const ledger = await db.creditLedger.findUniqueOrThrow({ where: { id: hold.ledgerId } });
  assert.equal(ledger.delta, 0); assert.equal(JSON.parse(ledger.meta!).settlement, 'refunded'); assert.match(ledger.note!, /fully refunded/);
  assert.equal((await db.agentRun.findUniqueOrThrow({ where: { id: stale.id } })).status, 'FAILED');
  assert.equal((await db.agentRun.findUniqueOrThrow({ where: { id: fresh.id } })).status, 'RUNNING');
  assert.equal(await db.message.count({ where: { projectId: project.id, role: 'assistant' } }), 1);
  assert.equal(await db.platformIncident.count({ where: { runId: stale.id } }), 1);
  assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).html, '<html><body>Kept</body></html>');
});

test('selected component uses targeted edits and preserves the working project', async () => {
  const { owner, project } = await fixture('<!doctype html><html><head></head><body><main>Original wheel</main><script>window.spin=()=>42;</script></body></html>');
  const request = 'Implement the selected components in this project: Solar eclipse.\n[COMPONENT:space-eclipse] add this component to the landing page';
  await provider(async inputs => {
    await runAgent({userId:owner.id,projectId:project.id,plan:'MAX',request,preferProvider:'openai'});
    assert.match(inputs[0].system, /OUTPUT FORMAT OVERRIDE/);
    assert.equal(inputs[0].effort, 'high'); // small edits of an existing site run at high, not xhigh
    const saved=await db.project.findUniqueOrThrow({where:{id:project.id}});
    assert.match(saved.html,/Solar eclipse/); assert.match(saved.html,/Original wheel/); assert.ok(saved.html.includes('window.spin=()=>42;'));
  },'<<<HTML_EDITS>>>[{"search":"</main>","replace":"<section>Solar eclipse</section></main>"}]<<<END HTML_EDITS>>>');
});

test('app text edits preserve other files, binary assets, row IDs and the existing stack', async()=>{
 const {owner,project}=await fixture();
 await db.project.update({where:{id:project.id},data:{kind:'app',memory:JSON.stringify({stack:'Next.js + TypeScript'})}});
 const files=[{path:'/src/app/page.tsx',content:'export default function Page(){return <h1>Old headline</h1>}'},{path:'/package.json',content:'{"scripts":{"dev":"next dev"}}'},{path:'/public/logo.png',content:'IDAEVIA_BINARY_V1:AAAA'},{path:'/backend/main.py',content:'print("keep me")'}];
 for(const f of files)await db.projectFile.create({data:{projectId:project.id,...f}});
 const before=await db.projectFile.findMany({where:{projectId:project.id},orderBy:{path:'asc'}});
 await provider(async inputs=>{
  await runAgent({userId:owner.id,projectId:project.id,plan:'MAX',request:'Change only the headline to Java courses',preferProvider:'openai'});
  assert.match(inputs[0].system,/FILE_EDITS/);assert.match(inputs[0].system,/SCOPE OVERRIDE/);
 },'<<<FILE_EDITS>>>[{"op":"edit","path":"/src/app/page.tsx","edits":[{"search":"Old headline","replace":"Java courses"}]}]<<<END FILE_EDITS>>>');
 const after=await db.projectFile.findMany({where:{projectId:project.id},orderBy:{path:'asc'}});
 assert.deepEqual(after.map(f=>f.id),before.map(f=>f.id));
 for(const f of after)assert.equal(f.content,f.path==='/src/app/page.tsx'?files[0].content.replace('Old headline','Java courses'):files.find(x=>x.path===f.path)!.content);
 assert.equal(JSON.parse((await db.project.findUniqueOrThrow({where:{id:project.id}})).memory!).stack,'Next.js + TypeScript');
});

test('an invalid exact edit is repaired once without saving the bad output or charging for it',async()=>{
 const {owner,project}=await fixture('<html><body><h1>Old</h1><footer>Keep</footer></body></html>');
 const original=PROVIDERS.openai.generate,available=PROVIDERS.openai.available;let calls=0;
 PROVIDERS.openai.available=()=>true;
 PROVIDERS.openai.generate=async()=>({text:`<<<HTML_EDITS>>>[{"search":"${++calls===1?'Missing':'Old'}","replace":"New"}]<<<END HTML_EDITS>>>`,stopReason:'stop',model:'gpt-6-astra',provider:'openai',inputTokens:20,outputTokens:40});
 try{
  await runAgent({userId:owner.id,projectId:project.id,plan:'MAX',request:'Can you replace only the headline?',preferProvider:'openai'});
  assert.equal(calls,2);assert.equal((await db.project.findUniqueOrThrow({where:{id:project.id}})).html,'<html><body><h1>New</h1><footer>Keep</footer></body></html>');
  assert.equal(await db.version.count({where:{projectId:project.id}}),1);
 }finally{PROVIDERS.openai.generate=original;PROVIDERS.openai.available=available}
});

test('a clarification and a technical question do not change the project or create versions',async()=>{
 const {owner,project}=await fixture('<html><body>Unchanged</body></html>');
 await provider(async()=>{
  const options={userId:owner.id,projectId:project.id,plan:'MAX' as const,preferProvider:'openai' as const};
  assert.equal((await runAgent({...options,request:'Replace the logo'})).mode,'report');
  assert.equal((await runAgent({...options,request:'How do I push this project to GitHub?'})).mode,'report');
  assert.equal((await db.project.findUniqueOrThrow({where:{id:project.id}})).html,project.html);
  assert.equal(await db.version.count({where:{projectId:project.id}}),0);
 },'<<<ANSWER>>>Which uploaded image should replace the logo?<<<END_ANSWER>>>');
});

test('an uploaded logo is saved as actual image bytes and unrelated HTML stays identical',async()=>{
 const {owner,project}=await fixture('<html><body><img src="old.png"><p>Unchanged text</p></body></html>');
 const original=PROVIDERS.openai.generate,available=PROVIDERS.openai.available;
 PROVIDERS.openai.available=()=>true;
 PROVIDERS.openai.generate=async(_model,input)=>{
  assert.equal(input.images?.length,1);
  const token=input.messages.at(-1)!.content.match(/__IDAEVIA_IMAGE_[a-f0-9]+__/)![0];
  return {text:`<<<HTML_EDITS>>>${JSON.stringify([{search:'src="old.png"',replace:`src="${token}"`}])}<<<END HTML_EDITS>>>`,model:'gpt-6-astra',provider:'openai',inputTokens:20,outputTokens:40,stopReason:'stop'};
 };
 try{
  await runAgent({userId:owner.id,projectId:project.id,plan:'MAX',request:'Use the attached image as the logo. Keep everything else.',preferProvider:'openai',images:[{mediaType:'image/png',data:'aGVsbG8='}]});
  assert.equal((await db.project.findUniqueOrThrow({where:{id:project.id}})).html,project.html.replace('old.png','data:image/png;base64,aGVsbG8='));
 }finally{PROVIDERS.openai.generate=original;PROVIDERS.openai.available=available}
});

test('file-read requests stay inside the project and preserve a single charged operation',async()=>{
 const {owner,project}=await fixture();
 await db.project.update({where:{id:project.id},data:{kind:'app',memory:'{"stack":"Python + FastAPI"}'}});
 await db.projectFile.create({data:{projectId:project.id,path:'/main.py',content:'title = "Old"\nunchanged = True'}});
 const generate=PROVIDERS.openai.generate,available=PROVIDERS.openai.available;let calls=0;
 PROVIDERS.openai.available=()=>true;
 PROVIDERS.openai.generate=async(_model,input)=>{
  calls++;
  if(calls===2)assert.match(input.messages.at(-1)!.content,/title = "Old"/);
  return {text:calls===1?'<<<READ_FILES>>>["/main.py"]<<<END READ_FILES>>>':'<<<FILE_EDITS>>>[{"op":"edit","path":"/main.py","edits":[{"search":"Old","replace":"New"}]}]<<<END FILE_EDITS>>>',model:'gpt-6-astra',provider:'openai',inputTokens:10,outputTokens:20,stopReason:'stop'};
 };
 try{
  await runAgent({userId:owner.id,projectId:project.id,plan:'MAX',request:'Change only the title to New',preferProvider:'openai'});
  assert.equal(calls,2);assert.equal((await db.projectFile.findFirstOrThrow({where:{projectId:project.id}})).content,'title = "New"\nunchanged = True');
  const ledger=await db.creditLedger.findMany({where:{projectId:project.id}});assert.equal(ledger.length,1);assert.equal(JSON.parse(ledger[0].meta!).fileReads,1);
 }finally{PROVIDERS.openai.generate=generate;PROVIDERS.openai.available=available}
});
