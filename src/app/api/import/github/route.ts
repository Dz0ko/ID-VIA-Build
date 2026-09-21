import { z } from "zod";
import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { error, json, slugify, withUser } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { fetchGithubIndex } from "@/lib/import";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);
const schema = z.object({ repoUrl: z.string().url(), name: z.string().max(80).optional() });

/** Import a static site (index.html) from a public GitHub repository. */
export async function POST(req: Request) {
  return withUser(async (user) => {
    if (user.plan === "FREE") return error("GitHub import is available from the Starter plan.", 403, { code: "PLAN", minPlan: "STARTER" });
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Enter a valid GitHub repository URL.");
    const limit = PLANS[user.plan].projectLimit;
    if (limit !== "unlimited" && (await db.project.count({ where: { userId: user.id } })) >= limit)
      return error("Project limit reached for your plan.", 403, { code: "PROJECT_LIMIT" });
    let found;
    try {
      found = await fetchGithubIndex(body.data.repoUrl);
    } catch (e) {
      return error(e instanceof Error ? e.message : "Import failed.", 422);
    }
    const name = body.data.name || found.repo.split("/")[1];
    const project = await db.project.create({
      data: { userId: user.id, name, slug: `${slugify(name)}-${nanoid()}`, description: `Imported from GitHub ${found.repo} (${found.path})`, html: found.html },
    });
    await db.version.create({ data: { projectId: project.id, number: 1, html: found.html, message: `Imported ${found.repo}/${found.path}` } });
    return json({ project });
  });
}
