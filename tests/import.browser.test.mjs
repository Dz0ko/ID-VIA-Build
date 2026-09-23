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
async function until(expression) { for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Not ready: ${expression}: ${await evaluate("document.body.innerText.slice(-2400)")}`); }

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
  await db.project.create({ data: { name: 'Preview project', slug: 'preview-fixture', userId: user.id } });
  const token = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await rpc('Network.setCookie', { name: 'idaevia_cookie_notice', value: '1', url: base });
  await rpc('Network.setCookie', { name: 'idaevia_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  await rpc('Page.navigate', { url: `${base}/app/import` });
  await until("document.querySelector('input[aria-label=\"Reference screenshots\"]')!==null");
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


test('screenshot import creates named project, hands image to chat automatically and download asks for filename', async () => {
  await new Promise(r => setTimeout(r, 1200));
  const intercept = `const original=window.fetch;window.fetch=async(url,opts)=>{if(String(url).endsWith('/run')){window.__importRun=JSON.parse(opts.body);return new Response('data: '+JSON.stringify({type:'done',mode:'report',report:'Fixture screenshot received',creditsUsed:0})+String.fromCharCode(10,10),{headers:{'Content-Type':'text/event-stream'}})}return original(url,opts)}`;
  initScripts.push((await rpc('Page.addScriptToEvaluateOnNewDocument', { source: intercept })).identifier);
  await evaluate(intercept);
  await evaluate(`(()=>{const el=document.querySelector('input[maxlength="80"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Screenshot landing');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;const ctx=canvas.getContext('2d');ctx.fillStyle='#4834ff';ctx.fillRect(0,0,320,200);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const transfer=new DataTransfer();transfer.items.add(new File([blob],'landing.png',{type:'image/png'}));const el=document.querySelector('input[aria-label="Reference screenshots"]');el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Build from screenshots').click()");
  await until("window.__importRun!==undefined");
  const request = await evaluate('window.__importRun');
  assert.equal(request.images.length, 1); assert.equal(request.images[0].mediaType, 'image/png');
  assert.match(request.request, /STACK CHOICE: HTML/);
  assert.ok(await evaluate("document.body.innerText.includes('Screenshot landing')"));
  await until("document.body.innerText.includes('Fixture screenshot received')");
  await evaluate("document.querySelector('button[title=\"Export code\"]').click()");
  await until("document.querySelector('dialog[open] input[maxlength=\"80\"]')!==null");
  assert.equal(await evaluate("document.querySelector('dialog[open] input[maxlength=\"80\"]').value"), 'Screenshot landing');
  assert.ok(await evaluate("document.querySelector('dialog[open] input[type=checkbox]').checked"));
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/project-download.png', Buffer.from(x.data, 'base64')));
  await evaluate("[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Cancel').click()");
  await rpc('Page.navigate', { url: `${base}/app/import` });
  await until("document.querySelector('input[aria-label=\"Reference screenshots\"]')!==null");
  await new Promise(r => setTimeout(r, 700));
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/import-panel.png', Buffer.from(x.data, 'base64')));
});
