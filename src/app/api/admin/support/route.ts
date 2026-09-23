import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";

export async function GET(req: Request) {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Admin access required.", 403);
    const params = new URL(req.url).searchParams;
    const status = params.get("status");
    const query = (params.get("q") ?? "").slice(0, 100);
    const page = Math.min(10000, Math.max(1, Number(params.get("page")) || 1));
    const where = { ...(status && ["BOT", "WAITING", "HUMAN", "CLOSED"].includes(status) ? { status } : {}), ...(query ? { user: { OR: [{ email: { contains: query, mode: "insensitive" as const } }, { name: { contains: query, mode: "insensitive" as const } }] } } : {}) };
    const [threads, total] = await Promise.all([db.supportThread.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 30, take: 30, select: { id: true, status: true, assignedTo: true, updatedAt: true, user: { select: { name: true, email: true } }, messages: { orderBy: { id: "desc" }, take: 1, select: { content: true, role: true } } } }), db.supportThread.count({ where })]);
    return json({ threads, total, page });
  });
}
