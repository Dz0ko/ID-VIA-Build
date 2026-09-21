import { json, withUser } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { providerStatus } from "@/lib/ai/router";

export async function GET() {
  return withUser(async (user) =>
    json({ user, plan: PLANS[user.plan], providers: providerStatus() }),
  );
}
