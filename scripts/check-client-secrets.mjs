import nextEnv from '@next/env';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
nextEnv.loadEnvConfig(process.cwd());
const keys = ['AUTH_SECRET','INTEGRATIONS_KEY','OPENAI_API_KEY','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','E2B_API_KEY','WHOP_API_KEY','WHOP_WEBHOOK_SECRET','CRON_SECRET','GOOGLE_CLIENT_SECRET','GITHUB_CLIENT_SECRET','RESEND_API_KEY','DATABASE_URL','DIRECT_URL','ADMIN_PASSWORD'];
const secrets = keys.filter(key => process.env[key]?.length >= 8).map(key => [key, process.env[key]]);
function files(dir) { return readdirSync(dir, { withFileTypes:true }).flatMap(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]); }
if (!existsSync('.next/static')) throw new Error('Build the app before checking browser assets.');
let tracked = [];
try { tracked = execFileSync('git',['ls-files','-z'],{stdio:['ignore','pipe','ignore']}).toString().split('\0').filter(path => path && existsSync(path) && !path.startsWith('tempo/')); } catch { /* Deployment archives may omit .git. */ }
if (!tracked.length) tracked = ['src','scripts','prisma'].filter(existsSync).flatMap(files);
const targets = new Set([...files('.next/static'), ...files('public'), ...tracked]);
let found = false;
for (const path of targets) {
  const content = readFileSync(path).toString();
  for (const [key,secret] of secrets) if (content.includes(secret)) { console.error(`Secret exposure detected: ${key} in ${path}`); found = true; }
}
console.log(`Checked ${targets.size} source/browser files against ${secrets.length} configured server secrets. Values were not logged.`);
if (!secrets.length) console.log('No deployment secrets configured: exact-value exposure checks were unavailable.');
process.exitCode = found ? 1 : 0;
