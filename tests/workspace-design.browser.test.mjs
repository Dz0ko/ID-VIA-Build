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
function rpc(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, method === 'Page.captureScreenshot' ? 30000 : 10000); pending.set(id, (value) => { clearTimeout(timer); if (value.error) reject(new Error(value.error.message)); else resolve(value.result); }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const r = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
async function until(expression) { for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Not ready: ${expression}`); }
async function click(text) { await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`); }

before(async () => {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3848'], { env: { ...process.env, APP_URL: base }, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/login`)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, 'Test app must be ready');
  const targets = await (await fetch(`${process.env.UI_TEST_CDP_URL || process.env.TEMPO_CDP_URL || 'http://127.0.0.1:50316'}/json/list`)).json();
  const target = targets.find(t => !t.title.startsWith('INTERNAL') && (process.env.UI_TEST_CDP_URL ? t.type === 'page' && t.url === 'about:blank' : t.type === 'webview' && t.url === 'https://glass.samasante.com/'));
  assert.ok(target, 'Open the requested Liquid Glass reference in a Tempo Browser tab before running this visual test');
  originalUrl = target.url;
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', e => { const msg = JSON.parse(e.data); if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); } });
  await rpc('Network.enable');
  previousCookies = (await rpc('Network.getCookies', { urls: [base] })).cookies.filter(c => ['idaevia_session','idaevia_cookie_notice'].includes(c.name));
  const user = await db.user.create({ data: { email: 'components@fixture.invalid', name: 'Alex Morgan', plan: 'AGENCY', role: 'ADMIN' } });
  for (const [index, name] of ['Studio North', 'Forma Analytics', 'Bloom & Co.'].entries()) await db.project.create({ data: { name, slug: `design-fixture-${index}`, userId: user.id, html: `<!doctype html><html><body style="margin:0;background:${['#f2ede4','#161b2e','#dbe9dc'][index]};color:${index===1?'#e2e5ff':'#222'};font-family:Arial;padding:65px"><nav style="display:flex;justify-content:space-between;font-size:22px">${name}<span>About &nbsp; Work &nbsp; Contact</span></nav><h1 style="font-size:86px;letter-spacing:-5px;max-width:800px;margin-top:100px">${['Good design. Lasting impact.','Clarity in every number.','A little closer to nature.'][index]}</h1><p style="font-size:26px">A considered approach to something extraordinary.</p></body></html>` } });
  const token = await new SignJWT({ sub: user.id, ver: 0 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await rpc('Network.setCookie', { name: 'idaevia_cookie_notice', value: '1', url: base });
  await rpc('Network.setCookie', { name: 'idaevia_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' });
  await rpc('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1000, deviceScaleFactor: 1, mobile: false });
  await rpc('Page.navigate', { url: `${base}/app` });
  await until("document.querySelectorAll('.project-card').length===3");
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


test('workspace hierarchy, navigation and common actions remain usable across desktop sizes', async () => {
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.app-theme')).getPropertyValue('--void').trim()"), '#080809');
  assert.ok(await evaluate("getComputedStyle(document.querySelector('.app-theme')).fontFamily.toLowerCase().includes('grotesk')"));
  assert.equal(await evaluate("document.querySelectorAll('.workspace-nav-link[href=\"/app/support\"]').length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('#support-widget-panel').length"), 0);
  await new Promise(r => setTimeout(r, 700));
  await rpc('Page.captureScreenshot', { format: 'png', fromSurface: true }).then(x => writeFile('.next/workspace-overview.png', Buffer.from(x.data, 'base64')));
  assert.equal(await evaluate("document.querySelectorAll('.workspace-nav-link[aria-current=page]').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('.workspace-metrics > div').length"), 4);
  await click('Download'); await until("document.querySelector('dialog[open]')!==null");
  await click('Cancel');
  await click('New project'); await until("!!document.querySelector('textarea')");
  await click('Cancel');
  await evaluate("document.querySelector('.quick-start').click()");
  await until("document.querySelector('textarea')?.value.includes('CRM for agencies')");
  await click('Cancel');
  for (const width of [1440, 1024]) {
    await rpc('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const route of ['/app', '/app/projects', '/app/templates', '/app/prompts', '/app/components', '/app/effects', '/app/agents', '/app/import', '/app/marketplace', '/app/deployments', '/app/integrations', '/app/teams', '/app/learn', '/app/settings', '/app/profile', '/app/assistant', '/app/support', '/admin', '/admin/users', '/admin/projects', '/admin/payments', '/admin/support', '/admin/email', '/admin/settings']) {
      await rpc('Page.navigate', { url: base + route });
      await until("!!document.querySelector('h1') && (document.readyState==='complete')");
      assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"), `${route} at ${width}: page overflow`);
      assert.ok(await evaluate("[...document.querySelectorAll('.workspace-content,.workspace-content > .overflow-y-auto,.admin-content')].every(el=>el.scrollWidth<=el.clientWidth+1)"), `${route} at ${width}: content overflow`);
      assert.ok(await evaluate("!document.body.innerText.includes('Application error:')"), route);
      if(width === 1024 && ['/app/components','/app/import','/admin'].includes(route)) {
        await new Promise(r=>setTimeout(r,350));
        await rpc('Page.captureScreenshot', { format: 'png', fromSurface: true }).then(x => writeFile(`.next/workspace-${route.replaceAll('/','-')}.png`, Buffer.from(x.data, 'base64')));
      }
    }
  }
  await rpc('Page.navigate', { url: base+'/app' }); await until("document.querySelector('.project-card a')!==null");
  await evaluate("document.querySelector('.project-card a').click()");
  await until("document.querySelector('[aria-label=\"Toggle workspace menu\"]')!==null");
  assert.equal(await evaluate("!!document.querySelector('#workspace-navigation')"), false);
  await evaluate("document.querySelector('[aria-label=\"Toggle workspace menu\"]').click()");
  await until("document.querySelector('#workspace-navigation')!==null");
  await evaluate("document.querySelector('[aria-label=\"Open live support\"]').click()");
  await until("document.querySelector('#support-widget-panel')?.innerText.includes('Automated support')");
  const bounds = await evaluate("(()=>{const r=document.querySelector('#support-widget-panel').getBoundingClientRect();return {top:r.top,right:r.right,bottom:r.bottom};})()");
  assert.ok(bounds.top>=0 && bounds.right<=1024 && bounds.bottom<=1000, 'Support fits inside the project workspace');
  await evaluate("(()=>{const el=document.querySelector('#support-widget-panel textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'My support draft');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await evaluate("document.querySelector('[aria-label=\"Close live support\"]').click()");
  assert.equal(await evaluate("document.querySelector('#support-widget-panel').hidden"), true);
  await evaluate("document.querySelector('[aria-label=\"Open live support\"]').click()");
  assert.equal(await evaluate("document.querySelector('#support-widget-panel textarea').value"), 'My support draft');
  await click('Send message');
  await until("document.querySelector('#support-widget-panel [role=log]')?.innerText.includes('My support draft')");
  await until("document.querySelector('#support-widget-panel textarea')?.value===''");
  await rpc('Page.captureScreenshot', {format:'png',fromSurface:true}).then(x=>writeFile('.next/workspace-support-widget.png',Buffer.from(x.data,'base64')));
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#support-widget-panel').hidden"), true);
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), 'Open live support');

});
