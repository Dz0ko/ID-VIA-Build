import "server-only";
import { recordPlatformError } from "./platform-errors";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { decryptJson, encryptJson } from "./crypto";

type EmailConfig = { enabled: boolean; from: string; replyTo: string; apiKey: string };
export async function emailConfig(): Promise<EmailConfig> {
  const row = await db.setting.findUnique({ where: { key: "email-config" } });
  const saved = decryptJson<EmailConfig>(row?.value);
  return saved ?? { enabled: process.env.EMAIL_ENABLED === "true", from: process.env.EMAIL_FROM || "IDÆVIA <info@idaevia.app>", replyTo: process.env.EMAIL_REPLY_TO || "info@idaevia.app", apiKey: process.env.RESEND_API_KEY || "" };
}
export async function saveEmailConfig(input: Omit<EmailConfig, "apiKey"> & { apiKey?: string }) {
  const current = await emailConfig();
  await db.setting.upsert({ where: { key: "email-config" }, create: { key: "email-config", value: encryptJson({ ...input, apiKey: input.apiKey || current.apiKey }) }, update: { value: encryptJson({ ...input, apiKey: input.apiKey || current.apiKey }) } });
}
export function appUrl(path: string) { return new URL(path, process.env.APP_URL || "https://idaevia.app").toString(); }
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function renderEmail(input: { subject: string; body: string; ctaLabel?: string | null; ctaUrl?: string | null; unsubscribe?: string; kind?: string }) {
  const category = input.unsubscribe ? "News from IDÆVIA" : ({ welcome: "Welcome aboard", password: "Account security", payment: "Payment confirmed", plan: "Payment confirmed", pack: "Credits confirmed", marketplace: "Purchase confirmed", test: "You’re connected", alert: "Platform alert" }[input.kind || ""] || "Your IDÆVIA account");
  const footer = input.unsubscribe ? `You opted in to IDÆVIA updates and promotions. Unsubscribe: ${input.unsubscribe}` : "You’re receiving this because of activity on your IDÆVIA account.";
  const safeCta = input.ctaUrl && /^https:\/\//.test(input.ctaUrl) ? input.ctaUrl : null;
  const text = `IDÆVIA BUILD · ${category}\n\n${input.subject}\n\n${input.body}${safeCta ? `\n\n${input.ctaLabel || "Open IDÆVIA"}: ${safeCta}` : ""}\n\nThe IDÆVIA team\nQuestions? info@idaevia.app\n\n${footer}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(input.subject)}</title></head><body style="margin:0;padding:24px 12px;background:#ececf0;font-family:Arial,Helvetica,sans-serif;color:#19191e"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(input.body.slice(0, 140))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border:1px solid #ddddE5;border-radius:18px;overflow:hidden;background:#ffffff"><tr><td bgcolor="#0a0a0b" style="padding:24px 28px;background:#0a0a0b;border-bottom:3px solid #7963df"><img src="https://idaevia.app/brand/monogram/lockup-on-dark.png" width="220" height="59" alt="IDÆVIA Build" style="display:block;width:220px;height:auto;border:0"></td></tr><tr><td style="padding:36px 32px"><p style="margin:0 0 14px;color:#7462ba;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">${escape(category)}</p><h1 style="font-size:29px;line-height:1.22;letter-spacing:-1px;font-weight:700;margin:0 0 24px;color:#17171c">${escape(input.subject)}</h1>${input.body.split(/\n\n/).map(p => `<p style="font-size:15px;line-height:1.8;color:#4c4c58;margin:0 0 18px">${escape(p).replaceAll("\n", "<br>")}</p>`).join("")}${safeCta ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0"><tr><td bgcolor="#6550bd" style="border-radius:9px;background:#6550bd"><a href="${escape(safeCta)}" style="display:inline-block;padding:16px 24px;border:1px solid #6550bd;border-radius:9px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">${escape(input.ctaLabel || "Open IDÆVIA")} &rarr;</a></td></tr></table>` : ""}<p style="font-size:14px;line-height:1.7;color:#19191e;margin:28px 0 0">See you in the workspace,<br><strong>The IDÆVIA team</strong></p></td></tr><tr><td bgcolor="#f7f7fa" style="padding:24px 32px;border-top:1px solid #e9e9ef;font-size:12px;line-height:1.8;color:#72727f"><strong style="color:#393943">Ideas into websites. Ideas into products.</strong><br>Need a hand? <a href="mailto:info@idaevia.app" style="color:#6550bd">info@idaevia.app</a><p style="margin:14px 0 0">${input.unsubscribe ? `You opted in to IDÆVIA updates and promotions. <a href="${escape(input.unsubscribe)}" style="color:#6550bd">Unsubscribe</a>.` : escape(footer)}</p><p style="margin:10px 0 0"><a href="https://idaevia.app/privacy" style="color:#72727f">Privacy</a> &nbsp;·&nbsp; <a href="https://idaevia.app" style="color:#72727f">idaevia.app</a></p></td></tr></table></td></tr></table></body></html>`;
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
          await recordPlatformError(new Error(`Email provider returned HTTP ${response.status}.`), { source: "email.delivery", userId: row.userId });
          const uncertain = response.status >= 500 || response.ok || row.uncertain;
          const retryable = response.status === 429 || response.status >= 500 || response.ok;
          await db.emailDelivery.update({ where: { id: row.id }, data: { status: retryable && row.attempts < 4 ? "PENDING" : uncertain ? "REVIEW" : "FAILED", uncertain, nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** row.attempts)), lockedUntil: null, lockToken: null, lastError: `Email provider returned HTTP ${response.status}. Check sender verification, credentials and provider limits.` } });
        }
      } catch (error) {
        await recordPlatformError(error, { source: "email.delivery", userId: row.userId, secrets: [config.apiKey] });
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
