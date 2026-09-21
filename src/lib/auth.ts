import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { PlanId } from "./plans";
import { PLANS, isPlanId } from "./plans";

const COOKIE = "idaevia_session";
const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me");

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
  creditsResetAt: Date;
  whopUserId: string | null;
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
    const plan = isPlanId(user.plan) ? user.plan : "FREE";
    const p = PLANS[plan];
    const rollover = Math.min(
      Math.max(user.credits, 0),
      Math.floor((p.credits * p.rolloverPct) / 100),
    );
    user = await db.user.update({
      where: { id },
      data: { credits: p.credits + rollover, creditsResetAt: new Date() },
    });
    await db.creditLedger.create({
      data: { userId: id, delta: p.credits + rollover, reason: "monthly_reset" },
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    plan: isPlanId(user.plan) ? user.plan : "FREE",
    credits: user.credits,
    creditsResetAt: user.creditsResetAt,
    whopUserId: user.whopUserId,
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
