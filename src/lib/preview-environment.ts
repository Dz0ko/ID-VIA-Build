import "server-only";
import { randomBytes } from "node:crypto";
import type { Sandbox } from "e2b";

// This image has 2 GiB RAM and PostgreSQL. The default E2B base image has only 512 MiB.
export const PREVIEW_TEMPLATE = process.env.E2B_RUNTIME_TEMPLATE || "inys70thgko5tow4cn24";
export const PREVIEW_SYSTEM_ENV = { NODE_OPTIONS: "--max-old-space-size=1536", NEXT_TELEMETRY_DISABLED: "1", NPM_CONFIG_PROGRESS: "false", NPM_CONFIG_LOGLEVEL: "warn" };

/** Only project-owned settings and sandbox-local credentials; never platform environment variables. */
export async function preparePreviewEnvironment(sandbox: Sandbox, files: { path: string; content: string }[], settings: Record<string, string>): Promise<Record<string, string>> {
  const envs = Object.fromEntries(Object.entries(settings).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !["NODE_OPTIONS", "LD_PRELOAD", "PATH", "HOME", "IDAEVIA_LOCAL_DATABASE"].includes(key)));
  const schema = files.find(f => f.path.replace(/^\/+/, "") === "prisma/schema.prisma")?.content;
  if (schema && /provider\s*=\s*["']postgresql["']/.test(schema) && !envs.DATABASE_URL) {
    const password = randomBytes(24).toString("hex");
    await sandbox.commands.run("sudo pg_ctlcluster 15 main start -o '-c ssl=off -c listen_addresses=127.0.0.1'", { timeoutMs: 30_000 });
    await sandbox.commands.run(`sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE idaevia_preview LOGIN PASSWORD '${password}'" -c "CREATE DATABASE idaevia_preview OWNER idaevia_preview"`, { timeoutMs: 15_000 });
    envs.DATABASE_URL = `postgresql://idaevia_preview:${password}@127.0.0.1:5432/idaevia_preview`;
    envs.IDAEVIA_LOCAL_DATABASE = "1";
  }
  const example = files.find(f => /(?:^|\/)\.env.example$/.test(f.path))?.content ?? "";
  for (const key of ["JWT_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET"]) {
    if (new RegExp(`^${key}=`, "m").test(example) && !envs[key]) envs[key] = randomBytes(32).toString("hex");
  }
  return { ...envs, ...PREVIEW_SYSTEM_ENV };
}
