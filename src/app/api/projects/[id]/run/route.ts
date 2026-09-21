import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { agentAllowed, AGENT_MAP, minPlanForAgent } from "@/lib/agents";
import { runAgent, type RunEvent } from "@/lib/ai/generate";
import { InsufficientCredits } from "@/lib/credits";
import { PLANS } from "@/lib/plans";

const schema = z.object({
  request: z.string().min(1).max(8000),
  agentId: z.string().optional(),
  tier: z.enum(["fast", "standard", "advanced", "premium"]).optional(),
});

/** Streams Server-Sent Events while an agent works on the project. */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/run">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid input." }, { status: 400 });

  const agentId = body.data.agentId ?? "builder";
  const agent = AGENT_MAP.get(agentId);
  if (!agent) return Response.json({ error: "Unknown agent" }, { status: 400 });
  if (!agentAllowed(user.plan, agentId)) {
    return Response.json(
      { error: `${agent.name} is available from the ${PLANS[minPlanForAgent(agent)].name} plan.`, code: "AGENT_LOCKED", minPlan: minPlanForAgent(agent) },
      { status: 403 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: RunEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await runAgent({
          userId: user.id,
          plan: user.plan,
          projectId: id,
          request: body.data.request,
          agentId,
          requestedTier: body.data.tier,
          onEvent: send,
          signal: req.signal,
        });
      } catch (e) {
        if (e instanceof InsufficientCredits) {
          send({ type: "error", message: `Not enough credits (need ${e.needed}, have ${e.have}). Top up or upgrade your plan.` });
        } else if (!(e instanceof Error && /HTML document/.test(e.message))) {
          send({ type: "error", message: e instanceof Error ? e.message : "Generation failed" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
