import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../src/lib/db";
import { runProjectBuild, stopProjectRuntime } from "../src/lib/project-runtime";
import { readRuntimeReport } from "../src/lib/runtime-report-store";
import { projectReleases } from "../src/lib/project-releases";
import { buildProjectFiles } from "../src/lib/project-files";
if (!process.env.TEST_DATABASE_SCHEMA?.startsWith("security_test_")) throw Error("Isolated schema required");
async function browserCheck(url: string) {
  if (!process.env.UI_TEST_CDP_URL) return;
  const targets = await (await fetch(process.env.UI_TEST_CDP_URL + "/json/list")).json();
  const target = targets.find((t: { type: string; url: string; title: string }) => t.type === "page" && t.url === "about:blank" && !t.title.startsWith("INTERNAL"));
  assert.ok(target, "Use an empty, isolated test browser");
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(resolve => ws.addEventListener("open", resolve, { once: true }));
  let id = 0; const pending = new Map<number, (value: any) => void>();
  ws.addEventListener("message", e => { const message = JSON.parse(String(e.data)); pending.get(message.id)?.(message); pending.delete(message.id); });
  const rpc = (method: string, params = {}) => new Promise<any>((resolve, reject) => { const key = ++id; const timer = setTimeout(() => reject(Error(method + " timed out")), 15000); pending.set(key, message => { clearTimeout(timer); message.error ? reject(Error(message.error.message)) : resolve(message.result); }); ws.send(JSON.stringify({ id: key, method, params })); });
  try {
    await rpc("Page.navigate", { url });
    let rendered = false;
    for (let i = 0; i < 50; i++) { const result = await rpc("Runtime.evaluate", { expression: "document.body?.innerText || ''", returnByValue: true }); if (result.result.value.includes("runtime-fixture")) { rendered = true; break; } await new Promise(resolve => setTimeout(resolve, 300)); }
    assert.ok(rendered, "Client-side components did not render in the real browser");
  } finally { await rpc("Page.navigate", { url: "about:blank" }); ws.close(); }
}
const files = (source: Record<string, string>) => Object.entries(source).map(([path, content]) => ({ path: "/" + path, content }));
const packageFile = (dependencies: Record<string, string>, scripts: Record<string, string>) => JSON.stringify({ private: true, type: "module", dependencies, scripts });
const vite = { vite: "5.4.21" };
const fixtures: { name: string; files: Record<string, string>; cli?: boolean; html?: string }[] = [
  { name: "Static assets", html: '<!doctype html><html><link rel="stylesheet" href="style.css"><h1>runtime-fixture</h1></html>', files: { "style.css": "h1 { color: purple }" } },
  { name: "Next.js", files: {
    "package.json": packageFile({ next: "15.5.26", react: "19.1.0", "react-dom": "19.1.0" }, { build: "next build", dev: "next dev", start: "next start" }),
    "app/layout.js": 'export default function Layout({children}) {return <html lang="en"><body>{children}</body></html>}',
    "app/page.js": 'export default function Page(){return <main><h1>runtime-fixture</h1></main>}',
  } },
  { name: "React", files: {
    "package.json": packageFile({ ...vite, react: "18.3.1", "react-dom": "18.3.1" }, { build: "vite build", dev: "vite" }),
    "index.html": '<html><div id="root"></div><script type="module" src="/main.jsx"></script></html>',
    "main.jsx": 'import React from "react";import{createRoot}from"react-dom/client";createRoot(document.getElementById("root")).render(<h1>runtime-fixture</h1>);',
  } },
  { name: "Vue", files: {
    "package.json": packageFile({ ...vite, vue: "3.5.13", "@vitejs/plugin-vue": "5.2.1" }, { build: "vite build", dev: "vite" }),
    "vite.config.js": 'import{defineConfig}from"vite";import vue from"@vitejs/plugin-vue";export default defineConfig({plugins:[vue()]});',
    "index.html": '<html><div id="app"></div><script type="module" src="/main.js"></script></html>',
    "main.js": 'import{createApp}from"vue";import App from"./App.vue";createApp(App).mount("#app");',
    "App.vue": '<template><h1>runtime-fixture</h1></template>',
  } },
  { name: "Svelte", files: {
    "package.json": packageFile({ ...vite, svelte: "4.2.20", "@sveltejs/vite-plugin-svelte": "3.1.2" }, { build: "vite build", dev: "vite" }),
    "vite.config.js": 'import{defineConfig}from"vite";import{svelte}from"@sveltejs/vite-plugin-svelte";export default defineConfig({plugins:[svelte()]});',
    "index.html": '<html><div id="app"></div><script type="module" src="/main.js"></script></html>',
    "main.js": 'import App from"./App.svelte";new App({target:document.getElementById("app")});',
    "App.svelte": '<h1>runtime-fixture</h1>',
  } },
  { name: "FastAPI", files: { "requirements.txt": "fastapi==0.115.12\nuvicorn==0.34.2\n", "main.py": 'from fastapi import FastAPI\napp=FastAPI()\n@app.get("/")\ndef main(): return {"message":"runtime-fixture"}\n' } },
  { name: "Django", files: {
    "requirements.txt": "Django==5.2.1\n",
    "manage.py": 'import os,sys\nos.environ.setdefault("DJANGO_SETTINGS_MODULE","app.settings")\nfrom django.core.management import execute_from_command_line\nexecute_from_command_line(sys.argv)\n',
    "app/__init__.py": "",
    "app/settings.py": 'import os\nSECRET_KEY="fixture-only"\nDEBUG=True\nROOT_URLCONF="app.urls"\nALLOWED_HOSTS=["localhost","127.0.0.1",os.environ.get("IDAEVIA_PREVIEW_HOST","")]\nINSTALLED_APPS=[]\nMIDDLEWARE=[]\n',
    "app/urls.py": 'from django.urls import path\nfrom django.http import HttpResponse\nurlpatterns=[path("",lambda request: HttpResponse("runtime-fixture"))]\n',
  } },
  { name: "Node", files: { "server.cjs": 'require("http").createServer((q,s)=>s.end("runtime-fixture")).listen(3000,"0.0.0.0")' } },
  { name: "Mixed services", files: {
    "backend/server.cjs": 'require("http").createServer((q,s)=>s.end("runtime-fixture")).listen(3001,"127.0.0.1")',
    "web/server.cjs": 'require("http").createServer(async(q,s)=>{try{s.end(await(await fetch("http://127.0.0.1:3001")).text())}catch{s.writeHead(503).end()}}).listen(8080,"0.0.0.0")',
    ".idaevia/runtime.json": JSON.stringify({ label: "Two-service fixture", build: "node --check backend/server.cjs && node --check web/server.cjs", start: "node backend/server.cjs & child=$!; trap 'kill \"$child\"' EXIT; node web/server.cjs", port: 8080 }),
  } },
  { name: "Flask", files: { "requirements.txt": "flask==3.1.0\n", "app.py": 'from flask import Flask\napp=Flask(__name__)\n@app.route("/")\ndef main(): return "runtime-fixture"\n' } },
  { name: "Java", files: {
    "pom.xml": '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>fixture</groupId><artifactId>fixture</artifactId><version>1.0</version><properties><maven.compiler.source>17</maven.compiler.source><maven.compiler.target>17</maven.compiler.target></properties></project>',
    "src/main/java/Main.java": 'import com.sun.net.httpserver.HttpServer;import java.net.InetSocketAddress;public class Main{public static void main(String[] args)throws Exception{var s=HttpServer.create(new InetSocketAddress("0.0.0.0",3000),0);s.createContext("/",e->{var b="runtime-fixture".getBytes();e.sendResponseHeaders(200,b.length);e.getResponseBody().write(b);e.close();});s.start();}}',
    ".idaevia/runtime.json": JSON.stringify({ label: "Java HTTP", build: "mvn package -DskipTests", start: "java -cp target/classes Main", port: 3000 }),
  } },
  { name: "Go", files: { "go.mod": "module fixture\n\ngo 1.22\n", "main.go": 'package main\nimport("fmt";"net/http")\nfunc main(){http.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){fmt.Fprint(w,"runtime-fixture")});http.ListenAndServe("0.0.0.0:3000",nil)}' } },
  { name: "Rust", cli: true, files: { "Cargo.toml": '[package]\nname="fixture"\nversion="0.1.0"\nedition="2021"\n', "src/main.rs": 'fn main(){println!("runtime-fixture");}' } },
  { name: "PHP", files: { "index.php": '<?php echo "runtime-fixture";' } },
  { name: "Dotnet", files: { "app.csproj": '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>', "Program.cs": 'var app=WebApplication.CreateBuilder(args).Build();app.MapGet("/",()=>"runtime-fixture");app.Run();' } },
  { name: "C", cli: true, files: { "main.c": '#include <stdio.h>\nint main(){puts("runtime-fixture");return 0;}' } },
  { name: "Ruby", cli: true, files: { "main.rb": 'puts "runtime-fixture"' } },
];

