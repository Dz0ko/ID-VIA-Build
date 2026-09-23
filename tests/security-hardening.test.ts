import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { databaseConnection } from "../src/lib/database-connection";
import { CREDIT_PACKS } from "../src/lib/plans";
import { hashPassword, verifyPassword, isCurrentPasswordHash } from "../src/lib/password";
import { readRequestText } from "../src/lib/request-body";
import { fetchProfile, upsertOAuthUser } from "../src/lib/oauth";
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw new Error("Isolated schema required");
const base = "http://localhost:3848";
let server: ChildProcess;
before(async () => {
  const isolation = await db.$queryRaw<{ schema: string }[]>`SELECT current_schema()::text AS schema`;
  assert.equal(isolation[0].schema, process.env.TEST_DATABASE_SCHEMA, "Database schema isolation must hold before tests run");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3848"], { env: process.env, stdio: "ignore" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/login")).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error("App did not start");
});
after(async () => { server?.kill("SIGTERM"); await db.$disconnect(); });
async function account(extra = {}) {
  const user = await db.user.create({ data: { email: `${randomUUID()}@hardening.invalid`, ...extra } });
  const cookie = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return { ...user, cookie };
}
async function api(path: string, cookie = "", method = "GET", body?: unknown, extra: Record<string,string> = {}) {
  return fetch(base + path, { method, headers: { origin: base, cookie: `idaevia_session=${cookie}`, "Content-Type": "application/json", ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), redirect: "manual" });
}
function routes(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? routes(join(dir,e.name)) : e.name === "route.ts" ? [join(dir,e.name)] : []); }

test("every private API method rejects anonymous access; every admin API rejects regular users", async () => {
  const user = await account(); let privateChecks = 0, adminChecks = 0;
  for (const file of routes("src/app/api")) {
    const route = file.replace("src/app", "").replace("/route.ts", "").replace(/\[[^\]]+\]/g, "missing-security-fixture");
    if (/^\/api\/(auth\/|cron\/|webhooks\/|portal\/|templates\/)/.test(route) || route === "/api/email/unsubscribe" || route === "/api/integrations/github" || route.endsWith("/dev-pay")) continue;
    for (const [,method] of readFileSync(file,"utf8").matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)) {
      if (method === "GET" && (route === "/api/marketplace" || /^\/api\/marketplace\/[^/]+\/preview$/.test(route))) continue;
      const requestRoute = route === "/api/billing/checkout" ? `${route}?plan=PRO` : route === "/api/billing/pack" ? `${route}?credits=${CREDIT_PACKS[0].credits}` : route;
      const response = await api(requestRoute,"",method,method==='GET'?undefined:{});
      if (["/api/billing/checkout", "/api/billing/pack"].includes(route) && method === "GET") { assert.equal(response.status,307); assert.ok(["/login","/signup"].includes(new URL(response.headers.get("location")!,base).pathname)); }
      else assert.equal(response.status,401,`${method} ${route}: anonymous`);
      privateChecks++;
      if (route.startsWith("/api/admin/")) { assert.equal((await api(route,user.cookie,method,method==='GET'?undefined:{})).status,403,`${method} ${route}: non-admin`); adminChecks++; }
    }
  }
  assert.ok(privateChecks >= 60); assert.ok(adminChecks >= 12);
  console.log(`Verified ${privateChecks} private API methods and ${adminChecks} admin role checks.`);
});

test("password hashes retain long Unicode suffixes and legacy bcrypt remains readable", async () => {
  const a='🔐'.repeat(25)+'-alpha', b='🔐'.repeat(25)+'-beta';
  const hash=await hashPassword(a);
  assert.ok(isCurrentPasswordHash(hash)); assert.equal(await verifyPassword(a,hash),true); assert.equal(await verifyPassword(b,hash),false);
  assert.equal(await verifyPassword(a,await bcrypt.hash(a,10)),true);
  assert.equal(await verifyPassword('x'.repeat(2000),hash),false);
  assert.equal(await verifyPassword(a,'scrypt-v1$bad$bad'),false);
  assert.notEqual(hash,await hashPassword(a));
});

test("successful legacy login upgrades its hash, cookies are secure and password change revokes old sessions", async () => {
  const old='Legacy password fixture 123!';const user=await account({passwordHash:await bcrypt.hash(old,10)});
  const login=await api('/api/auth/login','','POST',{email:user.email,password:old});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')!; assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=lax/i);
  assert.ok(isCurrentPasswordHash((await db.user.findUniqueOrThrow({where:{id:user.id}})).passwordHash!));
  const next='🔐'.repeat(24)+'-new';
  assert.equal((await api('/api/me',user.cookie,'PATCH',{currentPassword:old,newPassword:next})).status,200);
  assert.equal((await api('/api/me',user.cookie)).status,401);
  assert.equal((await api('/api/auth/login','','POST',{email:user.email,password:old})).status,401);
  assert.equal((await api('/api/auth/login','','POST',{email:user.email,password:next})).status,200);
});

test("login throttling is enforced and includes Retry-After without returning credentials", async () => {
  const user=await account({passwordHash:await hashPassword('a valid test password')});
  let response: Response|undefined;
  for(let i=0;i<9;i++) response=await api('/api/auth/login','','POST',{email:user.email,password:'wrong'});
  assert.equal(response!.status,429);assert.ok(Number(response!.headers.get('retry-after'))>0);
  assert.match(response!.headers.get('cache-control')!,/no-store/);
  assert.doesNotMatch(await response!.text(),/passwordHash|scrypt-v1/);
});

