import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { rateLimit } from "@/lib/security";
import { readRequestJson } from "@/lib/request-body";
import { recordPlatformError } from "@/lib/platform-errors";

const input = z.object({ message: z.string().min(1).max(2000), stack: z.string().max(4000).optional(), path: z.string().max(200) });
export async function POST(req: Request) {
  return withUser(async user => {
    const limited = await rateLimit(`monitoring:browser:${user.id}`, 12, 600);
    if (limited) return limited;
    const body = input.safeParse(await readRequestJson(req, 10000).catch(() => null));
    if (!body.success) return error("Invalid report.");
    const path = body.data.path.split(/[?#]/)[0];
    if (!/^\/(app|admin)(?:\/|$)/.test(path)) return error("Invalid screen.");
    const projectId = path.match(/^\/app\/projects\/([a-z0-9_-]+)$/i)?.[1];
    if (projectId && !await db.project.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } })) return error("Not found", 404);
    const reported = new Error(body.data.message);
    reported.stack = body.data.stack;
    // Cancelled requests (navigation, unmount, closed tab) are not interface failures; older clients still send them.
    if (/\baborted\b|AbortError/i.test(reported.message)) return json({ ok: true, ignored: true });
    await recordPlatformError(reported, { source: "browser", userId: user.id, projectId, route: path });
    return json({ ok: true });
  });
}
