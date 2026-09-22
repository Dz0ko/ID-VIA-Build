import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { rateLimit } from "@/lib/security";
import { MIN_PAYOUT_CENTS, describePayout, parsePayoutDetails, payoutDetailsSchema } from "@/lib/wallet";

/** Seller wallet: balance, payout destination and payout history. */
export async function GET() {
  return withUser(async (user) => {
    const [row, requests, earned] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sellerBalanceCents: true, sellerPaidOutCents: true, payoutMethod: true, payoutDetails: true } }),
      db.payoutRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.purchase.aggregate({ _sum: { sellerCents: true }, where: { sellerId: user.id, status: "PAID" } }),
    ]);
    const details = parsePayoutDetails(row.payoutMethod, row.payoutDetails);
    const pending = requests.find((r) => r.status === "PENDING");
    return json({
      balanceCents: row.sellerBalanceCents,
      paidOutCents: row.sellerPaidOutCents,
      earnedCents: earned._sum.sellerCents ?? 0,
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
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sellerBalanceCents: true, payoutMethod: true, payoutDetails: true } });
    const details = parsePayoutDetails(row.payoutMethod, row.payoutDetails);
    if (!details) return error("Add a payout destination (crypto wallet or PayPal) first.");
    if (row.sellerBalanceCents < MIN_PAYOUT_CENTS) return error(`The minimum payout is $${MIN_PAYOUT_CENTS / 100}.`);
    const open = await db.payoutRequest.findFirst({ where: { userId: user.id, status: "PENDING" } });
    if (open) return error("You already have a payout request waiting for approval.", 409);

    const request = await db.$transaction(async (tx) => {
      // Atomically move the whole balance into the request so it cannot be requested twice.
      const rows = await tx.$queryRaw<{ amount: number }[]>`
        UPDATE "User" SET "sellerBalanceCents" = 0
        WHERE "id" = ${user.id} AND "sellerBalanceCents" >= ${MIN_PAYOUT_CENTS}
        RETURNING (SELECT "sellerBalanceCents" FROM "User" u2 WHERE u2."id" = ${user.id}) AS amount`;
      if (!rows.length) throw new Error("BALANCE_CHANGED");
      const { method, ...rest } = details;
      return tx.payoutRequest.create({ data: { userId: user.id, amountCents: Number(rows[0].amount), method, details: JSON.stringify(rest) } });
    }).catch((e) => (e instanceof Error && e.message === "BALANCE_CHANGED" ? null : Promise.reject(e)));
    if (!request) return error("Your balance changed, please try again.", 409);
    console.info(`[wallet] payout requested ${request.amountCents}c by ${user.email} via ${request.method}`);
    return json({ ok: true, request });
  });
}
