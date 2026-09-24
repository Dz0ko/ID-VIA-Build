import { recordPlatformError } from "@/lib/platform-errors";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isPlanId } from "@/lib/plans";
import { checkoutUrl, createPlanCheckout, whopApiConfigured } from "@/lib/whop";
import { rateLimit } from "@/lib/security";

/**
 * Sends the user to a Whop checkout for a plan.
 * Preferred path: create the checkout through the Whop API (no dashboard products needed).
 * Fallback: a static checkout link from WHOP_CHECKOUT_<PLAN>.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const plan = url.searchParams.get("plan") ?? "";
  if (!isPlanId(plan) || plan === "FREE") return NextResponse.redirect(new URL("/pricing", req.url));
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/signup?next=/api/billing/checkout?plan=${plan}`, req.url));
  if (user.plan === plan) return NextResponse.redirect(new URL("/app/settings", req.url));

  if (whopApiConfigured()) {
    const limited = await rateLimit(`checkout:user:${user.id}`, 20, 3600);
    if (limited) return limited;
    try {
      const appUrl = process.env.APP_URL ?? url.origin;
      const { url: target } = await createPlanCheckout({ plan, userId: user.id, email: user.email, appUrl });
      return NextResponse.redirect(target);
    } catch (e) {
      await recordPlatformError(e, { source: "billing.checkout", userId: user.id });
      return NextResponse.redirect(new URL(`/app/settings?error=checkout_failed&plan=${plan}`, req.url));
    }
  }

  const target = checkoutUrl(plan);
  if (!target) return NextResponse.redirect(new URL(`/app/settings?error=checkout_not_configured&plan=${plan}`, req.url));
  const u = new URL(target);
  u.searchParams.set("metadata[idaevia_user_id]", user.id);
  u.searchParams.set("metadata[idaevia_plan]", plan);
  if (user.email) u.searchParams.set("email", user.email);
  return NextResponse.redirect(u);
}
