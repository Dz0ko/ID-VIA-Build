import { rateLimit } from "@/lib/security";
import { z } from "zod";
import { error, json, withUser } from "@/lib/api";
import { fetchUrlOutline, outlineToPrompt } from "@/lib/import";
import { createImportedProject } from "@/lib/import-project";
export async function POST(req: Request) {
  return withUser(async user => {
    if (user.plan === "FREE") return error("URL import is available from Starter.", 403);
    const limited = await rateLimit(`import:${user.id}`, 12, 60); if (limited) return limited;
    const body = z.object({ url: z.string().url(), name: z.string().max(80).optional(), extra: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Enter a valid URL.");
    try {
      const outline = await fetchUrlOutline(body.data.url);
      const prompt = outlineToPrompt(outline, body.data.extra);
      const project = await createImportedProject(user, { name: body.data.name || outline.title.slice(0, 60) || new URL(body.data.url).hostname, description: `Reference: ${body.data.url}`, memory: { stack: "HTML + CSS + JavaScript", reference: { url: outline.url } } });
      return json({ project, prompt });
    } catch (e) { return error(e instanceof Error ? e.message : "Could not read website.", 422); }
  });
}
