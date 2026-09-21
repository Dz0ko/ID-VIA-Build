import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { json, withUser } from "@/lib/api";
import { ASSISTANT_SYSTEM, mockAssistantReply } from "@/lib/assistant";
import { friendlyAiError, generateWithFallback, resolveModel, tierForTask } from "@/lib/ai/router";
import { estimateCredits, InsufficientCredits, refundCredits, reserveCredits } from "@/lib/credits";
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
  const credits = await estimateCredits({ taskClass: "small", agentMultiplier: 1, tier });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await reserveCredits(user.id, credits, "assistant");
        const resolved = await resolveModel(tier);
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
          text = result.text;
        }
        const saved = await db.assistantMessage.create({ data: { userId: user.id, role: "assistant", content: text } });
        send({ type: "done", id: saved.id, content: text, credits });
      } catch (e) {
        if (e instanceof InsufficientCredits) send({ type: "error", message: `Not enough credits (need ${e.needed}, have ${e.have}).` });
        else { await refundCredits(user.id, credits, "refund:assistant"); send({ type: "error", message: friendlyAiError(e) }); }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
