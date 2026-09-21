import { db } from "../db";
import { AGENT_MAP } from "../agents";
import type { PlanId, ModelTier } from "../plans";
import { estimateCredits, refundCredits, reserveCredits } from "../credits";
import { BUILDER_SYSTEM, buildUserPrompt, extractHtml } from "./prompts";
import { classifyTask, resolveModel, tierForTask, type TaskClass } from "./router";

export interface RunOptions {
  userId: string;
  plan: PlanId;
  projectId: string;
  request: string;
  agentId?: string; // default: builder
  requestedTier?: ModelTier;
  onEvent?: (e: RunEvent) => void;
  signal?: AbortSignal;
}

export type RunEvent =
  | { type: "meta"; agent: string; tier: ModelTier; model: string; provider: string; credits: number; taskClass: TaskClass; fallback: boolean }
  | { type: "delta"; text: string }
  | { type: "done"; mode: "rewrite" | "report"; versionNumber?: number; html?: string; report?: string; creditsUsed: number }
  | { type: "error"; message: string };

/**
 * Run one agent against a project: classify → route → reserve credits → generate → persist.
 */
export async function runAgent(opts: RunOptions) {
  const agent = AGENT_MAP.get(opts.agentId ?? "builder");
  if (!agent) throw new Error("Unknown agent");

  const project = await db.project.findFirstOrThrow({
    where: { id: opts.projectId, userId: opts.userId },
  });

  const hasHtml = Boolean(project.html && project.html.trim());
  const taskClass: TaskClass = agent.mode === "report" ? "small" : classifyTask(opts.request, hasHtml);
  // Tier = max(task tier, agent preferred tier), unless the user picked one; then clamp to plan.
  const taskTier = tierForTask(taskClass, opts.plan);
  const order: ModelTier[] = ["fast", "standard", "advanced", "premium"];
  const merged = order[Math.max(order.indexOf(taskTier), order.indexOf(agent.tier))];
  const tier = tierForTask(taskClass, opts.plan, opts.requestedTier ?? merged);

  const credits = await estimateCredits({ taskClass, agentMultiplier: agent.multiplier, tier });
  await reserveCredits(opts.userId, credits, `agent:${agent.id}`, project.id);

  const resolved = await resolveModel(tier);
  const run = await db.agentRun.create({
    data: {
      userId: opts.userId,
      projectId: project.id,
      agentId: agent.id,
      status: "RUNNING",
      task: opts.request,
      model: resolved.config.model,
      creditsUsed: credits,
    },
  });

  opts.onEvent?.({
    type: "meta",
    agent: agent.id,
    tier,
    model: resolved.config.model,
    provider: resolved.provider.id,
    credits,
    taskClass,
    fallback: resolved.fallback,
  });

  let memory: Record<string, unknown> = {};
  try {
    memory = JSON.parse(project.memory || "{}");
  } catch {
    /* ignore */
  }

  const system = agent.id === "builder" ? BUILDER_SYSTEM : agent.systemPrompt;
  const userPrompt =
    agent.mode === "rewrite"
      ? buildUserPrompt({ request: opts.request, html: project.html, memory })
      : `PROJECT: ${project.name}\n${project.description ?? ""}\n\nCURRENT DOCUMENT:\n<<<HTML\n${project.html}\nHTML>>>\n\nREQUEST:\n${opts.request}`;

  await db.message.create({
    data: { projectId: project.id, role: "user", content: opts.request, agentId: agent.id },
  });

  try {
    const result = await resolved.provider.generate(resolved.config.model, {
      system,
      messages: [{ role: "user", content: userPrompt }],
      maxOutput: resolved.config.maxOutput,
      effort: resolved.config.effort,
      onText: (t) => opts.onEvent?.({ type: "delta", text: t }),
      signal: opts.signal,
    });

    if (agent.mode === "rewrite") {
      const html = extractHtml(result.text);
      if (!/<html[\s>]/i.test(html)) throw new Error("Model did not return an HTML document.");
      const last = await db.version.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
      const number = (last?.number ?? 0) + 1;
      await db.$transaction([
        db.project.update({ where: { id: project.id }, data: { html } }),
        db.version.create({
          data: { projectId: project.id, number, html, message: `${agent.name}: ${opts.request.slice(0, 120)}` },
        }),
        db.message.create({
          data: {
            projectId: project.id,
            role: "assistant",
            content: `Updated the project (v${number}) using ${agent.name}.`,
            agentId: agent.id,
            model: result.model,
            creditsUsed: credits,
          },
        }),
        db.agentRun.update({
          where: { id: run.id },
          data: { status: "DONE", finishedAt: new Date(), output: `v${number}` },
        }),
      ]);
      opts.onEvent?.({ type: "done", mode: "rewrite", versionNumber: number, html, creditsUsed: credits });
      return { mode: "rewrite" as const, html, versionNumber: number, credits };
    }

    await db.$transaction([
      db.message.create({
        data: {
          projectId: project.id,
          role: "assistant",
          content: result.text,
          agentId: agent.id,
          model: result.model,
          creditsUsed: credits,
        },
      }),
      db.agentRun.update({
        where: { id: run.id },
        data: { status: "DONE", finishedAt: new Date(), output: result.text },
      }),
    ]);
    opts.onEvent?.({ type: "done", mode: "report", report: result.text, creditsUsed: credits });
    return { mode: "report" as const, report: result.text, credits };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await refundCredits(opts.userId, credits, `refund:${agent.id}`, project.id);
    await db.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), output: message, creditsUsed: 0 },
    });
    opts.onEvent?.({ type: "error", message });
    throw err;
  }
}
