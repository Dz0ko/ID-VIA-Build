import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

// Versioned, memory-hard hashes preserve the entire UTF-8 password. Existing
// bcrypt hashes remain readable and are upgraded after a successful login.
const PREFIX = "scrypt-v1$";
const derive = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key));
});
export const isCurrentPasswordHash = (value: string) => /^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value);
export async function hashPassword(password: string) {
  if (!password || Buffer.byteLength(password, "utf8") > 1024) throw new Error("Invalid password length.");
  const salt = randomBytes(16);
  return `${PREFIX}${salt.toString("hex")}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  if (!password || Buffer.byteLength(password, "utf8") > 1024) return false;
  if (isCurrentPasswordHash(hash)) {
    const [, salt, expected] = hash.split("$");
    return timingSafeEqual(await derive(password, Buffer.from(salt, "hex")), Buffer.from(expected, "hex"));
  }
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) return bcrypt.compare(password, hash);
  return false;
}
// An absent account still pays the password-derivation cost, reducing enumeration
// through the obvious missing-user versus real-user timing difference.
export const DUMMY_PASSWORD_HASH = `${PREFIX}${"0".repeat(32)}$${"0".repeat(128)}`;
