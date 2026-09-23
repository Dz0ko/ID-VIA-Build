import "server-only";
import { customAlphabet } from "nanoid";
import { db } from "./db";
import { PLANS, type PlanId } from "./plans";
import { slugify } from "./api";
const suffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);
export async function createImportedProject(user: { id: string; plan: PlanId }, input: { name: string; description: string; html?: string | null; files?: { path: string; content: string }[]; memory?: Record<string, unknown> }) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const limit = PLANS[user.plan].projectLimit;
    if (limit !== "unlimited" && await tx.project.count({ where: { userId: user.id } }) >= limit) throw new Error("Project limit reached for your plan.");
    const name = input.name.trim().slice(0, 80) || "Imported project";
    const files = input.files ?? [];
    const project = await tx.project.create({ data: { userId: user.id, name, slug: `${slugify(name)}-${suffix()}`, kind: !input.html && files.length ? "app" : "website", html: input.html ?? "", description: input.description.slice(0, 500), memory: JSON.stringify(input.memory ?? {}), files: { create: files } }, select: { id: true, name: true, kind: true } });
    if (input.html || files.length) await tx.version.create({ data: { projectId: project.id, number: 1, html: input.html || JSON.stringify(files), message: "Imported source" } });
    return project;
  });
}
