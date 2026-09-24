import { error, json, withUser } from "@/lib/api";
import { probeProviders, providerHealth } from "@/lib/provider-health";
import { dispatchEmails } from "@/lib/email-dispatch";

export const maxDuration = 60;

/** Current AI provider account status for the admin banner and the Platform errors page. */
export async function GET() {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    return json({ providers: await providerHealth(), checkedAt: new Date().toISOString() });
  });
}

/** "Check providers now": one minimal request per provider, clearing a stale alert after a top-up. */
export async function POST() {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const providers = await probeProviders();
    dispatchEmails();
    return json({ providers, checkedAt: new Date().toISOString() });
  });
}
