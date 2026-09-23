import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateWithFallback, resolveModel } from '../src/lib/ai/router';
import { PROVIDERS } from '../src/lib/ai/provider';
import { db } from '../src/lib/db';
import { DEFAULT_SETTINGS } from '../src/lib/settings';

// No network or database calls: these tests verify routing and streaming failure behavior.
test('provider fallback respects cooldown, explicit retry, cancellation and streamed output', async () => {
  const original = { available: PROVIDERS.openai.available, generate: PROVIDERS.openai.generate, anthropic: PROVIDERS.anthropic.available, settings: db.setting.findUnique };
  let fallbackCalls = 0;
  PROVIDERS.openai.available = () => true;
  PROVIDERS.anthropic.available = () => true;
  PROVIDERS.openai.generate = async (model) => { fallbackCalls++; return { model, provider: 'openai', text: 'ok', inputTokens: 1, outputTokens: 1 }; };
  db.setting.findUnique = (async () => null) as typeof db.setting.findUnique;
  const failure = Object.assign(new Error('capacity'), { status: 429 });
  const resolved = { tier: 'frontier' as const, config: DEFAULT_SETTINGS.tiers.frontier, fallback: false, provider: { id: 'anthropic' as const, available: () => true, generate: async () => { throw failure; } } };
  const input = { system: 'test', messages: [{ role: 'user' as const, content: 'test' }] };
  try {
    const response = await generateWithFallback(resolved, input);
    assert.equal(response.fellBack, true); assert.equal(response.model, 'gpt-6-astra');
    assert.equal((await resolveModel('frontier', 'anthropic')).provider.id, 'openai');
    assert.equal((await resolveModel('frontier', 'anthropic', true)).provider.id, 'anthropic');
    const ac = new AbortController(); ac.abort();
    await assert.rejects(generateWithFallback(resolved, { ...input, signal: ac.signal }));
    await assert.rejects(generateWithFallback({ ...resolved, provider: { ...resolved.provider, generate: async (_model, request) => { request.onText?.('partial'); throw failure; } } }, input));
    assert.equal(fallbackCalls, 1);
    db.setting.findUnique = (async () => ({ updatedAt: new Date(), key: 'app', value: JSON.stringify({ tiers: { frontier: { ...DEFAULT_SETTINGS.tiers.frontier, provider: 'openai', model: 'gpt-6-astra' } } }) })) as typeof db.setting.findUnique;
    const switched = await resolveModel('frontier', 'anthropic', true);
    assert.equal(switched.provider.id, 'anthropic'); assert.equal(switched.config.model, DEFAULT_SETTINGS.tiers.frontier.model);
  } finally {
    PROVIDERS.openai.available = original.available; PROVIDERS.openai.generate = original.generate;
    PROVIDERS.anthropic.available = original.anthropic; db.setting.findUnique = original.settings;
    await db.$disconnect();
  }
});
