import { z } from "zod";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

const schema = z.object({ amountCents: z.number().int().positive().max(100_000_000), category: z.enum(["hosting", "tax", "payout_fee", "provider_adjustment", "other"]), note: z.string().trim().min(3).max(300), incurredAt: z.string().datetime() });
export async function POST(req: Request) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Enter a valid amount, date and description.");
    const expense = await db.financialExpense.create({ data: { ...body.data, incurredAt: new Date(body.data.incurredAt), createdBy: user.id } });
    return json({ id: expense.id });
  });
}
