import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { markPurchasePaid, simulatedPaymentsEnabled } from "@/lib/marketplace";

/** Local development only: simulates a successful Whop payment for the buyer's own pending order. */
export async function GET(req: Request, ctx: RouteContext<"/api/marketplace/purchases/[id]/dev-pay">) {
  const { id } = await ctx.params;
  if (!simulatedPaymentsEnabled()) return new Response("Not available", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const purchase = await db.purchase.findFirst({ where: { id, buyerId: user.id } });
  if (!purchase) return new Response("Not found", { status: 404 });
  await markPurchasePaid(id, `dev_${id}`);
  return NextResponse.redirect(new URL(`/app/marketplace?purchase=${id}&simulated=1`, req.url));
}
