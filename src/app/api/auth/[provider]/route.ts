import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl, isOAuthProvider, oauthConfigured } from "@/lib/oauth";
import { safePath } from "@/lib/security";

/** Start "Continue with Google / GitHub". */
export async function GET(req: Request, ctx: RouteContext<"/api/auth/[provider]">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  if (!isOAuthProvider(provider)) return NextResponse.redirect(new URL("/login?error=unknown_provider", url.origin));
  if (!oauthConfigured(provider)) return NextResponse.redirect(new URL(`/login?error=${provider}_not_configured`, url.origin));

  const state = randomBytes(16).toString("hex");
  const next = safePath(url.searchParams.get("next"), "/app");
  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" };
  store.set("oauth_state", state, opts);
  store.set("oauth_next", next, opts);
  return NextResponse.redirect(authorizeUrl(provider, { state, origin: url.origin }));
}
