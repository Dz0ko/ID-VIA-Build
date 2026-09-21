import { customAlphabet } from "nanoid";
import { cookies } from "next/headers";
import { db } from "./db";
import { grantCredits } from "./credits";
import { getSettings } from "./settings";
import { PLANS, type PlanId } from "./plans";

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
      await db.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
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
  store.set(COOKIE, `${ref.kind === "affiliate" ? "a" : "u"}:${ref.id}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: COOKIE_DAYS * 86_400, secure: process.env.NODE_ENV === "production",
  });
}

async function readAttribution() {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const [k, id] = raw.split(":");
  if (!id) return null;
  return k === "a" ? { kind: "affiliate" as const, id } : k === "u" ? { kind: "user" as const, id } : null;
}

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

  const referrer = await db.user.findUnique({ where: { id: ref.id }, select: { id: true } });
  if (!referrer) return;
  await db.user.update({ where: { id: newUserId }, data: { referredById: referrer.id } });
  if (s.referredSignupCredits > 0) await grantCredits(newUserId, s.referredSignupCredits, "referral_welcome");
  if (s.referrerSignupCredits > 0) await grantCredits(referrer.id, s.referrerSignupCredits, "referral_signup");
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
  const user = await db.user.findUnique({ where: { id: userId }, select: { affiliateId: true } });
  if (!user || user.affiliateId) return;
  const aff = await db.affiliate.findFirst({ where: { id: ref.id, active: true }, select: { id: true } });
  if (!aff) return;
  await db.user.update({ where: { id: userId }, data: { affiliateId: aff.id } });
}

/**
 * Called whenever a user pays for a plan (Whop webhook, or the dev plan switcher).
 * Records the affiliate commission and pays the referrer's one-time paid bonus.
 */
export async function onPaidConversion(userId: string, opts: { plan?: PlanId; amountCents?: number; reason: string }) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { affiliateId: true, referredById: true, referralPaidRewarded: true } });
  if (!user) return;
  const amountCents = opts.amountCents ?? (opts.plan ? PLANS[opts.plan].price * 100 : 0);

  if (user.affiliateId && amountCents > 0) {
    const aff = await db.affiliate.findUnique({ where: { id: user.affiliateId } });
    if (aff && aff.active) {
      const commissionCents = Math.round((amountCents * aff.commissionPct) / 100);
      if (commissionCents > 0) {
        await db.affiliateCommission.create({ data: { affiliateId: aff.id, userId, amountCents, commissionCents, pct: aff.commissionPct, reason: opts.reason } });
      }
    }
  }

  if (user.referredById && !user.referralPaidRewarded) {
    const s = (await getSettings()).referral;
    await db.user.update({ where: { id: userId }, data: { referralPaidRewarded: true } });
    if (s.referrerPaidCredits > 0) await grantCredits(user.referredById, s.referrerPaidCredits, "referral_paid");
  }
}

/** Stats for the profile "Invite friends" card. */
export async function referralStats(userId: string) {
  const [code, invited, converted, earned] = await Promise.all([
    ensureReferralCode(userId),
    db.user.count({ where: { referredById: userId } }),
    db.user.count({ where: { referredById: userId, referralPaidRewarded: true } }),
    db.creditLedger.aggregate({ _sum: { delta: true }, where: { userId, reason: { in: ["referral_signup", "referral_paid"] } } }),
  ]);
  return { code, url: referralUrl(code), invited, converted, creditsEarned: earned._sum.delta ?? 0 };
}
