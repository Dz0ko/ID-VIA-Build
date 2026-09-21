import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CREDIT_PACKS } from "@/lib/plans";
import { createPackCheckout, whopApiConfigured } from "@/lib/whop";
import { rateLimit } from "@/lib/security";

/** Sends the user to a one-time Whop checkout for a credit pack. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const credits = Number(url.searchParams.get("credits") ?? 0);
  if (!CREDIT_PACKS.some((c) => c.credits === credits)) return NextResponse.redirect(new URL("/pricing", req.url));
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/signup?next=/api/billing/pack?credits=${credits}`, req.url));
  if (user.plan === "FREE") return NextResponse.redirect(new URL("/app/settings?error=pack_needs_plan", req.url));
  if (!whopApiConfigured()) return NextResponse.redirect(new URL("/app/settings?error=checkout_not_configured&plan=PACK", req.url));
  const limited = await rateLimit(`checkout:user:${user.id}`, 20, 3600);
  if (limited) return limited;
  try {
    const appUrl = process.env.APP_URL ?? url.origin;
    const { url: target } = await createPackCheckout({ credits, userId: user.id, email: user.email, appUrl });
    return NextResponse.redirect(target);
  } catch (e) {
    console.error("[whop pack checkout]", e instanceof Error ? e.message : e);
    return NextResponse.redirect(new URL("/app/settings?error=checkout_failed&plan=PACK", req.url));
  }
}
