import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
  const { getSettings } = await import('../src/lib/settings');
  const { PROVIDERS } = await import('../src/lib/ai/provider');
  const { db } = await import('../src/lib/db');
  const { BUILDER_SYSTEM, extractHtml } = await import('../src/lib/ai/prompts');
  const design = process.argv.includes('--design');
  try {
    const settings = await getSettings();
    for (const provider of ['anthropic', 'openai'] as const) {
      if (!PROVIDERS[provider].available()) {
        console.log(JSON.stringify({ provider, ok: false, reason: 'No local credentials configured' }));
        continue;
      }
      const model = provider === 'openai' ? 'gpt-6-astra' : settings.tiers.frontier.provider === 'anthropic' ? settings.tiers.frontier.model : process.env.AI_TIER_FRONTIER || 'claude-fable-5-1';
      try {
        const result = await PROVIDERS[provider].generate(model, {
          system: design ? BUILDER_SYSTEM : 'This is a connection check. Reply with only OK.',
          messages: [{ role: 'user', content: design ? 'Build a compact modern HTML landing page for a fictional architecture studio called Forma. Focus on an excellent responsive navbar with 3 working section links and a keyboard-accessible mobile toggle. Add compact hero, work and contact sections as link destinations. Use light editorial styling, no invented customers or statistics. Keep the complete implementation under 220 lines.' : 'Reply OK.' }], maxOutput: design ? 6500 : 1024, effort: design ? 'medium' : 'low',
          signal: AbortSignal.timeout(design ? 120000 : 45000),
        });
        const html = extractHtml(result.text);
        const checks = design ? { completeHtml: /<html[\s>]/i.test(html) && /<\/html>/i.test(html), navigation: /<nav[\s>]/i.test(html), mobileToggle: /aria-expanded/.test(html) && /aria-controls/.test(html), keyboardEscape: /Escape/.test(html), responsive: /@media|(?:sm|md|lg):/.test(html), completeOutput: !['length', 'max_tokens'].includes(result.stopReason ?? '') } : { reply: result.text.trim() === 'OK' };
        const ok = Object.values(checks).every(Boolean);
        console.log(JSON.stringify({ provider, requestedModel: model, actualModel: result.model, ok, checks, inputTokens: result.inputTokens, outputTokens: result.outputTokens, stopReason: result.stopReason }));
        if (!ok) process.exitCode = 1;
      } catch (error) {
        const e = error as { status?: number; message?: string; name?: string };
        const reason = /credit|billing|quota/i.test(e.message ?? '') ? 'Billing or quota rejected' : /model|not found/i.test(e.message ?? '') ? 'Model unavailable or invalid configuration' : 'Provider request failed';
        console.log(JSON.stringify({ provider, model, ok: false, status: e.status, reason, errorType: e.name }));
        process.exitCode = 1;
      }
    }
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Provider check could not load local configuration.'); process.exitCode = 1; });
