import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { rateLimit } from "@/lib/security";
import { MIN_PAYOUT_CENTS, describePayout, parsePayoutDetails, payoutDetailsSchema } from "@/lib/wallet";

/** Seller wallet: balance, payout destination and payout history. */
export async function GET() {
  return withUser(async (user) => {
    const [row, requests, earned, referral] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sellerBalanceCents: true, sellerPaidOutCents: true, payoutMethod: true, payoutDetails: true } }),
      db.payoutRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.purchase.aggregate({ _sum: { sellerCents: true }, where: { sellerId: user.id, status: "PAID" } }),
      db.referralCommission.aggregate({ where: { referrerId: user.id }, _sum: { commissionCents: true, reversedCents: true } }),
    ]);
    const details = parsePayoutDetails(row.payoutMethod, row.payoutDetails);
    const pending = requests.find((r) => r.status === "PENDING");
    return json({
      balanceCents: row.sellerBalanceCents,
      paidOutCents: row.sellerPaidOutCents,
      marketplaceEarnedCents: earned._sum.sellerCents ?? 0,
      referralEarnedCents: (referral._sum.commissionCents ?? 0) - (referral._sum.reversedCents ?? 0),
      earnedCents: (earned._sum.sellerCents ?? 0) + (referral._sum.commissionCents ?? 0) - (referral._sum.reversedCents ?? 0),
      pendingCents: pending?.amountCents ?? 0,
      minPayoutCents: MIN_PAYOUT_CENTS,
      payout: details,
      payoutLabel: describePayout(details),
      requests: requests.map((r) => ({ id: r.id, amountCents: r.amountCents, method: r.method, status: r.status, note: r.note, createdAt: r.createdAt, resolvedAt: r.resolvedAt })),
    });
  });
}

/** Save the payout destination (crypto wallet or PayPal). */
export async function PATCH(req: Request) {
  return withUser(async (user) => {
    const body = payoutDetailsSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid payout details.");
    const { method, ...details } = body.data;
    await db.user.update({ where: { id: user.id }, data: { payoutMethod: method, payoutDetails: JSON.stringify(details) } });
    return json({ ok: true, payoutLabel: describePayout(body.data) });
  });
}

/** Request a payout of the full balance. The balance is moved into the request until an admin resolves it. */
export async function POST() {
  return withUser(async (user) => {
    const limited = await rateLimit(`payout:user:${user.id}`, 5, 3600);
    if (limited) return limited;
    try {
      const request = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        const row = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        const details = parsePayoutDetails(row.payoutMethod, row.payoutDetails);
        if (!details) throw new Error("Add a payout destination (crypto wallet or PayPal) first.");
        if (row.sellerBalanceCents < MIN_PAYOUT_CENTS) throw new Error(`The minimum payout is $${MIN_PAYOUT_CENTS / 100}.`);
        if (await tx.payoutRequest.findFirst({ where: { userId: user.id, status: "PENDING" } })) throw new Error("You already have a payout request waiting for approval.");
        const { method, ...rest } = details;
        await tx.user.update({ where: { id: user.id }, data: { sellerBalanceCents: 0 } });
        return tx.payoutRequest.create({ data: { userId: user.id, amountCents: row.sellerBalanceCents, method, details: JSON.stringify(rest) } });
      });
      return json({ ok: true, request: { id: request.id, amountCents: request.amountCents, status: request.status } });
    } catch (e) {
      if (e instanceof Error && /^(Add a payout|The minimum|You already)/.test(e.message)) return error(e.message, 409);
      throw e;
    }
  });
}
