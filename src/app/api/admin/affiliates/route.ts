import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { referralUrl } from "@/lib/referrals";

function admin<T>(fn: () => Promise<T>) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    return fn();
  });
}

export async function GET() {
  return admin(async () => {
    const affiliates = await db.affiliate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true } },
        users: { where: { plan: { not: "FREE" } }, select: { id: true } },
        commissions: { select: { commissionCents: true, amountCents: true, status: true } },
      },
    });
    return json({
      affiliates: affiliates.map((a) => ({
        id: a.id, name: a.name, code: a.code, url: referralUrl(a.code), commissionPct: a.commissionPct, active: a.active, contact: a.contact, notes: a.notes, createdAt: a.createdAt,
        signups: a._count.users,
        paying: a.users.length,
        revenueCents: a.commissions.reduce((s, c) => s + c.amountCents, 0),
        owedCents: a.commissions.filter((c) => c.status === "PENDING").reduce((s, c) => s + c.commissionCents, 0),
        paidCents: a.commissions.filter((c) => c.status === "PAID").reduce((s, c) => s + c.commissionCents, 0),
      })),
    });
  });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,32}$/, "3–32 letters, digits or dashes").optional(),
  commissionPct: z.number().min(0).max(90).default(20),
  contact: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  return admin(async () => {
    const body = createSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input.");
    const code = body.data.code ?? body.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32);
    if (code.length < 3) return error("Choose a code of at least 3 characters.");
    const clash = await db.affiliate.findUnique({ where: { code } }) ?? await db.user.findFirst({ where: { referralCode: code } });
    if (clash) return error("That code is already in use.");
    const a = await db.affiliate.create({ data: { name: body.data.name, code, commissionPct: body.data.commissionPct, contact: body.data.contact, notes: body.data.notes } });
    return json({ affiliate: { ...a, url: referralUrl(a.code) } });
  });
}

const patchSchema = z.object({
  id: z.string(),
  commissionPct: z.number().min(0).max(90).optional(),
  active: z.boolean().optional(),
  name: z.string().trim().min(2).max(60).optional(),
  contact: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  /** Mark every pending commission as paid out. */
  markPaid: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  return admin(async () => {
    const body = patchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid input.");
    const { id, markPaid, ...data } = body.data;
    if (Object.keys(data).length) await db.affiliate.update({ where: { id }, data });
    if (markPaid) await db.affiliateCommission.updateMany({ where: { affiliateId: id, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() } });
    return json({ ok: true });
  });
}

export async function DELETE(req: Request) {
  return admin(async () => {
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return error("id required");
    await db.affiliate.delete({ where: { id } });
    return json({ ok: true });
  });
}
