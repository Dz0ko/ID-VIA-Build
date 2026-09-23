import { readRequestJson } from "@/lib/request-body";
import { z } from "zod";
import { error, json, withUser } from "@/lib/api";
import { rateLimit } from "@/lib/security";
import { sendSupport, supportSnapshot, SupportError } from "@/lib/support";

export const maxDuration = 60;
const input = z.object({ asManager: z.boolean().optional(), clientId: z.string().uuid(), message: z.string().trim().max(4000).optional(), action: z.enum(["message", "handoff", "claim", "close"]).optional() });
export async function GET(req: Request, ctx: RouteContext<"/api/support/[id]">) {
  return withUser(async user => {
    try { return json(await supportSnapshot((await ctx.params).id, user, new URL(req.url).searchParams.get("before") ?? undefined)); }
    catch (e) { if (e instanceof SupportError) return error(e.message, e.status); throw e; }
  });
}
export async function POST(req: Request, ctx: RouteContext<"/api/support/[id]">) {
  return withUser(async user => {
    const parsed = input.safeParse(await readRequestJson(req, 32768).catch(() => null));
    if (!parsed.success) return error("Write a message of up to 4,000 characters.");
    const limited = await rateLimit(`support:send:${user.id}`, user.role === "ADMIN" ? 300 : 120, 600);
    if (limited) return limited;
    try { return json(await sendSupport((await ctx.params).id, user, parsed.data)); }
    catch (e) { if (e instanceof SupportError) return error(e.message, e.status); throw e; }
  });
}
