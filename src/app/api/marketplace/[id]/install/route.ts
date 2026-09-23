import { customAlphabet } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, slugify, withUser } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { customAgentsAllowed } from "@/lib/agents-runtime";
import { agentSchema } from "@/lib/custom-agent-schema";
import { safeProjectPath } from "@/lib/import";
import { rateLimit } from "@/lib/security";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);
const filesSchema = z.array(z.object({ path: z.string().max(200), content: z.string().max(300_000) })).min(1).max(80);

/** Buyer access, quota, copied files, version and install count commit together. */
export async function POST(_req: Request, ctx: RouteContext<"/api/marketplace/[id]/install">) {
  const { id } = await ctx.params;
  return withUser(async (user) => {
    const limited = await rateLimit(`install:user:${user.id}`, 30, 3600);
    if (limited) return limited;
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      const item = await tx.marketItem.findUnique({ where: { id } });
      if (!item) return error("Item not found", 404);
      const owner = item.authorId === user.id;
      const bought = Boolean(await tx.purchase.findFirst({ where: { buyerId: user.id, itemId: id, status: "PAID" }, select: { id: true } }));
      if (!item.published && !owner && !bought) return error("Item not found", 404);
      if (item.price > 0 && !owner && !bought) return error("Buy this item to unlock it.", 402, { code: "PAID" });
      let payload: Record<string, unknown>;
      try { payload = JSON.parse(item.payload); if (!payload || typeof payload !== "object") throw new Error(); }
      catch { return error("This item has an invalid payload.", 422); }
      let result: Record<string, unknown>;
      if (item.type === "template") {
        const limit = PLANS[user.plan].projectLimit;
        if (limit !== "unlimited" && (await tx.project.count({ where: { userId: user.id } })) >= limit) return error("Project limit reached for your plan.", 403, { code: "PROJECT_LIMIT" });
        const base = { userId: user.id, name: item.title, slug: `${slugify(item.title)}-${nanoid()}`, description: `From marketplace: ${item.title}` };
        if (payload.kind === "app") {
          const parsed = filesSchema.safeParse(payload.files);
          if (!parsed.success) return error("This item is not a valid app template.", 422);
          const files = parsed.data.map((f) => ({ path: safeProjectPath(f.path), content: f.content }));
          if (files.some((f) => !f.path) || new Set(files.map((f) => f.path)).size !== files.length || files.reduce((n, f) => n + f.content.length, 0) > 2_000_000) return error("This template contains invalid, duplicate or oversized files.", 422);
          // Only the selected stack is copied, never the seller's memory, credentials or integrations.
          const stack = typeof payload.stack === "string" ? payload.stack.slice(0, 500) : files.some((f) => f.path === "/App.tsx") ? "React + TypeScript" : "Custom";
          const project = await tx.project.create({ data: { ...base, kind: "app", memory: JSON.stringify({ stack }), files: { create: files.map((f) => ({ path: f.path!, content: f.content })) }, versions: { create: { number: 1, html: JSON.stringify(files), message: `Marketplace: ${item.title}` } } } });
          result = { kind: "project", projectId: project.id };
        } else {
          if (typeof payload.html !== "string" || !payload.html.trim() || payload.html.length > 2_000_000) return error("This item is not a valid website template.", 422);
          const project = await tx.project.create({ data: { ...base, html: payload.html, versions: { create: { number: 1, html: payload.html, message: `Marketplace: ${item.title}` } } } });
          result = { kind: "project", projectId: project.id };
        }
      } else if (item.type === "agent") {
        if (!customAgentsAllowed(user.plan)) return error("Custom agents are available on the Agency plan.", 403, { code: "PLAN", minPlan: "AGENCY" });
        const parsed = agentSchema.safeParse(payload.agent);
        if (!parsed.success) return error("This item is not a valid agent.", 422);
        const agent = await tx.customAgent.create({ data: { ...parsed.data, userId: user.id, isPublic: false } });
        result = { kind: "agent", agentId: agent.id };
      } else {
        if (typeof payload.prompt !== "string" || payload.prompt.length > 8000) return error("This item is not a valid prompt.", 422);
        result = { kind: "prompt", prompt: payload.prompt };
      }
      if (!owner && !bought) {
        const first = await tx.setting.createMany({ data: [{ key: `market-install:${id}:${user.id}`, value: "true" }], skipDuplicates: true });
        if (first.count) await tx.marketItem.update({ where: { id }, data: { installs: { increment: 1 } } });
      }
      return json(result);
    });
  });
}
