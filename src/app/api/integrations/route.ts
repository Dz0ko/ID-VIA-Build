import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { PROVIDER_INFO, isProvider, listIntegrations, saveIntegration } from "@/lib/integrations";
import { oauthConfigured } from "@/lib/oauth";
import { rateLimit } from "@/lib/security";

/** Connected services (never returns secrets). */
export async function GET() {
  return withUser(async (user) => json({ integrations: await listIntegrations(user.id), providers: PROVIDER_INFO, githubOAuth: oauthConfigured("github") }));
}

const schema = z.object({ provider: z.string(), secret: z.record(z.string(), z.string().max(1000)) });

/** Save (and verify) credentials for a provider. */
export async function PUT(req: Request) {
  return withUser(async (user) => {
    const limited = await rateLimit(`integrations:${user.id}`, 30, 3600);
    if (limited) return limited;
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success || !isProvider(body.data.provider)) return error("Invalid input.");
    try {
      const row = await saveIntegration(user.id, body.data.provider, body.data.secret);
      return json({ ok: true, provider: row.provider, label: row.label });
    } catch (e) {
      return error(e instanceof Error ? e.message : "Could not verify the credentials.", 400);
    }
  });
}

export async function DELETE(req: Request) {
  return withUser(async (user) => {
    const body = z.object({ provider: z.string() }).safeParse(await req.json().catch(() => null));
    if (!body.success || !isProvider(body.data.provider)) return error("Invalid input.");
    await db.integration.deleteMany({ where: { userId: user.id, provider: body.data.provider } });
    return json({ ok: true });
  });
}
