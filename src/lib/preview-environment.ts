import { runtimeProfile } from "./runtime-profile";
import { runtimeMemoryEnvironment } from "./runtime-resources";
import "server-only";
import { randomBytes } from "node:crypto";
import type { Sandbox } from "e2b";

// This image has 2 GiB RAM and PostgreSQL. The default E2B base image has only 512 MiB.
export const PREVIEW_TEMPLATE = process.env.E2B_RUNTIME_TEMPLATE || "inys70thgko5tow4cn24";
export const PREVIEW_SYSTEM_ENV = { NODE_OPTIONS: "--max-old-space-size=1536", NEXT_TELEMETRY_DISABLED: "1", NPM_CONFIG_PROGRESS: "false", NPM_CONFIG_LOGLEVEL: "warn" };

/** Only project-owned settings and sandbox-local credentials; never platform environment variables. */
export async function preparePreviewEnvironment(sandbox: Sandbox, files: { path: string; content: string }[], settings: Record<string, string>, memoryMB = 2048): Promise<Record<string, string>> {
  const envs = Object.fromEntries(Object.entries(settings).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !["NODE_OPTIONS", "LD_PRELOAD", "PATH", "HOME", "IDAEVIA_LOCAL_DATABASE"].includes(key)));
  const schema = files.find(f => /(?:^|\/)prisma\/schema\.prisma$/.test(f.path))?.content;
  const databaseKey = schema?.match(/url\s*=\s*env\(["']([A-Z_][A-Z0-9_]*)["']\)/)?.[1] ?? "DATABASE_URL";
  if (schema && /provider\s*=\s*["']postgresql["']/.test(schema) && !envs[databaseKey]) {
    const password = randomBytes(24).toString("hex");
    await sandbox.commands.run("sudo pg_ctlcluster 15 main start -o '-c ssl=off -c listen_addresses=127.0.0.1'", { timeoutMs: 30_000 });
    await sandbox.commands.run(`sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE idaevia_preview LOGIN PASSWORD '${password}'" -c "CREATE DATABASE idaevia_preview OWNER idaevia_preview"`, { timeoutMs: 15_000 });
    envs[databaseKey] = `postgresql://idaevia_preview:${password}@127.0.0.1:5432/idaevia_preview`;
    envs.IDAEVIA_LOCAL_DATABASE = "1";
  }
  if (schema && /provider\s*=\s*["']sqlite["']/.test(schema) && !envs[databaseKey]) {
    envs[databaseKey] = "file:./idaevia-preview.db";
    envs.IDAEVIA_LOCAL_DATABASE = "1";
  }
  const example = files.find(f => /(?:^|\/)\.env.example$/.test(f.path))?.content ?? "";
  for (const key of ["JWT_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET"]) {
    if (new RegExp(`^${key}=`, "m").test(example) && !envs[key]) envs[key] = randomBytes(32).toString("hex");
  }
  const profile = runtimeProfile(files);
  const host = sandbox.getHost(profile.previewPort ?? 3000);
  if (profile.vite) {
    // Older Vite releases ignore the allowed-host environment variable. Merge
    // an ephemeral config with the user's real config, preserving plugins/hooks.
    const config = `import { loadConfigFromFile, mergeConfig } from 'vite';\nexport default async (env) => { const original = await loadConfigFromFile(env, ${JSON.stringify(profile.vite.configFile) ?? "undefined"}, ${JSON.stringify(profile.vite.root) ?? "undefined"}); return mergeConfig(original?.config ?? {}, {server:{allowedHosts:[${JSON.stringify(host)}]},preview:{allowedHosts:[${JSON.stringify(host)}]}}); };`;
    await sandbox.files.write(`/home/user/project/${profile.root === "." ? "" : profile.root + "/"}.idaevia-vite-preview.config.mjs`, config);
  }
  return { ...envs, ...PREVIEW_SYSTEM_ENV, ...runtimeMemoryEnvironment(memoryMB), IDAEVIA_PREVIEW_HOST: host, IDAEVIA_PREVIEW_URL: `https://${host}`, __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: host };
}
