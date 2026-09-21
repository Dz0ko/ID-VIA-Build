import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkAgentAccess, resolveAgent } from "@/lib/agents-runtime";
import { runAgent, type RunEvent } from "@/lib/ai/generate";
import { InsufficientCredits } from "@/lib/credits";
import { MODEL_TIERS, PLANS } from "@/lib/plans";
import { db } from "@/lib/db";
import { agentAllowed, pickAgent } from "@/lib/agents";
import { rateLimit } from "@/lib/security";

const schema = z.object({
  request: z.string().min(1).max(8000),
  agentId: z.string().optional(),
  tier: z.enum(MODEL_TIERS).optional(),
  images: z
    .array(z.object({ mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]), data: z.string().max(6_000_000) }))
    .max(4)
    .optional(),
});

/** Streams Server-Sent Events while an agent works on the project. */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/run">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid input." }, { status: 400 });
  const limited = (await rateLimit(`run:user:${user.id}:min`, 12, 60)) ?? (await rateLimit(`run:user:${user.id}:day`, 400, 86400));
  if (limited) return limited;

  let agentId = body.data.agentId ?? "builder";
  let autoPicked = false;
  if (agentId === "auto") {
    const proj = await db.project.findFirst({ where: { id, userId: user.id }, select: { html: true, kind: true, _count: { select: { files: true } } } });
    const hasContent = proj ? (proj.kind === "app" ? proj._count.files > 0 : Boolean(proj.html.trim())) : false;
    const picked = pickAgent(body.data.request, hasContent);
    agentId = agentAllowed(user.plan, picked) ? picked : "builder";
    autoPicked = true;
  }
  const resolved = await resolveAgent(agentId, user.id);
  if (!resolved) return Response.json({ error: "Unknown agent" }, { status: 400 });
  const denied = checkAgentAccess(user.plan, agentId, resolved.custom);
  if (denied) return Response.json({ error: denied.error, code: "AGENT_LOCKED", minPlan: denied.minPlan, minPlanName: PLANS[denied.minPlan].name }, { status: 403 });
  if (body.data.images?.length && user.plan === "FREE") {
    return Response.json({ error: "Screenshot → website (vision) is available from the Starter plan.", code: "PLAN", minPlan: "STARTER" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: RunEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (autoPicked) send({ type: "picked", agent: agentId });
        await runAgent({
          userId: user.id,
          plan: user.plan,
          projectId: id,
          request: body.data.request,
          agentId,
          requestedTier: body.data.tier,
          images: body.data.images,
          onEvent: send,
          signal: req.signal,
        });
      } catch (e) {
        if (e instanceof InsufficientCredits) {
          send({ type: "error", message: `Not enough credits (need ${e.needed}, have ${e.have}). Top up or upgrade your plan.` });
        } else if (!(e instanceof Error && /did not return/.test(e.message))) {
          send({ type: "error", message: e instanceof Error ? e.message : "Generation failed" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
