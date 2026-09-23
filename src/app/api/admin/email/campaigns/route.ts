import { readRequestJson } from "@/lib/request-body";
import { z } from "zod";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { error, json, withUser } from "@/lib/api";
import { emailConfig, processEmailQueue, renderEmail } from "@/lib/email";
import { rateLimit } from "@/lib/security";
export const maxDuration = 300;
const draftSchema = z.object({ subject: z.string().trim().min(3).max(150).refine(s => !/[\r\n]/.test(s)), body: z.string().trim().min(20).max(10000), ctaLabel: z.string().trim().max(60).optional(), ctaUrl: z.string().url().max(1000).startsWith("https://").optional(), plan: z.enum(["FREE", "STARTER", "PRO", "MAX", "AGENCY"]).optional() });
export async function POST(req: Request) {
  return withUser(async user => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const limited = await rateLimit(`email-campaign:${user.id}`, 30, 600); if (limited) return limited;
    const payload = await readRequestJson(req, 65536).catch(() => null);
    const raw = payload && typeof payload === "object" && "action" in payload ? payload : null;
    if (raw?.action === "draft" || raw?.action === "preview") {
      const body = draftSchema.safeParse(raw); if (!body.success) return error("Add a subject and message. Links must use HTTPS.");
      const recipients = await db.user.count({ where: { marketingEmails: true, ...(body.data.plan ? { plan: body.data.plan } : {}) } });
      if (raw.action === "preview") return json({ ...renderEmail({ ...body.data, unsubscribe: "https://idaevia.app/email/unsubscribe" }), recipients });
      return json({ campaign: await db.emailCampaign.create({ data: { ...body.data, createdBy: user.id } }), recipients });
    }
    const action = z.object({ action: z.enum(["send", "cancel"]), id: z.string().min(1).max(100), expectedRecipients: z.number().int().min(0).optional() }).safeParse(raw);
    if (!action.success) return error("Invalid campaign action.");
    if (action.data.action === "send") { const config = await emailConfig(); if (!config.enabled || !config.apiKey) return error("Connect and enable email delivery before sending a campaign."); }
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "EmailCampaign" WHERE id = ${action.data.id} FOR UPDATE`;
      const campaign = await tx.emailCampaign.findUnique({ where: { id: action.data.id } });
      if (!campaign) return error("Campaign not found.", 404);
      if (action.data.action === "cancel") {
        await tx.emailCampaign.update({ where: { id: campaign.id }, data: { status: "CANCELLED" } });
        await tx.emailDelivery.updateMany({ where: { campaignId: campaign.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUPPRESSED", lastError: "Campaign cancelled" } });
        return json({ ok: true });
      }
      if (campaign.status !== "DRAFT") return error("This campaign is already queued or cancelled.", 409);
      const recipients = await tx.user.count({ where: { marketingEmails: true, ...(campaign.plan ? { plan: campaign.plan } : {}) } });
      if (action.data.expectedRecipients !== recipients) return error("The audience changed. Refresh and review the recipient count before sending.", 409, { recipients });
      // Atomic database-side fan-out avoids loading every email address into a serverless request.
      await tx.$executeRaw(Prisma.sql`INSERT INTO "EmailDelivery" ("id", "eventKey", "userId", "kind", "subject", "body", "ctaLabel", "ctaUrl", "marketing", "status", "attempts", "nextAttemptAt", "uncertain", "createdAt", "campaignId") SELECT 'mail_' || md5(${campaign.id} || ':' || u.id), 'campaign:' || ${campaign.id} || ':' || u.id, u.id, 'promotion', ${campaign.subject}, ${campaign.body}, ${campaign.ctaLabel}, ${campaign.ctaUrl}, true, 'PENDING', 0, NOW(), false, NOW(), ${campaign.id} FROM "User" u WHERE u."marketingEmails" = true ${campaign.plan ? Prisma.sql`AND u.plan = ${campaign.plan}` : Prisma.empty} ON CONFLICT ("eventKey") DO NOTHING`);
      await tx.emailCampaign.update({ where: { id: campaign.id }, data: { status: "QUEUED", queuedAt: new Date() } });
      after(async () => { await processEmailQueue({ limit: 200, seconds: 220 }); });
      return json({ ok: true, queued: recipients });
    }, { timeout: 20000 });
  });
}
