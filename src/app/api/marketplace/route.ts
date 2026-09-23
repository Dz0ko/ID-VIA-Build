import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { planAtLeast } from "@/lib/agents";
import { buildPreviewHtml, MARKETPLACE_MAX_PRICE_CENTS, MARKETPLACE_MIN_PRICE_CENTS, splitPrice } from "@/lib/marketplace";

/** Public catalogue. Never returns `payload`; `previewHtml` is served by the preview route. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const user = await getCurrentUser();
  const items = await db.marketItem.findMany({
    where: { published: true, ...(type ? { type } : {}) },
    orderBy: [{ sales: "desc" }, { installs: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: { id: true, type: true, title: true, description: true, category: true, price: true, authorId: true, authorName: true, installs: true, sales: true, createdAt: true, previewHtml: true, payload: true },
  });
  const purchased = user ? new Set((await db.purchase.findMany({ where: { buyerId: user.id, status: "PAID" }, select: { itemId: true } })).map((p) => p.itemId)) : new Set<string>();
  const filtered = q ? items.filter((i) => `${i.title} ${i.description} ${i.category} ${i.authorName}`.toLowerCase().includes(q)) : items;
  return json({
    items: filtered.map((i) => {
      let kind: "website" | "app" | null = null;
      let fileCount = 0;
      if (i.type === "template") {
        try {
          const p = JSON.parse(i.payload) as { kind?: string; files?: unknown[] };
          kind = p.kind === "app" ? "app" : "website";
          fileCount = Array.isArray(p.files) ? p.files.length : 0;
        } catch { /* ignore */ }
      }
      return {
        id: i.id, type: i.type, title: i.title, description: i.description, category: i.category, price: i.price, authorName: i.authorName,
        installs: i.installs, sales: i.sales, createdAt: i.createdAt, kind, fileCount,
        hasPreview: Boolean(i.previewHtml),
        mine: user ? i.authorId === user.id : false,
        purchased: purchased.has(i.id),
      };
    }),
  });
}

const schema = z.object({
  type: z.enum(["template", "prompt", "component", "agent"]),
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(600),
  category: z.string().max(40).default("General"),
  price: z.number().int().min(0).max(MARKETPLACE_MAX_PRICE_CENTS).default(0),
  projectId: z.string().optional(), // template: publish this project's html / files
  prompt: z.string().max(8000).optional(), // prompt / component
  customAgentId: z.string().optional(), // agent
});

/** Publish an item. Paid items keep their code private; only a script-free preview is public. */
export async function POST(req: Request) {
  return withUser(async (user) => {
    if (!planAtLeast(user.plan, "STARTER")) return error("Publishing to the marketplace requires the Starter plan or above.", 403, { code: "PLAN", minPlan: "STARTER" });
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input: title (3+) and description (10+) are required.");
    const d = body.data;
    if (d.price > 0 && d.price < MARKETPLACE_MIN_PRICE_CENTS) return error(`Paid items start at $${(MARKETPLACE_MIN_PRICE_CENTS / 100).toFixed(0)}. Set 0 for a free item.`);

    let payload: Record<string, unknown> = {};
    let previewHtml: string | null = null;
    if (d.type === "template") {
      const p = await db.project.findFirst({ where: { id: d.projectId ?? "", userId: user.id }, include: { files: true } });
      if (!p) return error("Choose one of your projects to publish.");
      if (p.kind === "app") {
        if (!p.files.length) return error("This app has no files yet.");
        const stack = (() => { try { return JSON.parse(p.memory).stack; } catch { return undefined; } })();
        payload = { kind: "app", ...(typeof stack === "string" ? { stack } : {}), files: p.files.map((f) => ({ path: f.path, content: f.content })) };
      } else {
        if (!p.html.trim()) return error("This project is empty. Build something first.");
        payload = { kind: "website", html: p.html };
        previewHtml = buildPreviewHtml(p.html);
      }
    } else if (d.type === "prompt" || d.type === "component") {
      if (!d.prompt) return error("Prompt text is required.");
      payload = { prompt: d.prompt };
    } else {
      const a = await db.customAgent.findFirst({ where: { id: d.customAgentId ?? "", userId: user.id } });
      if (!a) return error("Choose one of your custom agents to publish.");
      payload = { agent: { name: a.name, description: a.description, systemPrompt: a.systemPrompt, tier: a.tier, multiplier: a.multiplier, mode: a.mode } };
    }
    const item = await db.marketItem.create({
      data: { type: d.type, title: d.title, description: d.description, category: d.category, price: d.price, authorId: user.id, authorName: user.name ?? user.email.split("@")[0], payload: JSON.stringify(payload), previewHtml },
    });
    const { feeCents, sellerCents } = splitPrice(item.price);
    return json({ item: { id: item.id, title: item.title, price: item.price, feeCents, sellerCents } });
  });
}

export async function DELETE(req: Request) {
  return withUser(async (user) => {
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return error("id required");
    const where = user.role === "ADMIN" ? { id } : { id, authorId: user.id };
    // Preserve paid and in-flight orders; removing a listing never deletes purchases.
    await db.marketItem.updateMany({ where, data: { published: false } });
    return json({ ok: true });
  });
}
