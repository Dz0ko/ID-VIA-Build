import { getCurrentUser } from "@/lib/auth";
import { error } from "@/lib/api";
import { supportSnapshot, SupportError } from "@/lib/support";
import { rateLimit } from "@/lib/security";

export const maxDuration = 30;
export async function GET(req: Request, ctx: RouteContext<"/api/support/[id]/events">) {
  const user = await getCurrentUser();
  if (!user) return error("Not authenticated", 401);
  const limited = await rateLimit(`support:stream:${user.id}`, 60, 60);
  if (limited) return limited;
  const id = (await ctx.params).id;
  try { await supportSnapshot(id, user); } catch (e) { if (e instanceof SupportError) return error(e.message, e.status); throw e; }
  let stopped = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const until = Date.now() + 24000;
      let previous = "";
      const stop = () => { stopped = true; };
      req.signal.addEventListener("abort", stop, { once: true });
      try {
        while (!stopped && Date.now() < until) {
          // Revalidate authorization during an open stream, including admin demotion.
          const current = await getCurrentUser();
          if (!current || current.role !== user.role) break;
          const data = JSON.stringify(await supportSnapshot(id, user));
          if (stopped) break;
          if (data !== previous) { controller.enqueue(encoder.encode(`data: ${data}\n\n`)); previous = data; }
          else controller.enqueue(encoder.encode(": keep-alive\n\n"));
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch { /* EventSource reconnects; every reconnect checks authorization. */ }
      finally { req.signal.removeEventListener("abort", stop); if (!stopped) controller.close(); }
    },
    cancel() { stopped = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no" } });
}
