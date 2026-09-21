import { z } from "zod";
import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { error, json, slugify, withUser } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { fetchUrlOutline, outlineToPrompt } from "@/lib/import";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);
const schema = z.object({ url: z.string().url(), name: z.string().max(80).optional(), extra: z.string().max(1000).optional() });

/** Analyse a public URL and create a project pre-loaded with a rebuild prompt. */
export async function POST(req: Request) {
  return withUser(async (user) => {
    if (user.plan === "FREE") return error("URL import is available from the Starter plan.", 403, { code: "PLAN", minPlan: "STARTER" });
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Enter a valid URL.");
    const limit = PLANS[user.plan].projectLimit;
    if (limit !== "unlimited" && (await db.project.count({ where: { userId: user.id } })) >= limit)
      return error("Project limit reached for your plan.", 403, { code: "PROJECT_LIMIT" });
    let outline;
    try {
      outline = await fetchUrlOutline(body.data.url);
    } catch (e) {
      return error(e instanceof Error ? e.message : "Could not fetch the URL.", 422);
    }
    const name = body.data.name || outline.title.slice(0, 60) || new URL(body.data.url).hostname;
    const prompt = outlineToPrompt(outline, body.data.extra);
    const project = await db.project.create({
      data: { userId: user.id, name, slug: `${slugify(name)}-${nanoid()}`, description: `Imported from ${body.data.url}`, memory: JSON.stringify({ reference: { url: outline.url, colors: outline.colors, fonts: outline.fonts, nav: outline.nav } }) },
    });
    return json({ project, prompt, outline });
  });
}
