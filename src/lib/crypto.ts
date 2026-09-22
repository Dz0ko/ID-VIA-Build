import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** AES-256-GCM key derived from INTEGRATIONS_KEY (preferred) or AUTH_SECRET. */
function key() {
  const src = process.env.INTEGRATIONS_KEY || process.env.AUTH_SECRET;
  if (!src || src.length < 16) throw new Error("INTEGRATIONS_KEY or AUTH_SECRET must be set to store secrets.");
  return createHash("sha256").update(src).digest();
}

/** Encrypt any JSON-serialisable value. Output: base64(iv).base64(tag).base64(ciphertext) */
export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

export function decryptJson<T = unknown>(blob: string | null | undefined): T | null {
  if (!blob) return null;
  try {
    const [iv, tag, data] = blob.split(".").map((s) => Buffer.from(s, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(out) as T;
  } catch {
    return null;
  }
}
