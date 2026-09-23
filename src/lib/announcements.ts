import "server-only";
import { z } from "zod";
import { db } from "./db";
export const ANNOUNCEMENT_KEY = "platform-announcement";
const schema = z.object({ id: z.string(), campaignId: z.string(), subject: z.string().max(150), body: z.string().max(10000), ctaLabel: z.string().nullable(), ctaUrl: z.string().url().startsWith("https://").nullable(), plan: z.string().nullable(), expiresAt: z.string().datetime() });
export type Announcement = z.infer<typeof schema>;
export function parseAnnouncement(value?: string | null): Announcement | null {
  try { const result = schema.safeParse(JSON.parse(value || "null")); return result.success && Date.parse(result.data.expiresAt) > Date.now() ? result.data : null; } catch { return null; }
}
export async function getAnnouncement() { return parseAnnouncement((await db.setting.findUnique({ where: { key: ANNOUNCEMENT_KEY } }))?.value); }
