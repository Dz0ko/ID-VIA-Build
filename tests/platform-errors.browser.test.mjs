import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { recordPlatformError } from '../src/lib/platform-errors.ts';
let customerId, adminCookie, projectId, incidentId;

if (!process.env.TEST_DATABASE_SCHEMA?.startsWith('security_test_')) throw new Error('Isolated schema required');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3848';
let server, ws, originalUrl, previousCookies = [], nextId = 0;
const initScripts = [];
const pending = new Map();
function rpc(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, method === 'Page.captureScreenshot' ? 30000 : 10000); pending.set(id, (value) => { clearTimeout(timer); if (value.error) reject(new Error(value.error.message)); else resolve(value.result); }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const r = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
async function until(expression) { for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Not ready: ${expression}`); }
async function click(text) { await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`); }

before(async () => {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3848'], { env: { ...process.env, APP_URL: base }, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/login`)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, 'Test app must be ready');
  assert.ok(process.env.UI_TEST_CDP_URL, 'Provide a dedicated headless test browser');
  const targets = await (await fetch(`${process.env.UI_TEST_CDP_URL}/json/list`)).json();
  const target = targets.find(t => !t.title.startsWith('INTERNAL') && t.type === 'page' && t.url === 'about:blank');
  assert.ok(target, 'A blank test browser page is required');
  originalUrl = target.url;
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', e => { const msg = JSON.parse(e.data); if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); } });
  await rpc('Network.enable');
  previousCookies = (await rpc('Network.getCookies', { urls: [base] })).cookies.filter(c => ['idaevia_session','idaevia_cookie_notice'].includes(c.name));
  const user = await db.user.create({ data: { email: 'support@fixture.invalid', name: 'Support Preview', plan: 'PRO' } });
  customerId = user.id;
  const admin = await db.user.create({ data: { email: 'manager@fixture.invalid', name: 'Support Manager', role: 'ADMIN' } });
  adminCookie = await new SignJWT({ sub: admin.id, ver: 0 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const project = await db.project.create({ data: { name: 'Makeup marketplace', slug: 'preview-fixture', userId: user.id } });
  projectId = project.id;
  incidentId = await recordPlatformError(new Error('FATAL ERROR: JavaScript heap out of memory'), { source: 'build', userId: user.id, projectId });
  await rpc('Network.setCookie', { name: 'idaevia_cookie_notice', value: '1', url: base });
  await rpc('Network.setCookie', { name: 'idaevia_session', value: adminCookie, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await rpc('Page.navigate', { url: `${base}/admin/errors` });
  await until("document.body?.innerText.includes('Build or preview ran out of memory')");
});
after(async () => {
  if (ws?.readyState === WebSocket.OPEN) {
    await rpc('Network.deleteCookies', { name: 'idaevia_session', url: base });
    await rpc('Network.deleteCookies', { name: 'idaevia_cookie_notice', url: base });
    for (const cookie of previousCookies) await rpc('Network.setCookie', { name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path, secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite, ...(cookie.expires > 0 ? { expires: cookie.expires } : {}) });
    for (const identifier of initScripts) await rpc('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    await rpc('Emulation.setEmulatedMedia', { features: [] });
    await rpc('Emulation.clearDeviceMetricsOverride');
    await rpc('Page.navigate', { url: originalUrl }); ws.close();
  }
  server?.kill('SIGTERM'); await db.$disconnect();
});

async function type(selector, value) {
  await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}

test('admin reviews diagnostic details, tracks resolution and sees live recurrence', async () => {
  await click('Build or preview ran out of memory');
  await until("document.querySelector('[aria-label=\"Incident details\"]')?.innerText.includes('What to check')");
  assert.ok(await evaluate("document.body.innerText.includes('4 GB')"));
  assert.ok(await evaluate("!!document.querySelector('a[href=\"/admin/projects/" + projectId + "\"]')"));
  await type('#incident-note', 'Checked runtime template and increased the heap limit.');
  await click('Mark in progress');
  await until("document.querySelector('tbody')?.innerText.includes('In progress')");
  assert.equal((await db.platformIncident.findUniqueOrThrow({ where: { id: incidentId } })).status, 'INVESTIGATING');
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/platform-errors.png', Buffer.from(x.data, 'base64')));
  await click('Mark resolved');
  await until("document.querySelector('tbody')?.innerText.includes('No recorded errors')");
  assert.equal((await db.platformIncident.findUniqueOrThrow({ where: { id: incidentId } })).status, 'RESOLVED');
  await recordPlatformError(new Error('FATAL ERROR: JavaScript heap out of memory'), { source: 'build', userId: customerId, projectId });
  await until("document.querySelector('tbody')?.innerText.includes('2×')");
  assert.equal((await db.platformIncident.findUniqueOrThrow({ where: { id: incidentId } })).status, 'NEW');
  await rpc('Page.navigate', { url: `${base}/admin/users` });
  await until("document.body?.innerText.includes('platform incident')");
  await evaluate(`window.dispatchEvent(new ErrorEvent('error', { filename: location.origin+'/_next/static/chunks/test.js', error: new Error('Monitoring browser smoke fixture') }));`);
  await new Promise(r => setTimeout(r, 1200));
  const browserIncident = await db.platformIncident.findFirstOrThrow({ where: { source: 'browser' } });
  assert.equal(browserIncident.area, 'UNKNOWN');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
});
