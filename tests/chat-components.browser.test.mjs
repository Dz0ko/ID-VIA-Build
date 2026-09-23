import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

if (!process.env.TEST_DATABASE_SCHEMA?.startsWith('security_test_')) throw new Error('Isolated schema required');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3848';
let server, ws, originalUrl, previousCookies = [], nextId = 0;
const initScripts = [];
const pending = new Map();
function rpc(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000); pending.set(id, (value) => { clearTimeout(timer); if (value.error) reject(new Error(value.error.message)); else resolve(value.result); }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const r = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
async function until(expression) { for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Not ready: ${expression}; ${await evaluate("document.body.innerText.slice(-2500)")}`); }

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
  const user = await db.user.create({ data: { email: 'components@fixture.invalid', name: 'Component Preview', plan: 'PRO', role: 'ADMIN' } });
  await db.project.create({ data: { name: 'Preview project', slug: 'preview-fixture', userId: user.id, versions: { create: { number: 1, html: '<html><body>Draft</body></html>', message: 'Builder: update navbar' } } } });
  const token = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await rpc('Network.setCookie', { name: 'idaevia_cookie_notice', value: '1', url: base });
  await rpc('Network.setCookie', { name: 'idaevia_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  await rpc('Page.navigate', { url: `${base}/app/projects/${(await db.project.findFirstOrThrow()).id}` });
  await until("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Add components'))");
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

test('chat component picker previews, tags and sends references to the current project', async () => {
  await new Promise(r => setTimeout(r, 1500));
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Add components')).click()");
  await until("document.querySelectorAll('[data-component-id]').length===9");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Liquid Glass').click()");
  await until("document.querySelectorAll('[data-component-id]').length===4");
  await evaluate("[...document.querySelector('[data-component-id=glass-switch]').querySelectorAll('button')].find(b=>b.textContent==='Select component').click()");
  await evaluate("[...document.querySelector('[data-component-id=glass-slider]').querySelectorAll('button')].find(b=>b.textContent==='Select component').click()");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Done').click()");
  await until("!document.querySelector('dialog[open]')");
  assert.equal(await evaluate("document.querySelectorAll('[data-selected-component]').length"), 2);
  await evaluate("document.querySelector('[data-selected-component=glass-slider] button').click()");
  assert.equal(await evaluate("document.querySelectorAll('[data-selected-component]').length"), 1);
  await evaluate(String.raw`window.__originalFetch=window.fetch;window.fetch=async (url,options)=>{if(String(url).endsWith('/run')){window.__sent={url,body:JSON.parse(options.body)};return new Response('data: '+JSON.stringify({type:'done',mode:'report',report:'Fixture implementation received',creditsUsed:0})+'\n\n',{headers:{'Content-Type':'text/event-stream'}})}return window.__originalFetch(url,options)}`);
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/chat-components.png', Buffer.from(x.data, 'base64')));
  await evaluate("document.querySelector('form.workspace-composer').requestSubmit()");
  await until("window.__sent!==undefined && document.body.innerText.includes('Fixture implementation received')");
  const sent = await evaluate('window.__sent');
  assert.match(sent.body.request, /Implement the selected components/);
  assert.match(sent.body.request, /\[COMPONENT:glass-switch\]/);
  assert.doesNotMatch(sent.body.request, /\[COMPONENT:glass-slider\]/);
  assert.equal(await evaluate("document.querySelectorAll('[data-selected-component]').length"), 0);
});

test('sidebar treats saved edits as change history rather than build versions', async () => {
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Files').click()");
  await until("document.body.textContent.includes('Change history')");
  assert.ok(await evaluate("document.body.textContent.includes('Build versions')"));
  assert.ok(await evaluate("document.body.innerText.includes('No successful tracked builds yet.')"));
  assert.ok(await evaluate("document.body.innerText.includes('Builder: update navbar')"));
  assert.ok(await evaluate("![...document.querySelectorAll('aside span')].some(s=>/^v0?1$/.test(s.textContent))"));
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/change-history.png', Buffer.from(x.data, 'base64')));
});
