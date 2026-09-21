import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { error, json, slugify, withUser } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { customAgentsAllowed } from "@/lib/agents-runtime";
import { hasPurchased } from "@/lib/marketplace";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

/**
 * Install a marketplace item: template → new project, agent → copy into my custom agents,
 * prompt/component → returned to the client. Paid items require a PAID purchase (Whop) or ownership.
 * Unpublished items stay installable for buyers who already paid.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/marketplace/[id]/install">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const item = await db.marketItem.findUnique({ where: { id } });
    if (!item) return error("Item not found", 404);
    const owner = item.authorId === user.id;
    const bought = item.price > 0 ? await hasPurchased(user.id, id) : false;
    if (!item.published && !owner && !bought) return error("Item not found", 404);
    if (item.price > 0 && !owner && !bought) return error("Buy this item to unlock it.", 402, { code: "PAID" });
    const payload = JSON.parse(item.payload) as Record<string, unknown>;
    if (!bought) await db.marketItem.update({ where: { id }, data: { installs: { increment: 1 } } });

    if (item.type === "template") {
      const limit = PLANS[user.plan].projectLimit;
      if (limit !== "unlimited" && (await db.project.count({ where: { userId: user.id } })) >= limit) return error("Project limit reached for your plan.", 403, { code: "PROJECT_LIMIT" });
      const name = item.title;
      if (payload.kind === "app") {
        const files = payload.files as { path: string; content: string }[];
        const project = await db.project.create({ data: { userId: user.id, name, kind: "app", slug: `${slugify(name)}-${nanoid()}`, description: `From marketplace: ${item.title}` } });
        await db.$transaction([
          ...files.map((f) => db.projectFile.create({ data: { projectId: project.id, path: f.path, content: f.content } })),
          db.version.create({ data: { projectId: project.id, number: 1, html: JSON.stringify(files), message: `Marketplace: ${item.title}` } }),
        ]);
        return json({ kind: "project", projectId: project.id });
      }
      const html = String(payload.html ?? "");
      const project = await db.project.create({ data: { userId: user.id, name, slug: `${slugify(name)}-${nanoid()}`, description: `From marketplace: ${item.title}`, html } });
      await db.version.create({ data: { projectId: project.id, number: 1, html, message: `Marketplace: ${item.title}` } });
      return json({ kind: "project", projectId: project.id });
    }
    if (item.type === "agent") {
      if (!customAgentsAllowed(user.plan)) return error("Custom agents are available on the Agency plan.", 403, { code: "PLAN", minPlan: "AGENCY" });
      const a = payload.agent as { name: string; description: string; systemPrompt: string; tier: string; multiplier: number; mode: string };
      const agent = await db.customAgent.create({ data: { userId: user.id, name: a.name, description: a.description, systemPrompt: a.systemPrompt, tier: a.tier, multiplier: a.multiplier, mode: a.mode } });
      return json({ kind: "agent", agentId: agent.id });
    }
    return json({ kind: "prompt", prompt: String(payload.prompt ?? "") });
  });
}
