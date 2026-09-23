import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { USER_HTML_HEADERS } from "@/lib/security";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const headers = { ...USER_HTML_HEADERS, "Cache-Control": "private, no-store" };
  if (!user) return new Response("Unauthorized", { status: 401, headers });
  if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403, headers });
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { html: true } });
  if (!project) return new Response("Not found", { status: 404, headers });
  return new Response(project.html || "<!doctype html><title>Empty project</title><p>No saved HTML yet.</p>", { headers });
}
