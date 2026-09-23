import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { decryptJson, encryptJson } from "./crypto";

type EmailConfig = { enabled: boolean; from: string; replyTo: string; apiKey: string };
export async function emailConfig(): Promise<EmailConfig> {
  const row = await db.setting.findUnique({ where: { key: "email-config" } });
  const saved = decryptJson<EmailConfig>(row?.value);
  return saved ?? { enabled: process.env.EMAIL_ENABLED === "true", from: process.env.EMAIL_FROM || "IDÆVIA <support@idaevia.app>", replyTo: process.env.EMAIL_REPLY_TO || "support@idaevia.app", apiKey: process.env.RESEND_API_KEY || "" };
}
export async function saveEmailConfig(input: Omit<EmailConfig, "apiKey"> & { apiKey?: string }) {
  const current = await emailConfig();
  await db.setting.upsert({ where: { key: "email-config" }, create: { key: "email-config", value: encryptJson({ ...input, apiKey: input.apiKey || current.apiKey }) }, update: { value: encryptJson({ ...input, apiKey: input.apiKey || current.apiKey }) } });
}
export function appUrl(path: string) { return new URL(path, process.env.APP_URL || "https://idaevia.app").toString(); }
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function renderEmail(input: { subject: string; body: string; ctaLabel?: string | null; ctaUrl?: string | null; unsubscribe?: string }) {
  const footer = input.unsubscribe ? `You opted in to IDÆVIA product updates and promotions. Unsubscribe: ${input.unsubscribe}` : "This is an account notification from IDÆVIA. Need help? Open Live support in your account.";
  const text = `${input.subject}\n\n${input.body}${input.ctaUrl ? `\n\n${input.ctaLabel || "Open IDÆVIA"}: ${input.ctaUrl}` : ""}\n\n${footer}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;color:#18181b;font-family:Arial,sans-serif"><div style="max-width:560px;margin:32px auto;padding:32px;background:white;border:1px solid #e5e5e8;border-radius:16px"><p style="font-size:13px;letter-spacing:3px">IDÆVIA BUILD</p><h1 style="font-size:26px;line-height:1.25">${escape(input.subject)}</h1>${input.body.split(/\n\n/).map(p => `<p style="font-size:15px;line-height:1.7">${escape(p).replaceAll("\n", "<br>")}</p>`).join("")}${input.ctaUrl && /^https:\/\//.test(input.ctaUrl) ? `<p style="margin:28px 0"><a href="${escape(input.ctaUrl)}" style="display:inline-block;padding:14px 22px;background:#6b5cf6;border-radius:9px;color:white;text-decoration:none">${escape(input.ctaLabel || "Open IDÆVIA")}</a></p>` : ""}<hr style="border:0;border-top:1px solid #e5e5e8;margin:28px 0"><p style="font-size:12px;color:#71717a;line-height:1.6">${input.unsubscribe ? `You opted in to IDÆVIA updates and promotions. <a href="${escape(input.unsubscribe)}">Unsubscribe</a>.` : escape(footer)}</p></div></body></html>`;
  return { html, text };
}
export async function enqueueEmail(tx: Prisma.TransactionClient, input: { eventKey: string; userId: string; kind: string; subject: string; body: string; ctaLabel?: string; ctaUrl?: string; marketing?: boolean; campaignId?: string }) {
  return tx.emailDelivery.upsert({ where: { eventKey: input.eventKey }, create: input, update: {} });
}
export async function enqueueWelcome(tx: Prisma.TransactionClient, user: { id: string; name: string | null }) {
  return enqueueEmail(tx, { eventKey: `welcome:${user.id}`, userId: user.id, kind: "welcome", subject: "Welcome to IDÆVIA Build", body: `Hi ${user.name || "there"},\n\nYour IDÆVIA account is ready. Start a website or SaaS project, choose a detailed prompt, or explore components with live previews.\n\nNeed a hand? Live support is available from your workspace.`, ctaLabel: "Open your workspace", ctaUrl: appUrl("/app") });
}

