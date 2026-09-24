import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** A server-only connection policy. URL flags cannot disable certificate verification. */
export function databaseConnection(raw: string, production = process.env.NODE_ENV === "production") {
  const url = new URL(raw);
  const schema = url.searchParams.get("schema") || "public";
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error("Invalid database schema.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const supabase = url.hostname.endsWith(".supabase.com") || url.hostname.endsWith(".supabase.co");
  // One serverless instance serves several requests at once; credit settlements hold a connection
  // for their short transaction, so a burst must not exhaust the pool (the Supabase pooler multiplexes).
  const max = Math.max(1, Math.min(10, Number(url.searchParams.get("connection_limit")) || 8));
  // node-postgres lets SSL URL flags replace an explicit SSL object. Remove them
  // before supplying our own fail-closed policy, including the trusted CA.
  for (const key of ["sslmode", "sslaccept", "sslcert", "sslrootcert", "sslkey", "sslpassword", "sslidentity", "ssl", "schema", "connection_limit", "pgbouncer", "pool_timeout", "options"]) url.searchParams.delete(key);
  // Public Supabase Root 2021 CA, downloaded from the URL in their Studio source:
  // supabase/supabase/apps/studio/hooks/custom-content/custom-content.json.
  // SHA-256: 807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa.
  const ca = supabase ? readFileSync(resolve(process.cwd(), "certs/supabase-ca.crt"), "utf8") : undefined;
  return {
    schema,
    pool: {
      connectionString: url.toString(),
      ssl: local && !production ? false as const : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
      max, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000,
      options: `-c search_path=${schema}`,
    },
  };
}
