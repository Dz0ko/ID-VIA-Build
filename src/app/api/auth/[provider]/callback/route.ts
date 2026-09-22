import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { fetchProfile, isOAuthProvider, upsertOAuthUser } from "@/lib/oauth";
import { safePath } from "@/lib/security";

export async function GET(req: Request, ctx: RouteContext<"/api/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  if (!isOAuthProvider(provider)) return NextResponse.redirect(new URL("/login?error=unknown_provider", url.origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get("oauth_state")?.value;
  const next = safePath(store.get("oauth_next")?.value, "/app");
  store.delete("oauth_state");
  store.delete("oauth_next");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`/login?error=${provider}_state`, url.origin));
  }

  try {
    const profile = await fetchProfile(provider, code, url.origin);
    const user = await upsertOAuthUser(provider, profile);
    await createSession(user.id);
    const target = new URL(next, url.origin);
    if (user.created) target.searchParams.set("welcome", "1");
    return NextResponse.redirect(target);
  } catch (e) {
    console.error(`[oauth:${provider}]`, e instanceof Error ? e.message : e);
    return NextResponse.redirect(new URL(`/login?error=${provider}_failed`, url.origin));
  }
}
