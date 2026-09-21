import { db } from "./db";
import { AGENT_MAP, agentAllowed, minPlanForAgent, type AgentDef } from "./agents";
import type { ModelTier, PlanId } from "./plans";
import { planAtLeast } from "./agents";

export const CUSTOM_PREFIX = "custom:";
export const CUSTOM_AGENTS_MIN_PLAN: PlanId = "AGENCY";

/** Resolve a built-in or custom (custom:<id>) agent for a user. */
export async function resolveAgent(
  agentId: string,
  userId: string,
): Promise<{ agent: AgentDef; custom: boolean } | null> {
  if (agentId.startsWith(CUSTOM_PREFIX)) {
    const id = agentId.slice(CUSTOM_PREFIX.length);
    const row = await db.customAgent.findFirst({ where: { id, OR: [{ userId }, { isPublic: true }] } });
    if (!row) return null;
    return {
      custom: true,
      agent: {
        id: agentId,
        name: row.name,
        short: row.description.slice(0, 60) || "Custom agent",
        description: row.description,
        order: 999,
        tier: (row.tier as ModelTier) ?? "standard",
        multiplier: row.multiplier,
        mode: row.mode === "report" ? "report" : "rewrite",
        systemPrompt: row.systemPrompt,
        tags: ["custom"],
      },
    };
  }
  const agent = AGENT_MAP.get(agentId);
  return agent ? { agent, custom: false } : null;
}

export function customAgentsAllowed(plan: PlanId) {
  return planAtLeast(plan, CUSTOM_AGENTS_MIN_PLAN);
}

export async function listCustomAgentsFor(userId: string) {
  return db.customAgent.findMany({ where: { OR: [{ userId }, { isPublic: true }] }, orderBy: { createdAt: "desc" } });
}

export function checkAgentAccess(plan: PlanId, agentId: string, custom: boolean) {
  if (custom) return customAgentsAllowed(plan) ? null : { error: "Custom agents are available on the Agency plan.", minPlan: "AGENCY" as PlanId };
  if (!agentAllowed(plan, agentId)) {
    const a = AGENT_MAP.get(agentId)!;
    return { error: `${a.name} is available from the ${minPlanForAgent(a)} plan.`, minPlan: minPlanForAgent(a) };
  }
  return null;
}
