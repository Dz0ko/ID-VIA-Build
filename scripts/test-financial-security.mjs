import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
config({ quiet: true });
const shellOnly = process.argv.includes('--shell') || process.env.TEST_SHELL_ONLY;
const source = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!source) throw new Error('A database connection is required for isolated-schema tests');
const schema = `security_test_${randomBytes(6).toString('hex')}`;
const base = new PrismaClient({ datasources: { db: { url: source } } });
const url = new URL(source); url.searchParams.set('schema', schema); url.searchParams.set('connection_limit', '2');
const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), TEST_DATABASE_SCHEMA: schema, AUTH_SECRET: 'isolated-test-secret-not-used-in-production-12345', APP_URL: 'http://localhost:3848', WHOP_API_KEY: 'test-key', WHOP_COMPANY_ID: 'biz_test', WHOP_WEBHOOK_SECRET: 'test-webhook-secret', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', EMAIL_ENABLED: 'false', RESEND_API_KEY: '' };
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    // Prisma reports the DB host/URL on errors; keep infrastructure output private.
    let output = ''; child.stdout.on('data', (x) => { output += x; }); child.stderr.on('data', (x) => { output += x; });
    child.on('error', reject);
    child.on('exit', (code) => {
      const safe = output.replaceAll(source, '[database]').replaceAll(url.toString(), '[isolated database]');
      if (args.includes('--test')) process.stdout.write(safe);
      if (code) reject(new Error(`Test command failed (exit ${code})${args.includes('--test') ? '' : '; schema setup failed'}`)); else resolve();
    });
  });
}
try {
  await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  console.log('Created isolated test schema. Production tables are not used.');
  await run(['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate']);
  console.log(shellOnly ? 'Running live terminal and access-control tests…' : 'Running transaction, replay, refund and access-control tests…');
  await run(['--conditions=react-server', '--import', 'tsx', '--test', ...(process.env.TEST_NAME_PATTERN ? ['--test-name-pattern', process.env.TEST_NAME_PATTERN] : []), process.argv.includes('--hardening') ? 'tests/security-hardening.test.ts' : process.argv.includes('--email-browser') ? 'tests/email.browser.test.mjs' : process.argv.includes('--email') ? 'tests/email.test.ts' : process.argv.includes('--support-browser') ? 'tests/support.browser.test.mjs' : process.argv.includes('--support') ? 'tests/support.test.ts' : process.argv.includes('--imports') ? 'tests/import.browser.test.mjs' : process.argv.includes('--chat-components') ? 'tests/chat-components.browser.test.mjs' : process.argv.includes('--admin') ? 'tests/admin.browser.test.mjs' : process.argv.includes('--components') ? 'tests/component-library.browser.test.mjs' : shellOnly ? 'tests/shell-http.test.ts' : 'tests/financial-security.test.ts']);
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally {
  await base.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await base.$disconnect(); console.log('Removed isolated test schema.');
}
