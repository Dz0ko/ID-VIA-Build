import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { WHOP_TOKEN_URL, WHOP_USERINFO_URL } from "@/lib/whop";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const verifier = store.get("whop_verifier")?.value;
  const expectedState = store.get("whop_state")?.value;
  store.delete("whop_verifier");
  store.delete("whop_state");

  if (!code || !state || !verifier || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=whop_state", req.url));
  }

  const redirectUri = `${process.env.APP_URL ?? url.origin}/api/auth/whop/callback`;
  const tokenRes = await fetch(WHOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.WHOP_APP_ID,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) {
    console.error("Whop token exchange failed", await tokenRes.text());
    return NextResponse.redirect(new URL("/login?error=whop_token", req.url));
  }
  const token = (await tokenRes.json()) as { access_token: string };

  const meRes = await fetch(WHOP_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) return NextResponse.redirect(new URL("/login?error=whop_userinfo", req.url));
  const me = (await meRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    preferred_username?: string;
    picture?: string;
  };

  const email = (me.email ?? `${me.sub}@users.whop.local`).toLowerCase();
  let user = await db.user.findFirst({ where: { OR: [{ whopUserId: me.sub }, { email }] } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: me.name ?? me.preferred_username ?? email.split("@")[0],
        avatarUrl: me.picture,
        whopUserId: me.sub,
        plan: "FREE",
        credits: PLANS.FREE.credits,
      },
    });
  } else if (!user.whopUserId) {
    user = await db.user.update({
      where: { id: user.id },
      data: { whopUserId: me.sub, avatarUrl: user.avatarUrl ?? me.picture },
    });
  }

  // If a membership already arrived via webhook for this Whop user, apply it.
  const active = await db.membership.findFirst({
    where: { userId: user.id, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  if (active && active.plan !== user.plan) {
    await db.user.update({ where: { id: user.id }, data: { plan: active.plan } });
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL("/app", req.url));
}
