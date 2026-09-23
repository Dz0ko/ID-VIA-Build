import { z } from "zod";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { emailConfig, saveEmailConfig, enqueueEmail, processEmailQueue, appUrl } from "@/lib/email";
import { rateLimit } from "@/lib/security";
export const maxDuration = 300;
export async function GET() {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const [config, deliveries, counts, campaigns, subscribers] = await Promise.all([
      emailConfig(), db.emailDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, kind: true, subject: true, status: true, attempts: true, lastError: true, createdAt: true, sentAt: true, user: { select: { email: true } } } }),
      db.emailDelivery.groupBy({ by: ["status"], _count: true }),
      db.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { deliveries: true } } } }),
      db.user.count({ where: { marketingEmails: true } }),
    ]);
    return json({ config: { enabled: config.enabled, from: config.from, replyTo: config.replyTo, hasKey: !!config.apiKey }, deliveries, counts, campaigns, subscribers });
  });
}
const configSchema = z.object({ enabled: z.boolean(), from: z.string().trim().min(5).max(200).refine(value => !/[\r\n]/.test(value) && z.string().email().safeParse(value.match(/<([^<>]+)>$/)?.[1] || value).success, "Use a valid sender address."), replyTo: z.string().email().max(200), apiKey: z.string().trim().regex(/^re_[A-Za-z0-9_-]+$/).max(200).optional() });
export async function PUT(req: Request) {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const body = configSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Check the sender, reply-to address and Resend API key.");
    const current = await emailConfig();
    if (body.data.enabled && !body.data.apiKey && !current.apiKey) return error("Add a Resend API key before enabling email delivery.");
    await saveEmailConfig(body.data);
    if (body.data.enabled) after(async () => { await processEmailQueue({ limit: 200, seconds: 220 }); });
    return json({ ok: true });
  });
}
export async function POST(req: Request) {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const limited = await rateLimit(`admin-email:${user.id}`, 30, 600); if (limited) return limited;
    const body = z.object({ action: z.enum(["test", "process", "retry"]), id: z.string().max(100).optional() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return error("Invalid email action.");
    const config = await emailConfig();
    if (!config.enabled || !config.apiKey) return error("Connect and enable email delivery first.");
    if (body.data.action === "test") await enqueueEmail(db, { eventKey: `test:${randomUUID()}`, userId: user.id, kind: "test", subject: "IDÆVIA email connection test", body: "Your IDÆVIA email service accepted a test request. Check this inbox to confirm delivery.", ctaLabel: "Open email settings", ctaUrl: appUrl("/admin/email") });
    if (body.data.action === "retry") {
      const updated = await db.emailDelivery.updateMany({ where: { id: body.data.id ?? "", status: "FAILED", uncertain: false }, data: { status: "PENDING", attempts: 0, firstAttemptAt: null, wirePayload: null, lastError: null, nextAttemptAt: new Date() } });
      if (!updated.count) return error("Only rejected deliveries can be retried. Check uncertain outcomes with the provider first.");
    }
    return json(await processEmailQueue({ limit: 100, seconds: 100 }));
  });
}
