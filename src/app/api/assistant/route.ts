import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { json, withUser } from "@/lib/api";
import { ASSISTANT_SYSTEM, mockAssistantReply } from "@/lib/assistant";
import { friendlyAiError, generateWithFallback, resolveModel, tierForTask } from "@/lib/ai/router";
import { estimateCreditsDetailed, finalizeCredits, InsufficientCredits, releaseCredits, reserveCredits } from "@/lib/credits";
import { estimateUsd } from "@/lib/ai/cost";
import { rateLimit } from "@/lib/security";

export async function GET() {
  return withUser(async (user) => {
    const messages = await db.assistantMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 300 });
    return json({ messages });
  });
}

export async function DELETE() {
  return withUser(async (user) => {
    await db.assistantMessage.deleteMany({ where: { userId: user.id } });
    return json({ ok: true });
  });
}

/** Chat with the IDÆVIA Agent (SSE stream). History is persisted per user. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const body = z.object({ message: z.string().min(1).max(4000) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Write a message." }, { status: 400 });
  const limited = await rateLimit(`assistant:user:${user.id}`, 30, 600);
  if (limited) return limited;

  await db.assistantMessage.create({ data: { userId: user.id, role: "user", content: body.data.message } });
  const history = await db.assistantMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 24 });
  const messages = history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const tier = tierForTask("small", user.plan);
  const resolved = await resolveModel(tier);
  const estimate = await estimateCreditsDetailed({ taskClass: "small", agentMultiplier: 1, tier, model: resolved.config.model, docTokens: Math.ceil(JSON.stringify(messages).length / 4), mode: "report" });
  const credits = estimate.hold;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { /* A disconnected browser cannot roll back completed work. */ } };
      let reservation: Awaited<ReturnType<typeof reserveCredits>> | null = null;
      let runId: string | null = null;
      try {
        reservation = await reserveCredits(user.id, credits, "assistant");
        const run = await db.agentRun.create({ data: { userId: user.id, agentId: "assistant", status: "RUNNING", task: body.data.message, model: resolved.config.model } });
        runId = run.id;
        let costUsd = 0;
        send({ type: "meta", model: resolved.config.model, provider: resolved.provider.id, credits, fallback: resolved.fallback });
        let text: string;
        if (resolved.fallback) {
          text = mockAssistantReply(body.data.message);
          for (let i = 0; i < text.length; i += 60) { send({ type: "delta", text: text.slice(i, i + 60) }); await new Promise((r) => setTimeout(r, 12)); }
        } else {
          const result = await generateWithFallback(resolved, {
            system: ASSISTANT_SYSTEM,
            messages,
            maxOutput: 4000,
            effort: "low",
            onText: (t) => send({ type: "delta", text: t }),
            signal: req.signal,
          });
          costUsd = result.provider === "mock" ? 0 : estimateUsd(result.model, result);
          await db.agentRun.update({ where: { id: runId }, data: { costUsd, inputTokens: result.inputTokens, outputTokens: result.outputTokens, model: result.model } });
          text = result.text;
        }
        const saved = await db.assistantMessage.create({ data: { userId: user.id, role: "assistant", content: text } });
        const charged = await finalizeCredits({ userId: user.id, ledgerId: reservation.ledgerId, hold: credits, byClassCredits: estimate.byClass, costUsd, k: estimate.k, purchasedHeld: reservation.purchasedSpent, note: "IDÆVIA Agent conversation", meta: { costUsd, tier } });
        await db.agentRun.update({ where: { id: runId }, data: { status: "DONE", creditsUsed: charged, finishedAt: new Date() } });
        send({ type: "done", id: saved.id, content: text, credits: charged });
      } catch (e) {
        if (e instanceof InsufficientCredits) send({ type: "error", message: `Not enough credits (need ${e.needed}, have ${e.have}).` });
        else {
          if (reservation) await releaseCredits({ userId: user.id, ledgerId: reservation.ledgerId, hold: credits, keep: 0, purchasedHeld: reservation.purchasedSpent, note: "IDÆVIA Agent conversation failed, credits returned" });
          if (runId) await db.agentRun.update({ where: { id: runId }, data: { status: "FAILED", finishedAt: new Date() } });
          send({ type: "error", message: friendlyAiError(e) });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
