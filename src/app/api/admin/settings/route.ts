import { z } from "zod";
import { error, json, withUser } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/settings";
import { providerStatus } from "@/lib/ai/router";
import { MODEL_TIERS } from "@/lib/plans";

const modelConfig = z.object({
  provider: z.enum(["anthropic", "openai", "mock"]),
  model: z.string().min(1).max(80).regex(/^[a-z0-9.\-]+$/i),
  label: z.string().max(60),
  enabled: z.boolean(),
  maxOutput: z.number().int().min(256).max(128000),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
});
const tierRecord = <T extends z.ZodTypeAny>(v: T) => z.object(Object.fromEntries(MODEL_TIERS.map((t) => [t, v])) as Record<(typeof MODEL_TIERS)[number], T>);
const settingsSchema = z.object({
  tiers: tierRecord(modelConfig),
  tierMultiplier: tierRecord(z.number().min(0.1).max(100)),
  creditsPerUsd: z.number().min(50).max(2000).default(150),
  creditBase: z.object({ tiny: z.number().int().min(1).max(1000), small: z.number().int().min(1).max(1000), section: z.number().int().min(1).max(1000), page: z.number().int().min(1).max(1000), feature: z.number().int().min(1).max(1000), fullstack: z.number().int().min(1).max(1000) }),
  routing: z.enum(["auto", "manual"]),
  referral: z.object({ referredSignupCredits: z.number().int().min(0).max(10000), referrerSignupCredits: z.number().int().min(0).max(10000), referrerPaidCredits: z.number().int().min(0).max(100000) }),
});

export async function GET() {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    return json({ settings: await getSettings(), providers: providerStatus() });
  });
}

export async function PUT(req: Request) {
  return withUser(async (user) => {
    if (user.role !== "ADMIN") return error("Forbidden", 403);
    const body = settingsSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return error(`Invalid settings: ${body.error.issues[0]?.path.join(".")} ${body.error.issues[0]?.message}`);
    await saveSettings(body.data);
    return json({ ok: true });
  });
}