test("portal passwords are hashed, never returned, and legacy passwords migrate without exposing project data",async()=>{
  const owner=await account(), stranger=await account();
  const project=await db.project.create({data:{userId:owner.id,name:'Portal fixture',slug:randomUUID(),html:'<h1>PRIVATE_PORTAL_CONTENT</h1>'}});
  const path=`/api/projects/${project.id}/share`;
  const r=await api(path,owner.cookie,'POST',{password:'portal fixture password'});assert.equal(r.status,200);const payload=await r.json();
  assert.equal(payload.link.password,undefined);assert.equal(payload.link.hasPassword,true);
  const row=await db.shareLink.findUniqueOrThrow({where:{id:payload.link.id}});assert.ok(isCurrentPasswordHash(row.password!));
  assert.equal((await api(path,stranger.cookie)).status,404);
  const preview=`/api/portal/${row.token}/preview`;
  assert.equal((await api(preview)).status,401);
  assert.equal((await api(preview,'','GET',undefined,{'x-portal-password':'wrong'})).status,401);
  const allowed=await api(preview,'','GET',undefined,{'x-portal-password':'portal fixture password'});assert.equal(allowed.status,200);assert.match(allowed.headers.get('content-security-policy')!,/sandbox/);
  const legacy=await db.shareLink.create({data:{projectId:project.id,token:randomUUID(),password:'legacy portal'}});
  assert.equal((await api(`/api/portal/${legacy.token}`,'','GET',undefined,{'x-portal-password':'legacy portal'})).status,200);
  assert.ok(isCurrentPasswordHash((await db.shareLink.findUniqueOrThrow({where:{id:legacy.id}})).password!));
});

test("OAuth requires verified provider emails and cannot replace a bound identity using the same address",async()=>{
  const original=globalThis.fetch;let verified: boolean|undefined=false;
  globalThis.fetch=async input=>{const url=String(input);if(url.includes('token'))return Response.json({access_token:'fixture'});if(url.includes('googleapis'))return Response.json({sub:'google-fixture',email:'verified@fixture.invalid',email_verified:verified});if(url.endsWith('/user/emails'))return Response.json([{email:'github@fixture.invalid',primary:true,verified}]);return Response.json({id:123,login:'fixture',email:'public-but-unverified@fixture.invalid'});};
  try {
    for(const value of [false,undefined]) {verified=value;await assert.rejects(fetchProfile('google','fixture',base),/verified email/);await assert.rejects(fetchProfile('github','fixture',base),/verified email/);}
    verified=true;assert.equal((await fetchProfile('github','fixture',base)).email,'github@fixture.invalid');
  } finally {globalThis.fetch=original;}
  const owner=await account({googleId:'bound-identity'});
  await assert.rejects(upsertOAuthUser('google',{providerId:'different-identity',email:owner.email,name:null,avatarUrl:null}),/existing sign-in method/);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:owner.id}})).googleId,'bound-identity');
});

test("a pending email invitation does not expose team members or project metadata",async()=>{
  const owner=await account(), claimant=await account();
  const team=await db.team.create({data:{name:'PRIVATE_TEAM_SENTINEL',slug:randomUUID(),ownerId:owner.id,members:{create:{email:claimant.email,status:'PENDING',role:'VIEWER'}}}});
  const result=await api('/api/teams',claimant.cookie);assert.equal(result.status,200);assert.doesNotMatch(await result.text(),/PRIVATE_TEAM_SENTINEL/);
  assert.equal((await api(`/api/teams/${team.id}`,claimant.cookie)).status,404);
});

test("streamed payload limits reject oversized chunked bodies and bound authentication and webhook input",async()=>{
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(20));c.enqueue(new Uint8Array(20));c.close();}});
  const request=new Request(base,{method:'POST',body:stream,duplex:'half'} as RequestInit);
  await assert.rejects(readRequestText(request,30),/too large/);
  assert.equal((await api('/api/auth/login','','POST',{email:'a@fixture.invalid',password:'x'.repeat(20000)})).status,400);
  const webhook=await api('/api/webhooks/whop','','POST',{blob:'x'.repeat(270000)},{'webhook-id':'fixture','webhook-signature':'v1,invalid','webhook-timestamp':String(Math.floor(Date.now()/1000))});assert.equal(webhook.status,413);
});

test("CSRF, forged cookies and user-generated previews cannot acquire platform privileges",async()=>{
  const owner=await account();
  for(const origin of ['https://evil.invalid','https://sub.idaevia.app','null']) assert.equal((await api('/api/me',owner.cookie,'PATCH',{name:'hijacked'},{origin})).status,403);
  assert.equal((await api('/api/me',owner.cookie+'corrupt')).status,401);
  const headers=(await api('/login')).headers;assert.match(headers.get('strict-transport-security')!,/max-age=/);assert.match(headers.get('content-security-policy')!,/frame-ancestors 'self'/);assert.equal(headers.get('x-content-type-options'),'nosniff');
});


test("database connections enforce certificate validation and retain the isolated schema", async () => {
  const config=databaseConnection("postgresql://user:fixture@db.example.invalid/db?sslmode=disable&sslaccept=accept_invalid_certs&schema=security_test_config&connection_limit=2",true);
  assert.deepEqual(config.pool.ssl,{rejectUnauthorized:true});assert.equal(config.pool.max,2);
  assert.equal(new URL(config.pool.connectionString).searchParams.get("sslmode"),null);
  assert.equal(config.pool.options,"-c search_path=security_test_config");
  assert.throws(()=>databaseConnection("postgresql://localhost/db?schema=public%3BDROP",false));
  const rows=await db.$queryRaw<{schema:string}[]>`SELECT current_schema()::text AS schema`;
  assert.equal(rows[0].schema,process.env.TEST_DATABASE_SCHEMA);
});
