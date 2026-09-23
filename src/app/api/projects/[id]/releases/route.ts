import { withUser, json, error } from "@/lib/api";
import { db } from "@/lib/db";
import { projectReleases } from "@/lib/project-releases";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUser(async user => {
    if (!await db.project.findFirst({ where: { id, userId: user.id }, select: { id: true } })) return error("Not found", 404);
    return json({ releases: await projectReleases(id, user.id) });
  });
}
