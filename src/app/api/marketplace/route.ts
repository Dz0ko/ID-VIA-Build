import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { planAtLeast } from "@/lib/agents";

export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type");
  const user = await getCurrentUser();
  const items = await db.marketItem.findMany({ where: { published: true, ...(type ? { type } : {}) }, orderBy: [{ installs: "desc" }, { createdAt: "desc" }], take: 200 });
  return json({ items: items.map((i) => ({ ...i, payload: undefined, mine: user ? i.authorId === user.id : false })) });
}

const schema = z.object({
  type: z.enum(["template", "prompt", "component", "agent"]),
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(600),
  category: z.string().max(40).default("General"),
  price: z.number().int().min(0).max(100000).default(0),
  projectId: z.string().optional(), // template: publish this project's html
  prompt: z.string().max(8000).optional(), // prompt / component
  customAgentId: z.string().optional(), // agent
});

/** Publish an item to the marketplace. */
export async function POST(req: Request) {
  return withUser(async (user) => {
    if (!planAtLeast(user.plan, "STARTER")) return error("Publishing to the marketplace requires the Starter plan or above.", 403, { code: "PLAN", minPlan: "STARTER" });
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input: title (3+) and description (10+) are required.");
    const d = body.data;
    let payload: Record<string, unknown> = {};
    if (d.type === "template") {
      const p = await db.project.findFirst({ where: { id: d.projectId ?? "", userId: user.id }, include: { files: true } });
      if (!p) return error("Choose one of your projects to publish as a template.");
      payload = p.kind === "app" ? { kind: "app", files: p.files.map((f) => ({ path: f.path, content: f.content })) } : { kind: "website", html: p.html };
    } else if (d.type === "prompt" || d.type === "component") {
      if (!d.prompt) return error("Prompt text is required.");
      payload = { prompt: d.prompt };
    } else {
      const a = await db.customAgent.findFirst({ where: { id: d.customAgentId ?? "", userId: user.id } });
      if (!a) return error("Choose one of your custom agents to publish.");
      payload = { agent: { name: a.name, description: a.description, systemPrompt: a.systemPrompt, tier: a.tier, multiplier: a.multiplier, mode: a.mode } };
    }
    const item = await db.marketItem.create({ data: { type: d.type, title: d.title, description: d.description, category: d.category, price: d.price, authorId: user.id, authorName: user.name ?? user.email.split("@")[0], payload: JSON.stringify(payload) } });
    return json({ item: { ...item, payload: undefined } });
  });
}

export async function DELETE(req: Request) {
  return withUser(async (user) => {
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return error("id required");
    const where = user.role === "ADMIN" ? { id } : { id, authorId: user.id };
    await db.marketItem.deleteMany({ where });
    return json({ ok: true });
  });
}
