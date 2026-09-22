import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { authorizeUrl, oauthConfigured } from "@/lib/oauth";

/**
 * "Connect GitHub" for pushing code: same GitHub OAuth app as sign-in, but asking for the
 * `repo` scope. The callback (/api/auth/github/callback) sees oauth_mode=connect and stores
 * the token as an integration instead of signing in.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/app/integrations", url.origin));
  if (!oauthConfigured("github")) return NextResponse.redirect(new URL("/app/integrations?error=github_not_configured", url.origin));
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" };
  store.set("oauth_state", state, opts);
  store.set("oauth_next", "/app/integrations?connected=github", opts);
  store.set("oauth_mode", "connect", opts);
  return NextResponse.redirect(authorizeUrl("github", { state, origin: url.origin, scope: "repo read:user user:email" }));
}
