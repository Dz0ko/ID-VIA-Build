import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isPlanId } from "@/lib/plans";
import { checkoutUrl } from "@/lib/whop";

/** Redirects to the Whop checkout for a plan. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const plan = url.searchParams.get("plan") ?? "";
  if (!isPlanId(plan) || plan === "FREE") return NextResponse.redirect(new URL("/pricing", req.url));
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/signup?next=/api/billing/checkout?plan=${plan}`, req.url));
  const target = checkoutUrl(plan);
  if (!target) return NextResponse.redirect(new URL(`/app/settings?error=checkout_not_configured&plan=${plan}`, req.url));
  const u = new URL(target);
  // Whop passes metadata through to webhooks; include our user id + email for matching.
  u.searchParams.set("metadata[idaevia_user_id]", user.id);
  if (user.email) u.searchParams.set("email", user.email);
  return NextResponse.redirect(u);
}
