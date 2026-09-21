import { db } from "./db";
import { PLANS } from "./plans";
import { applyAttributionOnLogin, applyReferralOnSignup } from "./referrals";

/**
 * Social sign-in (Google, GitHub). Whop is deliberately NOT a login provider:
 * it is the payment processor only (checkout links + webhooks in ./whop.ts).
 */
export type OAuthProvider = "google" | "github";
export const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "github"];

export function isOAuthProvider(v: string): v is OAuthProvider {
  return (OAUTH_PROVIDERS as string[]).includes(v);
}

interface ProviderConfig {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  extraAuthParams?: Record<string, string>;
}

const CONFIG: Record<OAuthProvider, ProviderConfig> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    extraAuthParams: { access_type: "online", prompt: "select_account" },
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
  },
};

export function oauthConfigured(p: OAuthProvider) {
  return Boolean(CONFIG[p].clientId && CONFIG[p].clientSecret);
}

/** Which social providers can be shown on the login page. */
export function oauthProviders(): Record<OAuthProvider, boolean> {
  return { google: oauthConfigured("google"), github: oauthConfigured("github") };
}

export function redirectUri(p: OAuthProvider, origin: string) {
  return `${process.env.APP_URL ?? origin}/api/auth/${p}/callback`;
}

export function authorizeUrl(p: OAuthProvider, opts: { state: string; origin: string }) {
  const c = CONFIG[p];
  const url = new URL(c.authorizeUrl);
  url.searchParams.set("client_id", c.clientId!);
  url.searchParams.set("redirect_uri", redirectUri(p, opts.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", c.scope);
  url.searchParams.set("state", opts.state);
  for (const [k, v] of Object.entries(c.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url;
}

export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/** Exchange the code for a token and fetch a normalised profile. */
export async function fetchProfile(p: OAuthProvider, code: string, origin: string): Promise<OAuthProfile> {
  const c = CONFIG[p];
  const tokenRes = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: c.clientId!,
      client_secret: c.clientSecret!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(p, origin),
    }),
  });
  if (!tokenRes.ok) throw new Error(`${p} token exchange failed: ${await tokenRes.text()}`);
  const token = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!token.access_token) throw new Error(`${p} token exchange failed: ${token.error ?? "no access_token"}`);
  const auth = { Authorization: `Bearer ${token.access_token}`, Accept: "application/json", "User-Agent": "idaevia-build" };

  if (p === "google") {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: auth });
    if (!res.ok) throw new Error("google userinfo failed");
    const me = (await res.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (!me.email || me.email_verified === false) throw new Error("google account has no verified email");
    return { providerId: me.sub, email: me.email, name: me.name ?? null, avatarUrl: me.picture ?? null };
  }

  const res = await fetch("https://api.github.com/user", { headers: auth });
  if (!res.ok) throw new Error("github user failed");
  const me = (await res.json()) as { id: number; login: string; name?: string | null; email?: string | null; avatar_url?: string };
  let email = me.email ?? null;
  if (!email) {
    const er = await fetch("https://api.github.com/user/emails", { headers: auth });
    if (er.ok) {
      const emails = (await er.json()) as { email: string; primary: boolean; verified: boolean }[];
      email = (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))?.email ?? null;
    }
  }
  if (!email) throw new Error("github account has no verified email");
  return { providerId: String(me.id), email, name: me.name ?? me.login, avatarUrl: me.avatar_url ?? null };
}

/** Find-or-create the local user for a social profile and link the provider id. */
export async function upsertOAuthUser(p: OAuthProvider, profile: OAuthProfile) {
  const email = profile.email.toLowerCase();
  const idField = p === "google" ? "googleId" : "githubId";
  let user = await db.user.findFirst({ where: { OR: [{ [idField]: profile.providerId }, { email }] } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: profile.name ?? email.split("@")[0],
        avatarUrl: profile.avatarUrl,
        [idField]: profile.providerId,
        plan: "FREE",
        credits: PLANS.FREE.credits,
      },
    });
    await db.creditLedger.create({ data: { userId: user.id, delta: PLANS.FREE.credits, reason: "signup" } });
    await applyReferralOnSignup(user.id);
  } else {
    if (user[idField] !== profile.providerId || (!user.avatarUrl && profile.avatarUrl)) {
      user = await db.user.update({
        where: { id: user.id },
        data: { [idField]: profile.providerId, avatarUrl: user.avatarUrl ?? profile.avatarUrl, name: user.name ?? profile.name },
      });
    }
    await applyAttributionOnLogin(user.id);
  }
  return user;
}
