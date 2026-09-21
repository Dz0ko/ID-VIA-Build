import { error, json, withUser } from "@/lib/api";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settings";
import { providerStatus } from "@/lib/ai/router";

export async function GET() {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    return json({ settings: await getSettings(), providers: providerStatus() });
  });
}

export async function PUT(req: Request) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const body = (await req.json().catch(() => null)) as AppSettings | null;
    if (!body || !body.tiers) return error("Invalid settings.");
    await saveSettings(body);
    return json({ ok: true });
  });
}
