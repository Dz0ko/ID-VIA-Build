import { NextResponse } from "next/server";
import { resolveCode, setAttributionCookie } from "@/lib/referrals";

/**
 * Referral / affiliate landing: /r/<code>?to=/pricing. Sets the attribution cookie and
 * sends the visitor to the login page (which also offers sign-up). The attribution is
 * applied on sign-up, or on the next login of an account that has no affiliate yet.
 */
export async function GET(req: Request, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const target = to && to.startsWith("/") ? to : "/login";
  const ref = await resolveCode(code);
  if (ref) await setAttributionCookie(ref);
  return NextResponse.redirect(new URL(ref ? target : "/", url.origin));
}
