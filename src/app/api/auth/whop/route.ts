import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { WHOP_AUTHORIZE_URL, whopConfigured } from "@/lib/whop";

/** Start "Sign in with Whop" (OAuth 2.0 + PKCE). */
export async function GET(req: Request) {
  if (!whopConfigured()) {
    return NextResponse.redirect(new URL("/login?error=whop_not_configured", req.url));
  }
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  store.set("whop_verifier", verifier, opts);
  store.set("whop_state", state, opts);

  const redirectUri = `${process.env.APP_URL ?? new URL(req.url).origin}/api/auth/whop/callback`;
  const url = new URL(WHOP_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.WHOP_APP_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(url);
}
