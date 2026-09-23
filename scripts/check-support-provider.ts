import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { resolveModel, generateWithFallback } = await import("../src/lib/ai/router");
  const { SUPPORT_KNOWLEDGE } = await import("../src/lib/support");
  const { db } = await import("../src/lib/db");
  try {
    const model = await resolveModel("fast");
    if (model.fallback) throw new Error("No live support provider configured");
    const result = await generateWithFallback(model, { system: SUPPORT_KNOWLEDGE, messages: [{ role: "user", content: "How do I add a component to my existing website in IDAEVIA? Please give me short steps." }], maxOutput: 1200, effort: "low", signal: AbortSignal.timeout(20000) });
    const ok = result.text.length > 80 && /component/i.test(result.text) && !result.text.includes("[HANDOFF]");
    console.log(JSON.stringify({ ok, provider: result.provider, model: result.model, reply: result.text, inputTokens: result.inputTokens, outputTokens: result.outputTokens }));
    if (!ok) process.exitCode = 1;
  } catch { console.error("Live support provider check failed; no credentials or provider internals are printed."); process.exitCode = 1; }
  finally { await db.$disconnect(); }
}
void main();
