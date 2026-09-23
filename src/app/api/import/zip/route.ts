import { rateLimit } from "@/lib/security";
import { error, json, withUser } from "@/lib/api";
import { readZip } from "@/lib/import";
import { createImportedProject } from "@/lib/import-project";
export async function POST(req: Request) {
  return withUser(async user => {
    if (user.plan === "FREE") return error("ZIP import is available from Starter.", 403);
    const limited = await rateLimit(`import:${user.id}`, 12, 60); if (limited) return limited;
    const form = await req.formData().catch(() => null); const file = form?.get("file");
    if (!(file instanceof File) || !/\.zip$/i.test(file.name)) return error("Upload a ZIP file.");
    if (file.size > 3 * 1024 * 1024) return error("ZIP is too large (max 3 MB).", 413);
    try {
      const source = await readZip(await file.arrayBuffer());
      const project = await createImportedProject(user, { ...source, name: String(form?.get("name") || file.name.replace(/\.zip$/i, "")), description: `Imported from ${file.name}`, memory: { stack: source.stack, importWarnings: source.warnings } });
      return json({ project, warnings: source.warnings });
    } catch (e) { return error(e instanceof Error ? e.message : "Could not import ZIP.", 422); }
  });
}