/** One durable worker lease across instances. Payload and provider key stay identical on retries. */
export async function processEmailQueue(options: { limit?: number; seconds?: number } = {}) {
  const config = await emailConfig();
  if (!config.enabled || !config.apiKey || !config.from) return { processed: 0, configured: false };
  const token = randomUUID(), seconds = Math.min(220, options.seconds ?? 40), deadline = Date.now() + seconds * 1000;
  const acquired = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('idaevia-email-worker'))`;
    const row = await tx.setting.findUnique({ where: { key: "email-worker-lease" } });
    if (row && JSON.parse(row.value).until > Date.now()) return false;
    const value = JSON.stringify({ token, until: deadline + 25000 });
    await tx.setting.upsert({ where: { key: "email-worker-lease" }, create: { key: "email-worker-lease", value }, update: { value } });
    return true;
  });
  if (!acquired) return { processed: 0, configured: true, busy: true };
  let processed = 0;
  try {
    for (let i = 0; i < (options.limit ?? 30) && Date.now() < deadline; i++) {
      const row = await db.emailDelivery.findFirst({ where: { OR: [{ status: "PENDING", nextAttemptAt: { lte: new Date() } }, { status: "SENDING", lockedUntil: { lt: new Date() } }] }, orderBy: [{ marketing: "asc" }, { createdAt: "asc" }], include: { user: { select: { email: true, marketingEmails: true, emailOptOutToken: true } }, campaign: { select: { status: true } } } });
      if (!row) break;
      if (row.marketing && (!row.user.marketingEmails || row.campaign?.status === "CANCELLED")) {
        await db.emailDelivery.update({ where: { id: row.id }, data: { status: "SUPPRESSED", lastError: "Unsubscribed or campaign cancelled" } }); continue;
      }
      if (row.uncertain && row.firstAttemptAt && Date.now() - row.firstAttemptAt.getTime() > 23 * 3600000) {
        await db.emailDelivery.update({ where: { id: row.id }, data: { status: "REVIEW", lastError: "Provider outcome uncertain; check Resend before retrying to avoid duplicate delivery." } }); continue;
      }
      let optOutToken = row.user.emailOptOutToken;
      if (row.marketing && !optOutToken) {
        await db.user.updateMany({ where: { id: row.userId, emailOptOutToken: null }, data: { emailOptOutToken: randomUUID() } });
        optOutToken = (await db.user.findUniqueOrThrow({ where: { id: row.userId }, select: { emailOptOutToken: true } })).emailOptOutToken;
      }
      const unsubscribe = row.marketing ? appUrl(`/email/unsubscribe?token=${optOutToken}`) : undefined;
      const rendered = renderEmail({ ...row, unsubscribe });
      const payload = row.wirePayload || JSON.stringify({ from: config.from, to: [row.user.email], reply_to: config.replyTo || undefined, subject: row.subject, ...rendered, ...(row.marketing ? { headers: { "List-Unsubscribe": `<${appUrl(`/api/email/unsubscribe?token=${optOutToken}`)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}) });
      await db.emailDelivery.update({ where: { id: row.id }, data: { status: "SENDING", lockToken: token, lockedUntil: new Date(Date.now() + 120000), firstAttemptAt: row.firstAttemptAt || new Date(), wirePayload: payload, uncertain: true, attempts: { increment: 1 } } });
      let accepted = false;
      try {
        const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `idaevia/${row.id}` }, body: payload, signal: AbortSignal.timeout(8000) });
        const data = await response.json().catch(() => ({}));
        if (response.ok && typeof data.id === "string") {
          accepted = true;
          await db.emailDelivery.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), providerId: data.id, uncertain: false, lockedUntil: null, lockToken: null, lastError: null } }); processed++;
        } else {
          const uncertain = response.status >= 500 || response.ok || row.uncertain;
          const retryable = response.status === 429 || response.status >= 500 || response.ok;
          await db.emailDelivery.update({ where: { id: row.id }, data: { status: retryable && row.attempts < 4 ? "PENDING" : uncertain ? "REVIEW" : "FAILED", uncertain, nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** row.attempts)), lockedUntil: null, lockToken: null, lastError: `Email provider returned HTTP ${response.status}. Check sender verification, credentials and provider limits.` } });
        }
      } catch {
        // A successful provider response followed by a DB failure must retain its idempotency window.
        await db.emailDelivery.updateMany({ where: { id: row.id, lockToken: token }, data: { status: row.attempts < 4 ? "PENDING" : "REVIEW", uncertain: true, lockedUntil: null, lockToken: null, nextAttemptAt: new Date(Date.now() + 60000), lastError: accepted ? "Provider accepted; database acknowledgement needs recovery." : "Email provider connection interrupted; retry queued." } });
      }
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    return { processed, configured: true };
  } finally {
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('idaevia-email-worker'))`;
      const row = await tx.setting.findUnique({ where: { key: "email-worker-lease" } });
      if (row && JSON.parse(row.value).token === token) await tx.setting.delete({ where: { key: "email-worker-lease" } });
    });
  }
}
