import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { agentSchema } from "@/lib/custom-agent-schema";

export async function PATCH(req: Request, ctx: RouteContext<"/api/custom-agents/[id]">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const body = agentSchema.partial().safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    const existing = await db.customAgent.findFirst({ where: { id, userId: user.id } });
    if (!existing) return error("Not found", 404);
    const agent = await db.customAgent.update({ where: { id }, data: body.data });
    return json({ agent });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/custom-agents/[id]">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    await db.customAgent.deleteMany({ where: { id, userId: user.id } });
    return json({ ok: true });
  });
}
