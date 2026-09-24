import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db } from "../src/lib/db";
import { PROVIDERS } from "../src/lib/ai/provider";
import { generateWithFallback } from "../src/lib/ai/router";
import { classifyProviderError, markProviderHealthy, providerHealth } from "../src/lib/provider-health";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Isolated schema required");
after(() => db.$disconnect());

test("provider errors are classified by what the operator must do", () => {
  assert.equal(classifyProviderError(Object.assign(new Error("Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."), { status: 400 })), "billing");
  assert.equal(classifyProviderError(Object.assign(new Error("You exceeded your current quota, please check your plan and billing details."), { status: 429, code: "insufficient_quota" })), "billing");
  assert.equal(classifyProviderError(Object.assign(new Error("invalid x-api-key"), { status: 401 })), "auth");
  assert.equal(classifyProviderError(Object.assign(new Error("Rate limit reached"), { status: 429 })), "capacity");
  assert.equal(classifyProviderError(Object.assign(new Error("Overloaded"), { status: 529 })), "capacity");
  assert.equal(classifyProviderError(Object.assign(new Error("messages: text content blocks must be non-empty"), { status: 400 })), null);
  assert.equal(classifyProviderError(new Error("Request was aborted.")), null);
});

test("an exhausted provider account alerts every administrator once, is visible in admin and clears after a working call", async () => {
  const admins = await Promise.all([1, 2].map(i => db.user.create({ data: { email: `admin-${i}@fixture.invalid`, role: "ADMIN", plan: "AGENCY" } })));
  await db.user.create({ data: { email: "member@fixture.invalid", plan: "PRO" } });
  const original = { anthropicAvailable: PROVIDERS.anthropic.available, anthropicGenerate: PROVIDERS.anthropic.generate, openaiAvailable: PROVIDERS.openai.available, openaiGenerate: PROVIDERS.openai.generate };
  const billing = Object.assign(new Error("Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."), { status: 400 });
  PROVIDERS.anthropic.available = () => true; PROVIDERS.openai.available = () => true;
  PROVIDERS.anthropic.generate = async () => { throw billing; };
  PROVIDERS.openai.generate = async model => ({ text: "ok", model, provider: "openai", inputTokens: 1, outputTokens: 1 });
  const resolved = { tier: "standard" as const, config: DEFAULT_SETTINGS.tiers.standard, fallback: false, provider: PROVIDERS.anthropic };
  const input = { system: "test", messages: [{ role: "user" as const, content: "hello" }] };
  try {
    const first = await generateWithFallback(resolved, input);
    assert.equal(first.fellBack, true); assert.equal(first.provider, "openai");
    const health = await providerHealth();
    assert.equal(health.find(h => h.provider === "anthropic")!.state, "billing");
    assert.equal(health.find(h => h.provider === "openai")!.state, "healthy");
    const incident = await db.platformIncident.findFirstOrThrow({ where: { source: "provider-anthropic-billing" } });
    assert.equal(incident.severity, "CRITICAL"); assert.equal(incident.area, "PROVIDER"); assert.match(incident.title, /no API credits/);
    assert.doesNotMatch(incident.message, /sk-ant/);
    const emails = await db.emailDelivery.findMany({ where: { kind: "alert" }, orderBy: { userId: "asc" } });
    assert.equal(emails.length, 2);
    assert.deepEqual(emails.map(e => e.userId).sort(), admins.map(a => a.id).sort());
    assert.match(emails[0].subject, /no credits/); assert.match(emails[0].body, /console\.anthropic\.com|Top up/); assert.match(emails[0].ctaUrl!, /\/admin\/errors$/);
    // A second failure within the same window adds no second email and no second incident.
    await generateWithFallback(resolved, input);
    assert.equal(await db.emailDelivery.count({ where: { kind: "alert" } }), 2);
    assert.equal(await db.platformIncident.count({ where: { source: { startsWith: "provider-" } } }), 1);
    // Once the account works again the alert clears.
    PROVIDERS.anthropic.generate = async model => ({ text: "ok", model, provider: "anthropic", inputTokens: 1, outputTokens: 1 });
    await markProviderHealthy("anthropic", true);
    assert.equal((await providerHealth()).find(h => h.provider === "anthropic")!.state, "healthy");
    const closed = await db.platformIncident.findUniqueOrThrow({ where: { id: incident.id } });
    assert.equal(closed.status, "RESOLVED"); assert.ok(closed.resolvedAt); assert.match(closed.note, /Resolved automatically/);
    // The next failure reopens the same incident rather than hiding behind the resolved one.
    PROVIDERS.anthropic.generate = async () => { throw billing; };
    await generateWithFallback(resolved, input);
    assert.equal((await db.platformIncident.findUniqueOrThrow({ where: { id: incident.id } })).status, "NEW");
  } finally {
    PROVIDERS.anthropic.available = original.anthropicAvailable; PROVIDERS.anthropic.generate = original.anthropicGenerate;
    PROVIDERS.openai.available = original.openaiAvailable; PROVIDERS.openai.generate = original.openaiGenerate;
  }
});

test("an ordinary model error is not reported as an account outage", async () => {
  const original = { available: PROVIDERS.openai.available, generate: PROVIDERS.openai.generate, anthropicAvailable: PROVIDERS.anthropic.available };
  PROVIDERS.openai.available = () => true; PROVIDERS.anthropic.available = () => false;
  PROVIDERS.openai.generate = async () => { throw Object.assign(new Error("Invalid image"), { status: 400 }); };
  try {
    await assert.rejects(generateWithFallback({ tier: "fast" as const, config: DEFAULT_SETTINGS.tiers.fast, fallback: false, provider: PROVIDERS.openai }, { system: "t", messages: [{ role: "user" as const, content: "x" }] }));
    assert.equal((await providerHealth()).find(h => h.provider === "openai")!.state, "healthy");
    assert.equal(await db.platformIncident.count({ where: { source: { startsWith: "provider-openai" } } }), 0);
  } finally { PROVIDERS.openai.available = original.available; PROVIDERS.openai.generate = original.generate; PROVIDERS.anthropic.available = original.anthropicAvailable; }
});
