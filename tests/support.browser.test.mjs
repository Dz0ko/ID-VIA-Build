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
  const user = await db.user.create({ data: { email: 'support@fixture.invalid', name: 'Support Preview', plan: 'PRO' } });
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
  await until("document.body?.innerText.includes('Live updates connected')");
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

async function adminPost(id, message, action = 'message') {
  const response = await fetch(`${base}/api/support/${id}`, { method: 'POST', headers: { origin: base, cookie: `idaevia_session=${adminCookie}`, 'content-type': 'application/json' }, body: JSON.stringify({ message, action, clientId: crypto.randomUUID() }) });
  assert.equal(response.status, 200); return response.json();
}
async function type(selector, value) {
  await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}

test('support handoff and manager replies arrive live, persist and appear in admin inbox', async () => {
  await click('Talk to a person');
  await until("document.body?.innerText.includes('Waiting for a manager')");
  const thread = await db.supportThread.findUniqueOrThrow({ where: { userId: customerId } });
  await type('#support-message', 'I need help connecting my project to GitHub.');
  await click('Send message');
  await until("document.querySelector('[role=log]').innerText.includes('I need help connecting')");
  await adminPost(thread.id, '', 'claim');
  await adminPost(thread.id, 'Open Integrations and connect GitHub, then use the project Terminal.');
  await until("document.querySelector('[role=log]').innerText.includes('Open Integrations')");
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/support-customer.png', Buffer.from(x.data, 'base64')));
  await rpc('Page.navigate', { url: `${base}/app/support` });
  await until("document.querySelector('[role=log]')?.innerText.includes('Open Integrations')");
  await rpc('Network.setCookie', { name: 'idaevia_session', value: adminCookie, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Page.navigate', { url: `${base}/admin/support` });
  await until("document.body?.innerText.includes('Support Preview')");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Support Preview')).click()");
  await until("document.querySelector('[role=log]')?.innerText.includes('I need help connecting')");
  await type('#support-message', 'Is the repository visible now?');
  await click('Send message');
  await until("document.querySelector('[role=log]').innerText.includes('Is the repository visible now?')");
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/support-admin.png', Buffer.from(x.data, 'base64')));
  await click('Resolve'); await until("document.querySelector('[aria-label=\"Support conversation\"]').innerText.includes('Resolved')");
  assert.equal((await db.supportThread.findUniqueOrThrow({ where: { id: thread.id } })).status, 'CLOSED');
});

test('long prompts can be filtered, customised and passed intact into a project', async () => {
  await rpc('Network.setCookie', { name: 'idaevia_session', value: customerCookie, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Page.navigate', { url: `${base}/app/prompts` });
  await until("document.body?.innerText.includes('32 prompts')");
  await type('input[type=search]', 'Sales CRM');
  await until("document.body?.innerText.includes('1 prompts')");
  await click('Preview & customise');
  await until("document.querySelector('dialog[open] textarea')!==null");
  const original = await evaluate("document.querySelector('dialog textarea').value");
  assert.ok(original.length > 2000);
  await type('dialog textarea', original + '\nUse my brand Northstar and a blue accent.');
  await click('Use prompt');
  await until("[...document.querySelectorAll('dialog button')].some(b=>b.textContent.includes('Preview project'))");
  await click('Preview project');
  await until("location.pathname.includes('/app/projects/')");
  assert.match(await evaluate("new URLSearchParams(location.search).get('prompt')"), /Northstar/);
});

test('new project accepts the full detailed brief while keeping its description concise', async () => {
  const prompt = 'Build a complete SaaS CRM. ' + 'Include secure workspaces, deals and contacts with a polished responsive dashboard. '.repeat(35);
  await rpc('Page.navigate', { url: `${base}/app?prompt=${encodeURIComponent(prompt)}` });
  await until("[...document.querySelectorAll('button')].some(b=>b.textContent==='Create and build')");
  await evaluate(String.raw`window.__originalFetch=window.fetch;window.fetch=async (url,options)=>{if(String(url).endsWith('/run')){window.__promptSent=JSON.parse(options.body).request;return new Response('data: '+JSON.stringify({type:'done',mode:'report',report:'Full brief received',creditsUsed:0})+'\n\n',{headers:{'Content-Type':'text/event-stream'}})}return window.__originalFetch(url,options)}`);
  await click('Create and build');
  await until("location.pathname.includes('/app/projects/')");
  await until("window.__promptSent!==undefined");
  assert.equal(await evaluate('window.__promptSent'), prompt);
  const projectId = await evaluate("location.pathname.split('/').pop()");
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  assert.equal(project.description.length, 500);
});
