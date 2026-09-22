import { db } from "../db";
import type { PlanId, ModelTier } from "../plans";
import { estimateCredits, refundCredits, reserveCredits } from "../credits";
import { resolveAgent } from "../agents-runtime";
import {
  APP_BUILDER_SYSTEM,
  BUILDER_SYSTEM,
  buildAppUserPrompt,
  buildUserPrompt,
  extractHtml,
  parseFileManifest,
} from "./prompts";
import { classifyTask, friendlyAiError, generateWithFallback, resolveModel, tierForTask, type TaskClass } from "./router";
import type { InputImage } from "./provider";
import { estimateUsd } from "./cost";

export interface RunOptions {
  userId: string;
  plan: PlanId;
  projectId: string;
  request: string;
  agentId?: string; // default: builder
  requestedTier?: ModelTier;
  images?: InputImage[];
  onEvent?: (e: RunEvent) => void;
  signal?: AbortSignal;
}

export type RunEvent =
  | { type: "meta"; agent: string; tier: ModelTier; model: string; provider: string; credits: number; taskClass: TaskClass; fallback: boolean }
  | { type: "picked"; agent: string }
  | { type: "delta"; text: string }
  | { type: "done"; mode: "rewrite" | "report"; versionNumber?: number; html?: string; files?: { path: string; content: string }[]; report?: string; creditsUsed: number }
  | { type: "error"; message: string };

const ORDER: ModelTier[] = ["fast", "standard", "advanced", "premium", "frontier"];

/**
 * Run one agent against a project: classify → route → reserve credits → generate → persist.
 * Supports single-file websites (html) and multi-file React apps (kind === "app").
 */
