import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { PlanId } from "./plans";
import { isPlanId } from "./plans";
import { renewalBalance } from "./credits";

const COOKIE = "idaevia_session";
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s.length < 32 || s === "dev-secret-change-me")) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters in production.");
  }
  return new TextEncoder().encode(s ?? "dev-secret-change-me");
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  plan: PlanId;
  credits: number;
  /** Bought as packs (or earned as bonuses); never expires at renewal. */
  purchasedCredits: number;
  creditsResetAt: Date;
  createdAt: Date;
  whopUserId: string | null;
  /** Linked sign-in methods. */
  providers: { google: boolean; github: boolean; password: boolean };
};

/** Returns the current user, refreshing the monthly credit allowance if due. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  let user = await db.user.findUnique({ where: { id } });
  if (!user) return null;

  // Monthly credit reset (simple calendar-month cycle from last reset)
  const next = new Date(user.creditsResetAt);
  next.setMonth(next.getMonth() + 1);
  if (new Date() >= next) {
    const r = renewalBalance(user);
    const before = user.credits;
    // Conditional update: concurrent requests (layout + page) renew at most once.
    const done = await db.user.updateMany({
      where: { id, creditsResetAt: user.creditsResetAt },
      data: { credits: r.next, purchasedCredits: r.purchased, creditsResetAt: new Date() },
    });
    if (done.count === 1) {
      await db.creditLedger.create({
        data: { userId: id, delta: r.next - before, reason: `renewal:${r.plan.id}${r.rollover ? `+rollover:${r.rollover}` : ""}` },
      });
    }
    user = await db.user.findUniqueOrThrow({ where: { id } });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    plan: isPlanId(user.plan) ? user.plan : "FREE",
    credits: user.credits,
    purchasedCredits: Math.min(user.purchasedCredits, user.credits),
    creditsResetAt: user.creditsResetAt,
    createdAt: user.createdAt,
    whopUserId: user.whopUserId,
    providers: { google: Boolean(user.googleId), github: Boolean(user.githubId), password: Boolean(user.passwordHash) },
  };
}

/** For server components: redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login?next=/app");
  return u;
}

export class AuthError extends Error {}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}
