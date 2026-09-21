import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AGENTS, AGENT_TEAMS, agentsForPlan, minPlanForAgent } from "@/lib/agents";
import { PLANS, type PlanId } from "@/lib/plans";
import { providerStatus } from "@/lib/ai/router";
import { Workspace } from "@/components/app/Workspace";

export default async function ProjectPage({ params }: PageProps<"/app/projects/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    include: {
      versions: { orderBy: { number: "desc" }, select: { id: true, number: true, message: true, createdAt: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      agentRuns: { orderBy: { startedAt: "desc" }, take: 50 },
    },
  });
  if (!project) notFound();

  const agents = [...AGENTS].sort((a, b) => a.order - b.order);
  const minPlanByAgent = Object.fromEntries(agents.map((a) => [a.id, minPlanForAgent(a)])) as Record<string, PlanId>;
  const providers = providerStatus();

  return (
    <Suspense>
      <Workspace
        project={{
          ...project,
          versions: project.versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
          messages: project.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
          agentRuns: project.agentRuns.map((r) => ({ ...r, startedAt: r.startedAt.toISOString(), finishedAt: r.finishedAt?.toISOString() ?? null })),
        }}
        agents={agents}
        allowedAgentIds={agentsForPlan(user.plan).map((a) => a.id)}
        minPlanByAgent={minPlanByAgent}
        teams={AGENT_TEAMS}
        plan={user.plan}
        maxTier={PLANS[user.plan].maxTier}
        credits={user.credits}
        offline={!providers.anthropic && !providers.openai}
      />
    </Suspense>
  );
}
