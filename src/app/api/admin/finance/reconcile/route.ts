import { error, json, withUser } from "@/lib/api";
import { reconcileLegacyPayments } from "@/lib/reconcile-payments";
import { rateLimit } from "@/lib/security";
export const maxDuration = 60;
export async function POST() {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const limited = await rateLimit(`finance-reconcile:${user.id}`, 30, 3600);
    if (limited) return limited;
    return json(await reconcileLegacyPayments());
  });
}
