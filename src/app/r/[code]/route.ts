import { NextResponse } from "next/server";
import { resolveCode, setAttributionCookie } from "@/lib/referrals";
import { safePath } from "@/lib/security";

/**
 * Referral / affiliate landing: /r/<code>?to=/pricing. Sets the attribution cookie and
 * sends the visitor to the login page (which also offers sign-up). The attribution is
 * applied on sign-up, or on the next login of an account that has no affiliate yet.
 */
export async function GET(req: Request, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const target = safePath(to, "/login");
  // Only a real top-level navigation earns attribution; hidden <img src="/r/…"> embeds do not.
  const dest = req.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return NextResponse.redirect(new URL("/", url.origin));
  const ref = await resolveCode(code);
  if (ref) await setAttributionCookie(ref);
  return NextResponse.redirect(new URL(ref ? target : "/", url.origin));
}
