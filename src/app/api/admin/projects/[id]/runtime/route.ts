import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/security";
import { readRequestJson } from "@/lib/request-body";
import { adminPreviewStatus, AdminPreviewError, startAdminPreview, stopAdminPreview } from "@/lib/admin-project-preview";
import { RuntimeCapacityError } from "@/lib/runtime-capacity";

export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store" };
async function access(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: "Not authenticated" }, { status: 401, headers }) };
  if (user.role !== "ADMIN") return { error: Response.json({ error: "Forbidden" }, { status: 403, headers }) };
  const project = await db.project.findUnique({ where: { id }, include: { files: true } });
  if (!project) return { error: Response.json({ error: "Project not found" }, { status: 404, headers }) };
  return { user, project };
}
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const result = await access((await ctx.params).id);
  if (result.error) return result.error;
  return Response.json(await adminPreviewStatus(result.user.id, result.project), { headers });
}
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const result = await access((await ctx.params).id);
  if (result.error) return result.error;
  const body = await readRequestJson(req, 1024).catch(() => null) as { action?: string } | null;
  if (body?.action !== "start" && body?.action !== "stop") return Response.json({ error: "Invalid action" }, { status: 400, headers });
  const limited = await rateLimit(`admin-preview:${result.user.id}`, 12, 60);
  if (limited) return limited;
  const message = (error: unknown) => error instanceof AdminPreviewError || error instanceof RuntimeCapacityError ? error.message : "Preview could not start. Check the runtime provider configuration or retry.";
  if (body.action === "stop") {
    try { await stopAdminPreview(result.user.id, result.project.id); return Response.json({ ok: true }, { headers }); }
    catch (error) { return Response.json({ error: message(error) }, { status: 409, headers }); }
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch { /* Disconnected viewer. */ } };
      try {
        const ready = await startAdminPreview(result.user.id, result.project, text => send({ type: "progress", message: text }), AbortSignal.any([req.signal, AbortSignal.timeout(270_000)]));
        send({ type: "ready", ...ready });
      } catch (error) { send({ type: "error", message: message(error) }); }
      finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { ...headers, "Content-Type": "text/event-stream", "X-Accel-Buffering": "no" } });
}
