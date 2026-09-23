import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { db } = await import("../src/lib/db");
  const { hashPassword, isCurrentPasswordHash } = await import("../src/lib/password");
  const apply = process.argv.includes("--apply");
  let cursor: string | undefined, legacy = 0, updated = 0;
  try {
    while (true) {
      const rows = await db.shareLink.findMany({ where: { password: { not: null } }, select: { id: true, password: true }, orderBy: { id: "asc" }, take: 50, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      if (!rows.length) break;
      for (const row of rows) {
        if (!row.password || isCurrentPasswordHash(row.password)) continue;
        legacy++;
        if (apply) updated += (await db.shareLink.updateMany({ where: { id: row.id, password: row.password }, data: { password: await hashPassword(row.password) } })).count;
      }
      cursor = rows.at(-1)!.id;
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "check", legacy, updated }));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Portal password migration failed; no credentials were logged."); process.exitCode = 1; });
