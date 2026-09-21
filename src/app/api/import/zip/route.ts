import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { error, json, slugify, withUser } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { readZip } from "@/lib/import";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

/** Import a ZIP: static site (index.html) or React source files (becomes an app project). */
export async function POST(req: Request) {
  return withUser(async (user) => {
    if (user.plan === "FREE") return error("ZIP import is available from the Starter plan.", 403, { code: "PLAN", minPlan: "STARTER" });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return error("Upload a .zip file.");
    if (file.size > 25 * 1024 * 1024) return error("ZIP is too large (max 25 MB).");
    const limit = PLANS[user.plan].projectLimit;
    if (limit !== "unlimited" && (await db.project.count({ where: { userId: user.id } })) >= limit)
      return error("Project limit reached for your plan.", 403, { code: "PROJECT_LIMIT" });

    const { html, files } = await readZip(await file.arrayBuffer());
    const name = String(form?.get("name") || file.name.replace(/\.zip$/i, "")).slice(0, 80);
    const hasApp = files.some((f) => /^\/App\.(tsx|jsx)$/.test(f.path));
    if (!html && !hasApp) return error("ZIP must contain an index.html or a React project with src/App.tsx.", 422);

    if (hasApp) {
      const project = await db.project.create({ data: { userId: user.id, name, kind: "app", slug: `${slugify(name)}-${nanoid()}`, description: `Imported from ${file.name}` } });
      const normalised = files.map((f) => ({ path: f.path.replace(/^\/App\.jsx$/, "/App.tsx"), content: f.content }));
      await db.$transaction([
        ...normalised.map((f) => db.projectFile.create({ data: { projectId: project.id, path: f.path, content: f.content } })),
        db.version.create({ data: { projectId: project.id, number: 1, html: JSON.stringify(normalised), message: `Imported ${file.name}` } }),
      ]);
      return json({ project });
    }
    const project = await db.project.create({ data: { userId: user.id, name, slug: `${slugify(name)}-${nanoid()}`, description: `Imported from ${file.name}`, html: html! } });
    await db.version.create({ data: { projectId: project.id, number: 1, html: html!, message: `Imported ${file.name}` } });
    return json({ project });
  });
}
