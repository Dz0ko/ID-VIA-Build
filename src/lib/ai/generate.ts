import { db } from "../db";
import type { PlanId, ModelTier } from "../plans";
import { estimateCreditsDetailed, reserveCredits, finalizeCredits, releaseCredits } from "../credits";
import { TIER_LABELS } from "../plans";
import { resolveAgent } from "../agents-runtime";
import {
  APP_BUILDER_SYSTEM,
  BUILDER_SYSTEM,
  buildAppUserPrompt,
  buildUserPrompt,
  extractHtml,
  extractNote,
  parseFileManifest,
} from "./prompts";
import { identityPrompt, personaFor } from "../personas";
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
  /** Explicit model family for the tier: "openai" → GPT (e.g. GPT-6 Astra), "anthropic" → Claude. */
  preferProvider?: "anthropic" | "openai";
  images?: InputImage[];
  onEvent?: (e: RunEvent) => void;
  signal?: AbortSignal;
}

export type RunEvent =
  | { type: "meta"; agent: string; tier: ModelTier; model: string; provider: string; credits: number; taskClass: TaskClass; fallback: boolean }
  | { type: "picked"; agent: string }
  | { type: "agent"; agent: string; name: string; profession: string; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; mode: "rewrite" | "report"; versionNumber?: number; html?: string; files?: { path: string; content: string }[]; report?: string; creditsUsed: number; note?: string }
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

  const resolved = await resolveModel(tier, opts.preferProvider);
  const docTokens = Math.ceil((isApp ? project.files.reduce((n, f) => n + f.content.length, 0) : project.html.length) / 4);
  const est = await estimateCreditsDetailed({ taskClass, agentMultiplier: agent.multiplier * visionBump * (isApp ? 1.5 : 1), tier, model: resolved.config.model, docTokens, mode: agent.mode });
  const credits = est.credits;
  // Why this run costs what it costs: shown to the user in their credit log.
  const docKb = Math.round((docTokens * 4) / 1024);
  const CLASS_LABEL: Record<TaskClass, string> = { tiny: "small tweak", small: "small edit", section: "new section", page: "full page", feature: "feature build", fullstack: "full-stack feature" };
  const reasons: string[] = [`${agent.name} · ${agent.mode === "report" ? "report" : CLASS_LABEL[taskClass]}`, TIER_LABELS[tier]];
  if (tier === "frontier" || tier === "premium") reasons.push("deep reasoning model");
  if (agent.mode !== "report" && docKb > 0) reasons.push(`${docKb} KB document rewritten`);
  if (isApp) reasons.push("multi-file React app");
  if (opts.images?.length) reasons.push(`${opts.images.length} reference image${opts.images.length > 1 ? "s" : ""}`);
  if (agent.multiplier > 1) reasons.push(`specialist agent ×${agent.multiplier}`);
  const noteBase = reasons.join(" · ");
  const meta = { agent: agent.id, agentName: agent.name, taskClass, tier, model: resolved.config.model, docKb, images: opts.images?.length ?? 0, app: isApp, byClass: est.byClass, estimated: credits, k: est.k };
  // Hold a buffer for long/thinking-heavy answers; the unused part is released right after the run.
  const { purchasedSpent, ledgerId } = await reserveCredits(opts.userId, est.hold, `agent:${agent.id}`, project.id, `${noteBase} · running…`);
  // Cost controls: cap the output to what the task can need, and only spend deep thinking on big tasks.
  const heavy = taskClass === "fullstack" || taskClass === "feature" || taskClass === "page";
  const maxOutput = agent.mode === "report" ? Math.min(resolved.config.maxOutput, 8000) : Math.min(resolved.config.maxOutput, Math.max(12000, Math.ceil(docTokens * 1.6) + 6000));
  const EFFORT_RANK = { low: 0, medium: 1, high: 2, xhigh: 3, max: 4 } as const;
  const capEffort = heavy ? "xhigh" : taskClass === "section" ? "high" : "medium";
  const effort = resolved.config.effort && EFFORT_RANK[resolved.config.effort] > EFFORT_RANK[capEffort] ? capEffort : resolved.config.effort;

  const run = await db.agentRun.create({
    data: { userId: opts.userId, projectId: project.id, agentId: agent.id, status: "RUNNING", task: opts.request, model: resolved.config.model, creditsUsed: credits },
  });

  opts.onEvent?.({ type: "meta", agent: agent.id, tier, model: resolved.config.model, provider: resolved.provider.id, credits, taskClass, fallback: resolved.fallback });

  let memory: Record<string, unknown> = {};
  try { memory = JSON.parse(project.memory || "{}"); } catch { /* ignore */ }

  let system: string;
  let userPrompt: string;
  const identity = identityPrompt(agent.id, agent.name);
  if (agent.mode === "report") {
    system = `${identity}\n\n${agent.systemPrompt}`;
    const current = isApp
      ? project.files.map((f) => `<<<FILE ${f.path}>>>\n${f.content}\n<<<END>>>`).join("\n")
      : `<<<HTML\n${project.html}\nHTML>>>`;
    userPrompt = `PROJECT: ${project.name}\n${project.description ?? ""}\n\nCURRENT ${isApp ? "FILES" : "DOCUMENT"}:\n${current}\n\nREQUEST:\n${opts.request}`;
  } else if (isApp) {
    system = `${identity}\n\n${agent.id === "builder" ? APP_BUILDER_SYSTEM : `${APP_BUILDER_SYSTEM}\n\nSPECIALIST ROLE:\n${agent.systemPrompt}`}`;
    userPrompt = buildAppUserPrompt({ request: opts.request, files: project.files, memory });
  } else {
    system = `${identity}\n\n${agent.id === "builder" ? BUILDER_SYSTEM : agent.systemPrompt}`;
    userPrompt = buildUserPrompt({ request: opts.request, html: project.html, memory });
  }
  if (opts.images?.length) userPrompt += `\n\n(${opts.images.length} reference image(s) attached, recreate their design faithfully.)`;

  await db.message.create({
    data: { projectId: project.id, role: "user", content: opts.images?.length ? `${opts.request}\n[${opts.images.length} image(s) attached]` : opts.request, agentId: agent.id },
  });
  // The specialist introduces itself and says what it is about to do.
  const persona = personaFor(agent.id);
  const intro = persona.intro(opts.request);
  await db.message.create({ data: { projectId: project.id, role: "assistant", content: intro, agentId: agent.id } });
  opts.onEvent?.({ type: "agent", agent: agent.id, name: agent.name, profession: persona.profession, text: intro });

  try {
    const result = await generateWithFallback(resolved, {
      system,
      messages: [{ role: "user", content: userPrompt }],
      images: opts.images,
      maxOutput,
      effort,
      onText: (t) => opts.onEvent?.({ type: "delta", text: t }),
      signal: opts.signal,
    });
    const costUsd = resolved.provider.id === "mock" && !result.fellBack ? 0 : estimateUsd(result.model, result);
    // Profit guarantee: final charge = max(class price, real cost × creditsPerUsd); the rest of the hold is released.
    const outK = Math.round(result.outputTokens / 1000);
    const creditsCharged = await finalizeCredits({ userId: opts.userId, ledgerId, hold: est.hold, byClassCredits: credits, costUsd, k: est.k, purchasedHeld: purchasedSpent, note: `${noteBase} · ${outK}k tokens generated${result.fellBack ? " · provider fallback" : ""}`, meta: { ...meta, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: Number(costUsd.toFixed(4)) } });
    const usage = {
      model: result.model, // the model that actually answered (may differ after a provider fallback)
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd,
      creditsUsed: creditsCharged,
    };

    if (agent.mode === "rewrite" && isApp) {
      const files = parseFileManifest(result.text, project.files);
      if (!files.some((f) => f.path === "/App.tsx")) throw new Error("Model did not return /App.tsx.");
      const lastApp = await db.version.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" }, select: { number: true } });
      const noteApp = extractNote(result.text) ?? persona.done((lastApp?.number ?? 0) + 1);
      const last = await db.version.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
      const number = (last?.number ?? 0) + 1;
      await db.$transaction([
        db.projectFile.deleteMany({ where: { projectId: project.id } }),
        ...files.map((f) => db.projectFile.create({ data: { projectId: project.id, path: f.path, content: f.content } })),
        db.version.create({ data: { projectId: project.id, number, html: JSON.stringify(files), message: `${agent.name}: ${opts.request.slice(0, 120)}` } }),
        db.message.create({ data: { projectId: project.id, role: "assistant", content: noteApp, agentId: agent.id, model: result.model, creditsUsed: creditsCharged } }),
        db.agentRun.update({ where: { id: run.id }, data: { status: "DONE", finishedAt: new Date(), output: `v${number}`, ...usage } }),
      ]);
      opts.onEvent?.({ type: "done", mode: "rewrite", versionNumber: number, files, creditsUsed: creditsCharged, note: noteApp });
      return { mode: "rewrite" as const, files, versionNumber: number, credits: creditsCharged };
    }

    if (agent.mode === "rewrite") {
      const html = extractHtml(result.text);
      if (!/<html[\s>]/i.test(html)) throw new Error("Model did not return an HTML document.");
      const last = await db.version.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
      const number = (last?.number ?? 0) + 1;
      const noteHtml = extractNote(result.text) ?? persona.done(number);
      await db.$transaction([
        db.project.update({ where: { id: project.id }, data: { html } }),
        db.version.create({ data: { projectId: project.id, number, html, message: `${agent.name}: ${opts.request.slice(0, 120)}` } }),
        db.message.create({ data: { projectId: project.id, role: "assistant", content: noteHtml, agentId: agent.id, model: result.model, creditsUsed: creditsCharged } }),
        db.agentRun.update({ where: { id: run.id }, data: { status: "DONE", finishedAt: new Date(), output: `v${number}`, ...usage } }),
      ]);
      opts.onEvent?.({ type: "done", mode: "rewrite", versionNumber: number, html, creditsUsed: creditsCharged, note: noteHtml });
      return { mode: "rewrite" as const, html, versionNumber: number, credits: creditsCharged };
    }

    await db.$transaction([
      db.message.create({ data: { projectId: project.id, role: "assistant", content: result.text, agentId: agent.id, model: result.model, creditsUsed: creditsCharged } }),
      db.agentRun.update({ where: { id: run.id }, data: { status: "DONE", finishedAt: new Date(), output: result.text, ...usage } }),
    ]);
    opts.onEvent?.({ type: "done", mode: "report", report: result.text, creditsUsed: creditsCharged });
    return { mode: "report" as const, report: result.text, credits: creditsCharged };
  } catch (err) {
    const message = friendlyAiError(err);
    console.error("[agent run failed]", err instanceof Error ? err.message : err);
    // Provider failures are refunded in full. When the model answered but not in the required
    // format, the tokens were still paid for, so only half is refunded (prevents "free" runs).
    const malformed = err instanceof Error && /did not return/.test(err.message);
    const keep = malformed ? Math.ceil(credits / 2) : 0;
    await releaseCredits({ userId: opts.userId, ledgerId, hold: est.hold, keep, purchasedHeld: purchasedSpent, note: malformed ? `${noteBase} · output could not be applied, half refunded` : `${noteBase} · failed, fully refunded` });
    await db.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), output: message, creditsUsed: keep } });
    opts.onEvent?.({ type: "error", message });
    throw err;
  }
}
