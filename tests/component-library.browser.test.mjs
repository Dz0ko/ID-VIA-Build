import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { COMPONENT_EXAMPLES } from '../src/lib/component-examples.ts';

if (!process.env.TEST_DATABASE_SCHEMA?.startsWith('security_test_')) throw new Error('Isolated schema required');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3848';
let server, ws, originalUrl, previousCookies = [], nextId = 0;
const initScripts = [];
const pending = new Map();
function rpc(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, method === 'Page.captureScreenshot' ? 30000 : 10000); pending.set(id, (value) => { clearTimeout(timer); if (value.error) reject(new Error(value.error.message)); else resolve(value.result); }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const r = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
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
  const user = await db.user.create({ data: { email: 'components@fixture.invalid', name: 'Component Preview', plan: 'PRO' } });
  await db.project.create({ data: { name: 'Preview project', slug: 'preview-fixture', userId: user.id } });
  const token = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await rpc('Network.setCookie', { name: 'idaevia_cookie_notice', value: '1', url: base });
  await rpc('Network.setCookie', { name: 'idaevia_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  await rpc('Page.navigate', { url: `${base}/app/components` });
  await until("document.querySelectorAll('[data-component-id]').length===9");
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

test('catalog renders, filters, previews, exposes exact source and hands off its marker', async () => {
  assert.equal(await evaluate("document.querySelectorAll('[data-component-id]').length"), 9);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'catalog must not overflow');
  assert.ok(await evaluate("[...document.querySelectorAll('iframe')].every(f=>f.getAttribute('sandbox')==='allow-scripts')"));
  assert.ok(await evaluate("document.querySelectorAll('iframe').length<=9"));
  await click('Forms & controls'); await until("document.querySelectorAll('[data-component-id]').length===4");
  await evaluate("document.querySelector('[data-component-id=glass-switch] button[aria-label^=Expand]').click()");
  await until("document.querySelector('dialog[open] iframe')!==null");
  assert.ok(await evaluate("document.querySelector('dialog[open]').getAttribute('aria-label').includes('Glass switch')"));
  await evaluate("document.querySelector('dialog[open] button[aria-label=\"Close preview\"]').click()");
  await until("!document.querySelector('dialog[open]')");
  await evaluate("[...document.querySelector('[data-component-id=glass-switch]').querySelectorAll('button')].find(b=>b.textContent==='View code').click()");
  await until("document.querySelector('dialog[open] textarea')!==null");
  const code = await evaluate("document.querySelector('dialog[open] textarea').value");
  assert.equal(code, COMPONENT_EXAMPLES.find(x => x.id === 'glass-switch').html);
  await evaluate("document.querySelector('dialog[open] button[aria-label=\"Close source code\"]').click()");
  await click('Space & planets'); await until("document.querySelectorAll('[data-component-id]').length===4");
  await evaluate("[...document.querySelector('[data-component-id=space-saturn]').querySelectorAll('button')].find(b=>b.textContent==='Add to project').click()");
  await until("document.body.innerText.includes('Preview project')");
  await click('Preview project'); await until("location.pathname.includes('/app/projects/')");
  assert.ok(await evaluate("new URLSearchParams(location.search).get('prompt').includes('[COMPONENT:space-saturn]')"));
  await rpc('Page.navigate', { url: `${base}/app/components` }); await until("document.querySelectorAll('[data-component-id]').length===9");
  await click('3D & shaders'); await until("document.querySelectorAll('[data-component-id]').length===4");
  await new Promise(r => setTimeout(r, 700));
  await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile('.next/component-library-desktop.png', Buffer.from(x.data, 'base64')));
  await click('All categories');
  await evaluate("(()=>{const el=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'no-such-effect');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await until("document.body.innerText.includes('No matching components')");
  await click('Clear filters'); await until("document.querySelectorAll('[data-component-id]').length===9");
  await rpc('Page.navigate', { url: `${base}/app/effects` });
  await until("document.body?.innerText.includes('Atmospheric planet') && document.body?.innerText.includes('Stacking story cards')");
  assert.ok(await evaluate("document.body.innerText.includes('Editorial marquee')"));
});

test('every standalone demo runs without script errors at mobile width and supports reduced motion', async () => {
  // Render each trusted static demo in the inspected page content, never in the Tempo host.
  await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 330, deviceScaleFactor: 1, mobile: false });
  for (const item of COMPONENT_EXAMPLES) {
    await rpc('Page.navigate', { url: 'about:blank' });
    initScripts.push((await rpc('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__errors=[];window.addEventListener("error",e=>window.__errors.push(e.message));' })).identifier);
    await rpc('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(item.html)}` });
    await until("document.querySelector('.stage')!==null");
    await new Promise(r => setTimeout(r, 80));
    assert.deepEqual(await evaluate('window.__errors ?? []'), [], item.id);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), item.id);
    if (item.id.startsWith('scroll-')) {
      const before = await evaluate("document.querySelector('.pinned').innerHTML");
      await evaluate("document.querySelector('.scroll-root').scrollTop=10000");
      await new Promise(r => setTimeout(r, 100));
      assert.notEqual(await evaluate("document.querySelector('.pinned').innerHTML"), before, `${item.id}: scroll must change the scene`);
    }
    if (item.id === 'space-orbits') { await evaluate("document.querySelectorAll('[data-world]')[2].click()"); assert.match(await evaluate("document.querySelector('#world-detail').textContent"), /Launch/); }
    if (item.id === 'interactive-dock') { await evaluate("document.querySelector('button[aria-label=Settings]').click()"); assert.equal(await evaluate("document.querySelector('#dock-panel').textContent"), 'Settings'); }
    if (item.id === 'interactive-compare') { await evaluate("const input=document.querySelector('#compare');input.value=80;input.dispatchEvent(new Event('input'))"); assert.equal(await evaluate("document.querySelector('#compare-value').value"), '20%'); }
    if (item.id === 'type-decode') { await evaluate("document.querySelector('#decode-replay').click()"); await until("document.querySelector('#decode').textContent==='MAKE IT MATTER'"); }
    if (await evaluate("!!document.querySelector('.demo-pause')")) { await evaluate("document.querySelector('.demo-pause').click()"); assert.ok(await evaluate("document.getAnimations().every(a=>a.playState!=='running')"), `${item.id}: pause`); await evaluate("document.querySelector('.demo-pause').click()"); }
    if (item.id === 'glass-switch') { await evaluate("document.querySelector('#toggle').click()"); assert.equal(await evaluate("document.querySelector('#state').textContent"), 'Focus mode on'); }
    if (item.id === 'glass-navigation') { await evaluate("document.querySelectorAll('nav button')[1].click()"); assert.equal(await evaluate("document.querySelector('#section').textContent"), 'Projects'); }
    if (item.id === 'orb-voice') { await evaluate("document.querySelector('#listen').click()"); assert.equal(await evaluate("document.querySelector('#listen').getAttribute('aria-pressed')"), 'true'); }
    if (item.id.startsWith('shader-')) assert.ok(await evaluate("document.querySelector('canvas').getContext('webgl')!==null || !document.querySelector('#fallback').hidden"), item.id);
    await rpc('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.ok(await evaluate("document.getAnimations().every(a=>a.playState!=='running')"), `${item.id}: reduced motion`);
    if (item.id.startsWith('scroll-')) {
      await new Promise(r => setTimeout(r, 60));
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.pinned')).position"), 'relative', `${item.id}: natural reduced-motion layout`);
    }
    if (item.id==='space-saturn' || item.id==='space-orbits' || item.id==='scroll-card-stack') {
      await rpc('Emulation.setEmulatedMedia', { features: [] });
      await rpc('Page.captureScreenshot', { format: 'png' }).then(x => writeFile(`.next/${item.id}-preview.png`, Buffer.from(x.data, 'base64')));
    }
    await rpc('Emulation.setEmulatedMedia', { features: [] });
  }
});
