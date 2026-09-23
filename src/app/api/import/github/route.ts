import { rateLimit } from "@/lib/security";
import { z } from "zod";
import { error, json, withUser } from "@/lib/api";
import { fetchGithubArchive } from "@/lib/import";
import { createImportedProject } from "@/lib/import-project";
export async function POST(req: Request) {
  return withUser(async user => {
    if (user.plan === "FREE") return error("GitHub import is available from Starter.", 403);
    const limited = await rateLimit(`import:${user.id}`, 12, 60); if (limited) return limited;
    const body = z.object({ repoUrl: z.string().url(), name: z.string().max(80).optional() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Enter a valid GitHub URL.");
    try {
      const source = await fetchGithubArchive(body.data.repoUrl);
      const project = await createImportedProject(user, { ...source, name: body.data.name || source.repo.split("/")[1], description: `Imported from GitHub ${source.repo}`, memory: { stack: source.stack, importWarnings: source.warnings } });
      return json({ project, warnings: source.warnings });
    } catch (e) { return error(e instanceof Error ? e.message : "Could not import repository.", 422); }
  });
}