export async function runAgent(opts: RunOptions) {
  const resolvedAgent = await resolveAgent(opts.agentId ?? "builder", opts.userId);
  if (!resolvedAgent) throw new Error("Unknown agent");
  const { agent } = resolvedAgent;

  const project = await db.project.findFirstOrThrow({
    where: { id: opts.projectId, userId: opts.userId },
    include: { files: true },
  });
  const isApp = project.kind === "app";
  const hasContent = isApp ? project.files.length > 0 : Boolean(project.html && project.html.trim());

  const taskClass: TaskClass = agent.mode === "report" ? "small" : classifyTask(opts.request, hasContent);
  const taskTier = tierForTask(taskClass, opts.plan);
  const merged = ORDER[Math.max(ORDER.indexOf(taskTier), ORDER.indexOf(agent.tier))];
  const tier = tierForTask(taskClass, opts.plan, opts.requestedTier ?? merged);
  const visionBump = opts.images?.length ? 1.5 : 1;

  const credits = await estimateCredits({ taskClass, agentMultiplier: agent.multiplier * visionBump * (isApp ? 1.5 : 1), tier });
  const { purchasedSpent } = await reserveCredits(opts.userId, credits, `agent:${agent.id}`, project.id);

  const resolved = await resolveModel(tier);
  const run = await db.agentRun.create({
    data: { userId: opts.userId, projectId: project.id, agentId: agent.id, status: "RUNNING", task: opts.request, model: resolved.config.model, creditsUsed: credits },
  });

  opts.onEvent?.({ type: "meta", agent: agent.id, tier, model: resolved.config.model, provider: resolved.provider.id, credits, taskClass, fallback: resolved.fallback });

  let memory: Record<string, unknown> = {};
  try { memory = JSON.parse(project.memory || "{}"); } catch { /* ignore */ }

  let system: string;
  let userPrompt: string;
  if (agent.mode === "report") {
    system = agent.systemPrompt;
    const current = isApp
      ? project.files.map((f) => `<<<FILE ${f.path}>>>\n${f.content}\n<<<END>>>`).join("\n")
      : `<<<HTML\n${project.html}\nHTML>>>`;
    userPrompt = `PROJECT: ${project.name}\n${project.description ?? ""}\n\nCURRENT ${isApp ? "FILES" : "DOCUMENT"}:\n${current}\n\nREQUEST:\n${opts.request}`;
  } else if (isApp) {
    system = agent.id === "builder" ? APP_BUILDER_SYSTEM : `${APP_BUILDER_SYSTEM}\n\nSPECIALIST ROLE:\n${agent.systemPrompt}`;
    userPrompt = buildAppUserPrompt({ request: opts.request, files: project.files, memory });
  } else {
    system = agent.id === "builder" ? BUILDER_SYSTEM : agent.systemPrompt;
    userPrompt = buildUserPrompt({ request: opts.request, html: project.html, memory });
  }
  if (opts.images?.length) userPrompt += `\n\n(${opts.images.length} reference image(s) attached, recreate their design faithfully.)`;

  await db.message.create({
    data: { projectId: project.id, role: "user", content: opts.images?.length ? `${opts.request}\n[${opts.images.length} image(s) attached]` : opts.request, agentId: agent.id },
  });

  try {
    const result = await generateWithFallback(resolved, {
      system,
      messages: [{ role: "user", content: userPrompt }],
      images: opts.images,
      maxOutput: resolved.config.maxOutput,
      effort: resolved.config.effort,
      onText: (t) => opts.onEvent?.({ type: "delta", text: t }),
      signal: opts.signal,
    });
    const usage = {
      model: result.model, // the model that actually answered (may differ after a provider fallback)
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: resolved.provider.id === "mock" && !result.fellBack ? 0 : estimateUsd(result.model, result),
    };

    if (agent.mode === "rewrite" && isApp) {
      const files = parseFileManifest(result.text, project.files);
      if (!files.some((f) => f.path === "/App.tsx")) throw new Error("Model did not return /App.tsx.");
      const last = await db.version.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
      const number = (last?.number ?? 0) + 1;
      await db.$transaction([
        db.projectFile.deleteMany({ where: { projectId: project.id } }),
        ...files.map((f) => db.projectFile.create({ data: { projectId: project.id, path: f.path, content: f.content } })),
        db.version.create({ data: { projectId: project.id, number, html: JSON.stringify(files), message: `${agent.name}: ${opts.request.slice(0, 120)}` } }),
        db.message.create({ data: { projectId: project.id, role: "assistant", content: `Updated the app (v${number}, ${files.length} files) using ${agent.name}.`, agentId: agent.id, model: result.model, creditsUsed: credits } }),
        db.agentRun.update({ where: { id: run.id }, data: { status: "DONE", finishedAt: new Date(), output: `v${number}`, ...usage } }),
      ]);
      opts.onEvent?.({ type: "done", mode: "rewrite", versionNumber: number, files, creditsUsed: credits });
      return { mode: "rewrite" as const, files, versionNumber: number, credits };
    }

    if (agent.mode === "rewrite") {
      const html = extractHtml(result.text);
      if (!/<html[\s>]/i.test(html)) throw new Error("Model did not return an HTML document.");
      const last = await db.version.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
      const number = (last?.number ?? 0) + 1;
      await db.$transaction([
        db.project.update({ where: { id: project.id }, data: { html } }),
        db.version.create({ data: { projectId: project.id, number, html, message: `${agent.name}: ${opts.request.slice(0, 120)}` } }),
        db.message.create({ data: { projectId: project.id, role: "assistant", content: `Updated the project (v${number}) using ${agent.name}.`, agentId: agent.id, model: result.model, creditsUsed: credits } }),
        db.agentRun.update({ where: { id: run.id }, data: { status: "DONE", finishedAt: new Date(), output: `v${number}`, ...usage } }),
      ]);
      opts.onEvent?.({ type: "done", mode: "rewrite", versionNumber: number, html, creditsUsed: credits });
      return { mode: "rewrite" as const, html, versionNumber: number, credits };
    }

    await db.$transaction([
      db.message.create({ data: { projectId: project.id, role: "assistant", content: result.text, agentId: agent.id, model: result.model, creditsUsed: credits } }),
      db.agentRun.update({ where: { id: run.id }, data: { status: "DONE", finishedAt: new Date(), output: result.text, ...usage } }),
    ]);
    opts.onEvent?.({ type: "done", mode: "report", report: result.text, creditsUsed: credits });
    return { mode: "report" as const, report: result.text, credits };
  } catch (err) {
    const message = friendlyAiError(err);
    console.error("[agent run failed]", err instanceof Error ? err.message : err);
    // Provider failures are refunded in full. When the model answered but not in the required
    // format, the tokens were still paid for, so only half is refunded (prevents "free" runs).
    const malformed = err instanceof Error && /did not return/.test(err.message);
    const refund = malformed ? Math.floor(credits / 2) : credits;
    await refundCredits(opts.userId, refund, `refund:${agent.id}`, project.id, { purchased: Math.min(purchasedSpent, refund) });
    await db.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), output: message, creditsUsed: credits - refund } });
    opts.onEvent?.({ type: "error", message });
    throw err;
  }
}
