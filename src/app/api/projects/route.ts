import { z } from "zod";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);
import { db } from "@/lib/db";
import { error, json, slugify, withUser } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { planAtLeast } from "@/lib/agents";
import { renderTemplate, TEMPLATE_MAP } from "@/lib/templates";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  templateId: z.string().optional(),
  kind: z.enum(["website", "saas", "dashboard", "app"]).optional(),
});

export async function GET() {
  return withUser(async (user) => {
    const projects = await db.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, slug: true, status: true, kind: true, updatedAt: true, publishedAt: true, description: true },
    });
    return json({ projects });
  });
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = createSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    if (body.data.kind === "app" && !planAtLeast(user.plan, "PRO"))
      return error("React app projects with a live sandbox are available from the Pro plan.", 403, { code: "PLAN", minPlan: "PRO" });
    let html = "";
    let templateId: string | undefined;
    if (body.data.templateId && TEMPLATE_MAP.has(body.data.templateId)) {
      html = renderTemplate(body.data.templateId) ?? "";
      templateId = body.data.templateId;
    }
    const slug = `${slugify(body.data.name)}-${nanoid()}`;
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      const limit = PLANS[user.plan].projectLimit;
      const count = await tx.project.count({ where: { userId: user.id } });
      if (limit !== "unlimited" && count >= limit)
        return error(`Your ${PLANS[user.plan].name} plan allows ${limit} projects. Upgrade to create more.`, 403, { code: "PROJECT_LIMIT" });

      const project = await tx.project.create({
        data: {
          userId: user.id,
          name: body.data.name,
          description: body.data.description,
          kind: body.data.kind ?? "website",
          slug,
          html,
          templateId,
        },
      });
      if (html) {
        await tx.version.create({ data: { projectId: project.id, number: 1, html, message: `Template: ${TEMPLATE_MAP.get(templateId!)?.name}` } });
      }
      return json({ project });
    });
  });
}
