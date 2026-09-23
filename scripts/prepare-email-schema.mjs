import { PrismaClient } from '@prisma/client';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error('Database connection required for email schema preparation.');
const schema = new URL(url).searchParams.get('schema') || 'public';
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error('Unsupported database schema identifier.');
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  const rows = await db.$queryRaw`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ${schema} AND table_name = 'User') AS present`;
  if (rows[0]?.present) {
    // Existing accounts keep NULL until their first promotional email. These additive
    // statements avoid db push's generic unique-index data-loss warning. Duplicates,
    // if any already exist, cause a rollback instead of dropping or rewriting data.
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`ALTER TABLE "${schema}"."User" ADD COLUMN IF NOT EXISTS "emailOptOutToken" TEXT`);
      await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_emailOptOutToken_key" ON "${schema}"."User" ("emailOptOutToken")`);
    }, { timeout: 20000 });
  }
  console.log('Email unsubscribe schema prepared without rewriting account data.');
} catch {
  console.error('Email schema preparation failed. No destructive fallback was attempted.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
