/**
 * Provider list prices in USD per 1M tokens, used to record the real cost of
 * every agent run next to the credits it charged. Keep in sync with the
 * "Credit economics" doc when models or prices change.
 */
const PRICES: { match: RegExp; input: number; output: number; cacheRead: number }[] = [
  { match: /fable|mythos/, input: 10, output: 50, cacheRead: 0.25 },
  { match: /opus/, input: 5, output: 25, cacheRead: 0.5 },
  { match: /sonnet-5/, input: 2, output: 10, cacheRead: 0.2 },
  { match: /sonnet/, input: 3, output: 15, cacheRead: 0.3 },
  { match: /haiku/, input: 1, output: 5, cacheRead: 0.1 },
  { match: /gpt-6-astra/, input: 10, output: 50, cacheRead: 1 },
  { match: /gpt-5\.6-sol/, input: 4, output: 20, cacheRead: 0.4 },
  { match: /gpt-5\.6-terra/, input: 2, output: 12, cacheRead: 0.2 },
  { match: /gpt-5\.6-luna/, input: 0.2, output: 1.2, cacheRead: 0.02 },
  { match: /gpt-4\.1/, input: 2, output: 8, cacheRead: 0.5 },
  { match: /gpt-4o/, input: 2.5, output: 10, cacheRead: 1.25 },
];

export function estimateUsd(model: string, usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number }) {
  const p = PRICES.find((x) => x.match.test(model));
  if (!p) return 0;
  const cached = usage.cacheReadTokens ?? 0;
  const uncached = Math.max(0, usage.inputTokens - cached);
  return (uncached * p.input + cached * p.cacheRead + usage.outputTokens * p.output) / 1_000_000;
}