test("language builds use isolated VMs, record real releases and preserve source", { timeout: 1800000 }, async t => {
  const owner = await db.user.create({ data: { email: "multilang@fixture.invalid", plan: "AGENCY" } });
  try {
    for (const fixture of fixtures.filter(f => !process.env.RUNTIME_FIXTURES || process.env.RUNTIME_FIXTURES.split(",").includes(f.name))) await t.test(fixture.name, { timeout: 300000 }, async () => {
      const project = await db.project.create({ data: { userId: owner.id, name: fixture.name, slug: "fixture-" + fixture.name.toLowerCase().replace(/\W/g, "-"), kind: fixture.html ? "website" : "app", html: fixture.html ?? "", memory: '{"stack":"Incorrect stale label"}', files: { create: files(fixture.files) } }, include: { files: true } });
      try {
        const before = buildProjectFiles(project);
        const result = await runProjectBuild(project, () => {}, AbortSignal.timeout(275000));
        assert.equal(Boolean(result.url), !fixture.cli);
        if (result.url) {
          const response = await fetch(result.url); assert.equal(response.status, 200);
          if (!["React", "Vue", "Svelte"].includes(fixture.name)) assert.match(await response.text(), /runtime-fixture/);
          else await browserCheck(result.url);
          if (fixture.html) assert.match(await (await fetch(result.url + "/style.css")).text(), /purple/);
        }
        assert.equal((await projectReleases(project.id, owner.id)).length, 1);
        assert.equal((await readRuntimeReport(project))?.status, "success");
        assert.deepEqual(buildProjectFiles(await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { files: true } })), before);
      } catch (error) { const report = await readRuntimeReport(project); console.error(fixture.name, report?.log.slice(-6000)); throw error; }
      finally { await stopProjectRuntime(project.id); }
    });
    await t.test("compiler failure keeps a diagnostic and does not create a release or charge", async () => {
      const project = await db.project.create({ data: { userId: owner.id, name: "Broken C", slug: "broken-c", kind: "app", files: { create: files({ "main.c": "this is a syntax error" }) } }, include: { files: true } });
      await assert.rejects(runProjectBuild(project, () => {}, AbortSignal.timeout(30000)));
      const report = await readRuntimeReport(project); assert.equal(report?.status, "error"); assert.match(report!.log, /error/i);
      assert.equal((await projectReleases(project.id, owner.id)).length, 0);
      assert.equal(await db.creditLedger.count({ where: { userId: owner.id } }), 0);
    });
  } finally { await db.$disconnect(); }
});
