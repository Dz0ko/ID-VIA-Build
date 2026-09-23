import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
let customerId, adminCookie, customerCookie;

if (!process.env.TEST_DATABASE_SCHEMA?.startsWith('security_test_')) throw new Error('Isolated schema required');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3848';
let server, ws, originalUrl, previousCookies = [], nextId = 0;
const initScripts = [];
const pending = new Map();
function rpc(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, method === 'Page.captureScreenshot' ? 30000 : 10000); pending.set(id, (value) => { clearTimeout(timer); if (value.error) reject(new Error(value.error.message)); else resolve(value.result); }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const r = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
async function until(expression) { for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Not ready: ${expression}`); }
async function click(text) { await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`); }

before(async () => {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3848'], { env: { ...process.env, APP_URL: base }, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/login`)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, 'Test app must be ready');
  const targets = await (await fetch(`${process.env.TEMPO_CDP_URL || 'http://127.0.0.1:50316'}/json/list`)).json();
  const target = targets.find(t => t.type === 'webview' && t.url === 'https://glass.samasante.com/' && !t.title.startsWith('INTERNAL'));
  assert.ok(target, 'Open the requested Liquid Glass reference in a Tempo Browser tab before running this visual test');
  originalUrl = target.url;
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', e => { const msg = JSON.parse(e.data); if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); } });
  await rpc('Network.enable');
  previousCookies = (await rpc('Network.getCookies', { urls: [base] })).cookies.filter(c => ['idaevia_session','idaevia_cookie_notice'].includes(c.name));
  const user = await db.user.create({ data: { email: 'support@fixture.invalid', name: 'Support Preview', plan: 'MAX' } });
  customerId = user.id;
  const admin = await db.user.create({ data: { email: 'manager@fixture.invalid', name: 'Support Manager', role: 'ADMIN' } });
  adminCookie = await new SignJWT({ sub: admin.id, ver: 0 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await db.project.create({ data: { name: 'Preview project', slug: 'preview-fixture', userId: user.id } });
  const token = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  customerCookie = token;
  await rpc('Network.setCookie', { name: 'idaevia_cookie_notice', value: '1', url: base });
  await rpc('Network.setCookie', { name: 'idaevia_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  await rpc('Page.navigate', { url: `${base}/app/support` });
  await until("document.body?.innerText.includes('Premium support')");
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
async function fillLabel(label, value) {
  await evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const el=label.querySelector('input,textarea');Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}

test('Max customers see premium support and can explicitly opt into promotions', async () => {
  assert.ok(await evaluate("document.body.innerText.includes('Premium support · priority manager queue')"));
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/premium-support.png', Buffer.from(x.data, 'base64')));
  await rpc('Page.navigate', { url: `${base}/app/profile` });
  await until("[...document.querySelectorAll('button')].some(b=>b.textContent==='Save preferences' && !b.disabled)");
  const toggle = "[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Send me product updates')).querySelector('input')";
  assert.equal(await evaluate(`${toggle}.checked`), false);
  await evaluate(`${toggle}.click()`); await click('Save preferences');
  await until("document.body.innerText.includes('Email preferences saved.')");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: customerId } })).marketingEmails, true);
});

test('admin email starts disconnected, creates a reviewed draft and blocks sending without setup', async () => {
  await rpc('Network.setCookie', { name: 'idaevia_session', value: adminCookie, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Page.navigate', { url: `${base}/admin/email` });
  await until("document.body?.innerText.includes('1 user opted in.')");
  assert.ok(await evaluate("document.body.innerText.includes('Not connected.')"));
  await fillLabel('Subject', 'A new offer for Max builders');
  await fillLabel('Message', 'Get a first look at our new components. This fixture is a draft and will not send any real email.');
  await click('Save draft');
  await until("document.body.innerText.includes('Draft saved.')");
  await until("[...document.querySelectorAll('button')].some(b=>b.textContent==='Review & send' && !b.disabled)");
  await click('Review & send');
  await until("document.querySelector('iframe[title=\"Email preview\"]')!==null");
  assert.ok(await evaluate("document.querySelector('iframe[title=\"Email preview\"]').srcdoc.includes('A new offer for Max builders')"));
  assert.ok(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Send to 1 opted-in users').disabled"));
  assert.equal(await db.emailDelivery.count({ where: { marketing: true } }), 0);
  await evaluate('window.scrollTo(0,0)');
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/email-admin.png', Buffer.from(x.data, 'base64')));
});

test('unsubscribe confirmation changes only promotional preference', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { id: customerId } });
  await rpc('Page.navigate', { url: `${base}/email/unsubscribe?token=${user.emailOptOutToken}` });
  await until("document.body?.innerText.includes('Unsubscribe from promotions')");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: customerId } })).marketingEmails, true);
  await click('Unsubscribe'); await until("document.body.innerText.includes('You’re unsubscribed.')");
  const updated = await db.user.findUniqueOrThrow({ where: { id: customerId } });
  assert.equal(updated.marketingEmails, false); assert.equal(updated.plan, 'MAX');
});
