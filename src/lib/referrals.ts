import { signReferral, verifyReferral } from "./referral-cookie";
import { customAlphabet } from "nanoid";
import { cookies } from "next/headers";
import { db } from "./db";
import { getSettings } from "./settings";

/**
 * Referrals (every user) and affiliates (admin-managed partners).
 * Both use the same link shape: /r/<code>. Visiting it drops a 30-day cookie;
 * the next signup on this browser is attributed to that code.
 */
const COOKIE = "idaevia_ref";
const COOKIE_DAYS = 30;
const makeCode = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 8);

export function referralUrl(code: string) {
  return `${process.env.APP_URL ?? "http://localhost:3737"}/r/${code}`;
}

/** Every user gets a stable share code (created lazily for accounts that predate the programme). */
export async function ensureReferralCode(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (u.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    try {
      const assigned = await db.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } });
      return assigned.count ? code : (await db.user.findUniqueOrThrow({ where: { id: userId } })).referralCode!;
    } catch { /* collision, retry */ }
  }
  throw new Error("Could not allocate a referral code");
}

/** Resolve /r/<code> to an affiliate or a user. Affiliate codes win on collision. */
export async function resolveCode(code: string) {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  const aff = await db.affiliate.findFirst({ where: { code: c, active: true }, select: { id: true } });
  if (aff) return { kind: "affiliate" as const, id: aff.id };
  const user = await db.user.findFirst({ where: { referralCode: c }, select: { id: true } });
  if (user) return { kind: "user" as const, id: user.id };
  return null;
}

export async function setAttributionCookie(ref: { kind: "affiliate" | "user"; id: string }) {
  const store = await cookies();
  store.set(COOKIE, signReferral(ref.kind, ref.id), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: COOKIE_DAYS * 86_400, secure: process.env.NODE_ENV === "production",
  });
}

async function readAttribution() {
  const store = await cookies();
  return verifyReferral(store.get(COOKIE)?.value);
}

const REFERRAL_SIGNUP_CAP = 10;

/**
 * Called right after a new account is created (email or social). Links the
 * account to the referrer/affiliate and pays the signup credits.
 */
export async function applyReferralOnSignup(newUserId: string) {
  const ref = await readAttribution();
  const store = await cookies();
  store.delete(COOKIE);
  await ensureReferralCode(newUserId);
  if (!ref || ref.id === newUserId) return;
  const s = (await getSettings()).referral;

  if (ref.kind === "affiliate") {
    const aff = await db.affiliate.findFirst({ where: { id: ref.id, active: true } });
    if (!aff) return;
    await db.user.update({ where: { id: newUserId }, data: { affiliateId: aff.id } });
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ref.id} FOR UPDATE`;
    const referrer = await tx.user.findUnique({ where: { id: ref.id } });
    if (!referrer) return;
    const linked = await tx.user.updateMany({ where: { id: newUserId, referredById: null, affiliateId: null }, data: { referredById: referrer.id } });
    if (!linked.count) return;
    async function reward(userId: string, amount: number, reason: string) {
      if (amount <= 0) return;
      await tx.user.update({ where: { id: userId }, data: { credits: { increment: amount }, purchasedCredits: { increment: amount } } });
      await tx.creditLedger.create({ data: { userId, delta: amount, reason } });
    }
    await reward(newUserId, s.referredSignupCredits, "referral_welcome");
    const since = new Date(Date.now() - 30 * 86400000);
    const recent = await tx.creditLedger.count({ where: { userId: ref.id, reason: "referral_signup", createdAt: { gte: since } } });
    if (recent < REFERRAL_SIGNUP_CAP) await reward(ref.id, s.referrerSignupCredits, "referral_signup");
  });
}

/**
 * Called after an existing account logs in. If the browser carries an affiliate
 * cookie and the account is not attributed yet, the affiliate gets this customer
 * (so a partner's link works for people who already had an account). Friend
 * referrals are sign-up only: no credits are paid here.
 */
export async function applyAttributionOnLogin(userId: string) {
  const ref = await readAttribution();
  if (!ref) return;
  const store = await cookies();
  store.delete(COOKIE);
  if (ref.kind !== "affiliate" || ref.id === userId) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { affiliateId: true, referredById: true } });
  if (!user || user.affiliateId || user.referredById) return;
  const aff = await db.affiliate.findFirst({ where: { id: ref.id, active: true }, select: { id: true } });
  if (!aff) return;
  await db.user.update({ where: { id: userId }, data: { affiliateId: aff.id } });
}

/** Stats for the profile "Invite friends" card. */
export async function referralStats(userId: string) {
  const [code, invited, converted, earned, cash, history] = await Promise.all([
    ensureReferralCode(userId),
    db.user.count({ where: { referredById: userId } }),
    db.user.count({ where: { referredById: userId, referralPaidRewarded: true } }),
    db.creditLedger.aggregate({ _sum: { delta: true }, where: { userId, reason: { in: ["referral_signup", "referral_paid", "referral_adjustment"] } } }),
    db.referralCommission.aggregate({ where: { referrerId: userId }, _sum: { commissionCents: true, reversedCents: true } }),
    db.referralCommission.findMany({ where: { referrerId: userId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, amountCents: true, commissionCents: true, reversedCents: true, createdAt: true } }),
  ]);
  return { cashEarnedCents: (cash._sum.commissionCents ?? 0) - (cash._sum.reversedCents ?? 0), history, code, url: referralUrl(code), invited, converted, creditsEarned: earned._sum.delta ?? 0 };
}
