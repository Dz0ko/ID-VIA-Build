import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { customAgentsAllowed, listCustomAgentsFor } from "@/lib/agents-runtime";
import { agentSchema } from "@/lib/custom-agent-schema";

export async function GET() {
  return withUser(async (user) => json({ agents: await listCustomAgentsFor(user.id), allowed: customAgentsAllowed(user.plan) }));
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    if (!customAgentsAllowed(user.plan)) return error("Custom agents are available on the Agency plan.", 403, { code: "PLAN", minPlan: "AGENCY" });
    const body = agentSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input: name (2+) and system prompt (20+ chars) are required.");
    const count = await db.customAgent.count({ where: { userId: user.id } });
    if (count >= 50) return error("Custom agent limit reached (50).");
    const agent = await db.customAgent.create({ data: { userId: user.id, ...body.data } });
    return json({ agent });
  });
}
