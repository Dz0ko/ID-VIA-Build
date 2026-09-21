import { NextResponse } from "next/server";
import { resolveCode, setAttributionCookie } from "@/lib/referrals";

/** Referral / affiliate landing: /r/<code>?to=/pricing. Sets the attribution cookie and redirects. */
export async function GET(req: Request, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const target = to && to.startsWith("/") ? to : "/signup";
  const ref = await resolveCode(code);
  if (ref) await setAttributionCookie(ref);
  return NextResponse.redirect(new URL(ref ? target : "/", url.origin));
}
