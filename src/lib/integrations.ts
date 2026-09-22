import { z } from "zod";
import { db } from "./db";
import { decryptJson, encryptJson } from "./crypto";

export const PROVIDERS = ["github", "vercel", "supabase", "higgsfield", "netlify"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_INFO: Record<Provider, { name: string; blurb: string; docs: string; fields: { key: string; label: string; secret?: boolean; placeholder?: string }[] }> = {
  github: {
    name: "GitHub",
    blurb: "Push your project to a repository straight from the terminal (`git push`). Connect with one click, or paste a fine-grained token with Contents: read & write.",
    docs: "https://github.com/settings/personal-access-tokens/new",
    fields: [{ key: "token", label: "Personal access token (optional if connected with GitHub)", secret: true, placeholder: "github_pat_…" }],
  },
  vercel: {
    name: "Vercel",
    blurb: "Deploy websites and React apps to Vercel from the terminal (`deploy vercel`). Create a token at vercel.com → Settings → Tokens.",
    docs: "https://vercel.com/account/tokens",
    fields: [{ key: "token", label: "Vercel token", secret: true, placeholder: "vercel_…" }, { key: "teamId", label: "Team ID (optional, for team accounts)", placeholder: "team_…" }],
  },
  supabase: {
    name: "Supabase",
    blurb: "Link a Supabase project: the URL and keys are injected into deploys as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY and available to the Database agent.",
    docs: "https://supabase.com/dashboard/project/_/settings/api",
    fields: [{ key: "url", label: "Project URL", placeholder: "https://xxxx.supabase.co" }, { key: "anonKey", label: "Anon / publishable key", secret: true }, { key: "serviceKey", label: "Service role key (optional, server only)", secret: true }],
  },
  higgsfield: {
    name: "Higgsfield",
    blurb: "AI image and video generation. Your API key is injected into deploys as HIGGSFIELD_API_KEY so generated apps can call Higgsfield.",
    docs: "https://higgsfield.ai",
    fields: [{ key: "apiKey", label: "API key", secret: true }, { key: "apiSecret", label: "API secret (if your plan has one)", secret: true }],
  },
  netlify: {
    name: "Netlify",
    blurb: "Alternative host: deploy static sites with `deploy netlify`. Create a personal access token in Netlify → User settings → Applications.",
    docs: "https://app.netlify.com/user/applications#personal-access-tokens",
    fields: [{ key: "token", label: "Personal access token", secret: true }],
  },
};

export const secretSchemas: Record<Provider, z.ZodTypeAny> = {
  github: z.object({ token: z.string().trim().min(20).max(300).regex(/^(ghp_|github_pat_|gho_)/, "That does not look like a GitHub token") }),
  vercel: z.object({ token: z.string().trim().min(20).max(300), teamId: z.string().trim().max(80).optional().or(z.literal("")) }),
  supabase: z.object({ url: z.string().trim().url().regex(/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i, "Use the project URL, e.g. https://abcd.supabase.co"), anonKey: z.string().trim().min(20).max(600), serviceKey: z.string().trim().max(600).optional().or(z.literal("")) }),
  higgsfield: z.object({ apiKey: z.string().trim().min(8).max(300), apiSecret: z.string().trim().max(300).optional().or(z.literal("")) }),
  netlify: z.object({ token: z.string().trim().min(20).max(300) }),
};

export function isProvider(v: string): v is Provider {
  return (PROVIDERS as readonly string[]).includes(v);
}

/** Talk to the provider once to prove the credentials work; returns a label and public meta. */
export async function verifyIntegration(provider: Provider, secret: Record<string, string>): Promise<{ label: string; meta: Record<string, unknown> }> {
  const timeout = AbortSignal.timeout(10000);
  if (provider === "github") {
    const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${secret.token}`, Accept: "application/vnd.github+json", "User-Agent": "idaevia-build" }, signal: timeout });
    if (!r.ok) throw new Error("GitHub rejected the token.");
    const me = (await r.json()) as { login: string; avatar_url?: string };
    return { label: me.login, meta: { login: me.login, avatarUrl: me.avatar_url } };
  }
  if (provider === "vercel") {
    const r = await fetch("https://api.vercel.com/v2/user", { headers: { Authorization: `Bearer ${secret.token}` }, signal: timeout });
    if (!r.ok) throw new Error("Vercel rejected the token.");
    const me = (await r.json()) as { user?: { username?: string; email?: string } };
    return { label: me.user?.username ?? me.user?.email ?? "vercel", meta: { username: me.user?.username } };
  }
  if (provider === "supabase") {
    const r = await fetch(`${secret.url.replace(/\/$/, "")}/rest/v1/`, { headers: { apikey: secret.anonKey, Authorization: `Bearer ${secret.anonKey}` }, signal: timeout });
    if (r.status === 401 || r.status === 403) throw new Error("Supabase rejected the anon key.");
    if (!r.ok && r.status !== 404) throw new Error(`Supabase project did not respond (${r.status}).`);
    const ref = secret.url.match(/https:\/\/([a-z0-9-]+)\./i)?.[1] ?? "supabase";
    return { label: ref, meta: { url: secret.url, ref } };
  }
  if (provider === "netlify") {
    const r = await fetch("https://api.netlify.com/api/v1/user", { headers: { Authorization: `Bearer ${secret.token}` }, signal: timeout });
    if (!r.ok) throw new Error("Netlify rejected the token.");
    const me = (await r.json()) as { email?: string; full_name?: string };
    return { label: me.full_name ?? me.email ?? "netlify", meta: { email: me.email } };
  }
  // higgsfield: no public "whoami" endpoint we can rely on; store after format validation.
  return { label: `key …${secret.apiKey.slice(-4)}`, meta: {} };
}

export async function saveIntegration(userId: string, provider: Provider, secret: Record<string, string>) {
  const parsed = secretSchemas[provider].safeParse(secret);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid credentials.");
  const clean = Object.fromEntries(Object.entries(parsed.data as Record<string, string>).filter(([, v]) => v)) as Record<string, string>;
  const { label, meta } = await verifyIntegration(provider, clean);
  return db.integration.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, label, secret: encryptJson(clean), meta: JSON.stringify(meta) },
    update: { label, secret: encryptJson(clean), meta: JSON.stringify(meta) },
  });
}

export async function getIntegration<T extends Record<string, string> = Record<string, string>>(userId: string, provider: Provider): Promise<{ secret: T; label: string | null; meta: Record<string, unknown> } | null> {
  const row = await db.integration.findUnique({ where: { userId_provider: { userId, provider } } });
  if (!row) return null;
  const secret = decryptJson<T>(row.secret);
  if (!secret) return null;
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(row.meta); } catch { /* ignore */ }
  return { secret, label: row.label, meta };
}

/** What the UI may see: never the secrets. */
export async function listIntegrations(userId: string) {
  const rows = await db.integration.findMany({ where: { userId }, orderBy: { provider: "asc" } });
  return rows.map((r) => ({ provider: r.provider as Provider, label: r.label, meta: (() => { try { return JSON.parse(r.meta); } catch { return {}; } })(), updatedAt: r.updatedAt }));
}
