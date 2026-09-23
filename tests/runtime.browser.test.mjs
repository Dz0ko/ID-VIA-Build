import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { SignJWT } from 'jose';
import { Sandbox } from 'e2b';
import { db } from '../src/lib/db.ts';
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith('security_test_')) throw new Error('Isolated schema required');

test('Go Preview starts a silent HTTP server and opens it automatically in the workspace', { timeout: 180000 }, async () => {
  const base='http://localhost:3848';
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3848'],{env:{...process.env,APP_URL:base},stdio:'ignore'});
  let ws, projectId; let id=0;const pending=new Map();
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(Error(`${method} timeout`)),30000);pending.set(key,m=>{clearTimeout(timer);m.error?reject(Error(m.error.message)):resolve(m.result)});ws.send(JSON.stringify({id:key,method,params}))});
  const evaluate=async expression=>(await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  try {
    for(let i=0;i<100;i++){try{if((await fetch(base+'/login')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
    const owner=await db.user.create({data:{email:'go-preview@fixture.invalid',name:'Preview Test',plan:'AGENCY'}});
    const project=await db.project.create({data:{userId:owner.id,name:'Go preview test',slug:'go-preview-fixture',kind:'app',memory:JSON.stringify({stack:'Go'}),files:{create:[
      {path:'/go.mod',content:'module preview\n\ngo 1.22\n'},
      {path:'/main.go',content:'package main\nimport("net/http";"fmt")\nfunc main(){http.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","text/html");fmt.Fprint(w,"<!doctype html><html><head><title>Go preview verified</title></head><body style=\\"background:#eef2ee;font:24px sans-serif;padding:80px\\"><h1>Go preview is running</h1><p>This server prints no startup URL.</p></body></html>")});http.ListenAndServe("0.0.0.0:3000",nil)}'},
    ]}}});projectId=project.id;
    const targets=await(await fetch(`${process.env.UI_TEST_CDP_URL}/json/list`)).json();const target=targets.find(t=>t.type==='page'&&t.url==='about:blank'&&!t.title.startsWith('INTERNAL'));assert.ok(target);
    ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}});
    const token=await new SignJWT({sub:owner.id,ver:0}).setProtectedHeader({alg:'HS256'}).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    await rpc('Network.enable');await rpc('Page.enable');await rpc('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await rpc('Network.setCookie',{name:'idaevia_session',value:token,url:base,httpOnly:true,sameSite:'Lax'});
    await rpc('Page.navigate',{url:`${base}/app/projects/${project.id}`});
    for(let i=0;i<80;i++){if(await evaluate(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Preview')`))break;await new Promise(r=>setTimeout(r,200))}
    await new Promise(r=>setTimeout(r,1500));
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Preview').click()`);
    let url='';for(let i=0;i<150;i++){url=await evaluate(`document.querySelector('iframe[title="Built project preview"]')?.src || ''`);if(url)break;await new Promise(r=>setTimeout(r,750))}
    if(!url)console.log(await evaluate('document.body.innerText.slice(-3000)'));
    assert.match(url,/^https:\/\/3000-.*\.e2b\.app\/?$/);
    assert.match(await(await fetch(url)).text(),/Go preview is running/);
    const row=await db.setting.findUniqueOrThrow({where:{key:`shell:${project.id}`}});const sandbox=await Sandbox.connect(JSON.parse(row.value).sandboxId);assert.equal((await sandbox.getInfo()).memoryMB,4096);
    await new Promise(r=>setTimeout(r,2000));
    const shot=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('.next/go-preview-browser.png',Buffer.from(shot.data,'base64'));
  } finally {
    if(projectId){const row=await db.setting.findUnique({where:{key:`shell:${projectId}`}});if(row)await Sandbox.kill(JSON.parse(row.value).sandboxId).catch(()=>{})}
    if(ws?.readyState===WebSocket.OPEN){await rpc('Network.deleteCookies',{name:'idaevia_session',url:base});await rpc('Page.navigate',{url:'about:blank'});ws.close()}
    server.kill();await db.$disconnect();
  }
});
