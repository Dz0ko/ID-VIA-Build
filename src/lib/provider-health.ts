import { db } from "./db";
import { recordPlatformError } from "./platform-errors";
import { redactIncidentText } from "./platform-error-details";
import { appUrl, enqueueEmail } from "./email";

export type ProviderId = "anthropic" | "openai";
export type ProviderOutage = "billing" | "auth" | "capacity";
export type ProviderHealth = { provider: ProviderId; label: string; state: "healthy" | ProviderOutage; message?: string; since?: string; lastAt?: string; occurrences?: number; billingUrl: string };

export const PROVIDER_LABELS: Record<ProviderId, string> = { anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT)" };
export const PROVIDER_BILLING_URLS: Record<ProviderId, string> = { anthropic: "https://console.anthropic.com/settings/billing", openai: "https://platform.openai.com/settings/organization/billing/overview" };
const KEY = (provider: ProviderId) => `provider-health:${provider}`;
const OUTAGE_TITLE: Record<ProviderOutage, string> = { billing: "has no API credits left", auth: "rejected the API key", capacity: "is rate-limited or overloaded" };

/** Provider SDK errors that mean the platform's own account, not the user's request, is the problem. */
export function classifyProviderError(error: unknown): ProviderOutage | null {
  const err = error as { status?: number; message?: string; code?: string; error?: { code?: string; type?: string; error?: { type?: string; message?: string } } } | null;
  const text = `${err?.message ?? ""} ${err?.code ?? ""} ${err?.error?.code ?? ""} ${err?.error?.type ?? ""} ${err?.error?.error?.type ?? ""} ${err?.error?.error?.message ?? ""}`.toLowerCase();
  if (err?.status === 402 || /credit balance|insufficient_quota|exceeded your current quota|billing_hard_limit|billing (?:details|issue|not active)|payment required|insufficient (?:funds|balance)|plans? & billing/.test(text)) return "billing";
  if (err?.status === 401 || err?.status === 403 || /authentication_error|invalid.{0,20}api.?key|incorrect api key|permission_error/.test(text)) return "auth";
  if (err?.status === 429 || err?.status === 503 || err?.status === 529 || /rate.?limit|overloaded/.test(text)) return "capacity";
  return null;
}

const lastReported = new Map<string, number>();
const lastCleared = new Map<ProviderId, number>();

/**
 * Persist a provider outage so the admin sees it immediately (banner + incident) and, for the two
 * states that need a human (no credits, rejected key), emails every administrator at most once per 6 hours.
 */
export async function reportProviderOutage(provider: ProviderId, kind: ProviderOutage, error: unknown): Promise<void> {
  const throttleKey = `${provider}:${kind}`;
  const now = Date.now();
  if ((lastReported.get(throttleKey) ?? 0) > now - 30_000) return;
  lastReported.set(throttleKey, now);
  try {
    const message = redactIncidentText(error instanceof Error ? error.message : String(error ?? "")).slice(0, 300);
    const key = KEY(provider);
    const previous = await db.setting.findUnique({ where: { key } });
    const before = previous ? (JSON.parse(previous.value) as Partial<ProviderHealth>) : null;
    const since = before?.state === kind && before.since ? before.since : new Date(now).toISOString();
    const value = JSON.stringify({ state: kind, message, since, lastAt: new Date(now).toISOString(), occurrences: (before?.state === kind ? before.occurrences ?? 0 : 0) + 1 });
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await recordPlatformError(new Error(`${PROVIDER_LABELS[provider]} ${OUTAGE_TITLE[kind]}: ${message}`), { source: `provider-${provider}-${kind}`, details: `Other users' requests fall back to the other provider while it is available. Top-up: ${PROVIDER_BILLING_URLS[provider]}` });
    if (kind === "capacity") return;
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    const bucket = Math.floor(now / (6 * 3600_000));
    const subject = kind === "billing" ? `Action needed: ${PROVIDER_LABELS[provider]} API has no credits` : `Action needed: ${PROVIDER_LABELS[provider]} API key was rejected`;
    const body = kind === "billing"
      ? `The platform's ${PROVIDER_LABELS[provider]} account ran out of API credits at ${new Date(now).toUTCString()}. New generations on that provider fail; the platform serves users through the other provider while it is available.\n\nTop up the account, then open Platform errors and press “Check providers now” to confirm the alert clears.\n\nProvider message: ${message}`
      : `The ${PROVIDER_LABELS[provider]} API rejected the platform's API key at ${new Date(now).toUTCString()}. New generations on that provider fail; the platform serves users through the other provider while it is available.\n\nCheck the key in the hosting environment variables, then open Platform errors and press “Check providers now”.\n\nProvider message: ${message}`;
    await db.$transaction(async tx => {
      for (const admin of admins) await enqueueEmail(tx, { eventKey: `provider-outage:${provider}:${kind}:${bucket}:${admin.id}`, userId: admin.id, kind: "alert", subject, body, ctaLabel: "Open Platform errors", ctaUrl: appUrl("/admin/errors") });
    });
  } catch (cause) {
    console.error("[provider-health] Could not record provider outage", provider, kind, cause instanceof Error ? cause.message : cause);
  }
}

/** A successful call proves the account works again; the flag is cleared at most every 10 minutes per instance. */
export async function markProviderHealthy(provider: ProviderId, force = false): Promise<void> {
  const now = Date.now();
  if (!force && (lastCleared.get(provider) ?? 0) > now - 600_000) return;
  lastCleared.set(provider, now);
  try { await db.setting.deleteMany({ where: { key: KEY(provider) } }); } catch { /* the next successful call retries */ }
}

export async function providerHealth(): Promise<ProviderHealth[]> {
  const rows = await db.setting.findMany({ where: { key: { in: [KEY("anthropic"), KEY("openai")] } } });
  return (["anthropic", "openai"] as ProviderId[]).map(provider => {
    const row = rows.find(r => r.key === KEY(provider));
    const parsed = row ? (JSON.parse(row.value) as Partial<ProviderHealth>) : null;
    return { provider, label: PROVIDER_LABELS[provider], billingUrl: PROVIDER_BILLING_URLS[provider], state: (parsed?.state as ProviderHealth["state"]) || "healthy", message: parsed?.message, since: parsed?.since, lastAt: parsed?.lastAt, occurrences: parsed?.occurrences };
  });
}

/**
 * One minimal request per configured provider. Finds an empty account before a user does and clears
 * a stale alert after a top-up. Costs a few tokens; run from the daily cron and the admin "Check now" button.
 */
export async function probeProviders(): Promise<ProviderHealth[]> {
  const { PROVIDERS } = await import("./ai/provider");
  const { OPENAI_TIER_MODELS, DEFAULT_SETTINGS } = await import("./settings");
  const input = { system: "Reply with the single word OK.", messages: [{ role: "user" as const, content: "Health check" }], maxOutput: 16, effort: "low" as const, signal: AbortSignal.timeout(30_000) };
  for (const provider of ["anthropic", "openai"] as ProviderId[]) {
    if (!PROVIDERS[provider].available()) continue;
    try {
      await PROVIDERS[provider].generate(provider === "anthropic" ? DEFAULT_SETTINGS.tiers.fast.model : OPENAI_TIER_MODELS.fast, input);
      await markProviderHealthy(provider, true);
    } catch (error) {
      const kind = classifyProviderError(error);
      if (kind) { lastReported.delete(`${provider}:${kind}`); await reportProviderOutage(provider, kind, error); }
      else console.warn("[provider-health] Probe failed without an account signal", provider, error instanceof Error ? error.message : error);
    }
  }
  return providerHealth();
}
