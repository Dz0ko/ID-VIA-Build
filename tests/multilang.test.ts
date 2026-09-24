import assert from "node:assert/strict";
import { test } from "node:test";
import { runtimeProfile } from "../src/lib/runtime-profile";
import { deploymentProfile } from "../src/lib/deployment-profile";
import { editorLanguage, legacyReactSource } from "../src/lib/project-source";
import { executeLanguageBuild } from "../src/lib/runtime-build";
import { redactRuntimeLog } from "../src/lib/runtime-report";
import { deployToVercel } from "../src/lib/vercel";
const files = (map: Record<string, string>) => Object.entries(map).map(([path, content]) => ({ path, content }));
const pkg = (deps: Record<string, string>, scripts = { dev: "vite", build: "vite build" }) => JSON.stringify({ dependencies: deps, scripts });

test("framework detection drives real hosting settings and never deploys server source as static", () => {
  for (const [dependency, id] of [["next", "nextjs"], ["nuxt", "nuxtjs"], ["@sveltejs/kit", "sveltekit"], ["astro", "astro"], ["@angular/core", "angular"], ["vite", "vite"], ["express", "express"]]) {
    const source = files({ "package.json": pkg({ [dependency]: "1" }) });
    assert.equal(runtimeProfile(source, "Python").id, id);
    assert.equal(deploymentProfile(source).framework, id);
  }
  for (const source of [files({ "pom.xml": "spring-boot" }), files({ "main.rs": "fn main() {}", "Cargo.toml": "[package]" }), files({ "main.c": "int main() {return 0;}" })]) assert.equal(deploymentProfile(source).supported, false);
  assert.equal(deploymentProfile(files({ "vercel.json": '{"functions":{"api/main.py":{"runtime":"custom"}}}' })).supported, true);
});
test("backend manifests win over asset-only frontend packages", () => {
  assert.equal(runtimeProfile(files({ "artisan": "", "composer.json": "{}", "package.json": pkg({ vite: "5" }) })).id, "php");
  assert.equal(runtimeProfile(files({ "Gemfile": "", "config/application.rb": "", "package.json": "{}" })).id, "rails");
});
test("native executables and APIs have distinct preview capabilities", () => {
  assert.equal(runtimeProfile(files({ "go.mod": "module test", "main.go": 'import "net/http"' })).previewPort, 3000);
  assert.equal(runtimeProfile(files({ "go.mod": "module test", "main.go": 'package main\nfunc main() {}' })).previewPort, null);
  assert.equal(runtimeProfile(files({ "console.csproj": '<Project Sdk="Microsoft.NET.Sdk" />' })).previewPort, null);
  assert.equal(runtimeProfile(files({ "web.csproj": '<Project Sdk="Microsoft.NET.Sdk.Web" />' })).previewPort, 3000);
  for (const path of ["main.c", "main.cpp", "main.rb", "main.sh", "Package.swift"]) assert.equal(runtimeProfile(files({ [path]: "" })).previewPort, null);
});
test("monorepos and custom toolchains preserve directory, setup and custom port", () => {
  const nested = runtimeProfile(files({ "backend/go.mod": "module test", "backend/main.go": 'import "net/http"' }));
  assert.equal(nested.root, "backend"); assert.match(nested.build, /^cd 'backend'/);
  const custom = runtimeProfile(files({ ".idaevia/runtime.json": JSON.stringify({ setup: "./install-toolchain.sh", build: "make check", start: "./start-services.sh", port: 8080 }) }));
  assert.equal(custom.previewPort, 8080); assert.match(custom.build, /install-toolchain/); assert.match(custom.preview, /start-services/);
  for (const port of ["3000", 80, 70000, 1.5]) assert.ok(runtimeProfile(files({ ".idaevia/runtime.json": JSON.stringify({ build: "true", start: "true", port }) })).issue);
  assert.ok(runtimeProfile(files({ "web/package.json": "{}", "api/go.mod": "module test" })).issue);
});
test("file editor language and legacy React wrapping follow actual source", () => {
  for (const [path, language] of [["main.py", "python"], ["App.java", "java"], ["main.rs", "rust"], ["main.go", "go"], ["Program.cs", "csharp"], ["build.gradle.kts", "kotlin"], ["Dockerfile", "dockerfile"], ["unknown.zig", "plaintext"]]) assert.equal(editorLanguage(path), language);
  assert.equal(legacyReactSource(files({ "/App.tsx": "" })), true);
  assert.equal(legacyReactSource(files({ "App.tsx": "", "package.json": "{}" })), false);
  assert.equal(legacyReactSource(files({ "src/App.tsx": "" })), false);
});
test("build failures never start previews and CLI builds never poll imaginary URLs", async () => {
  const profile = runtimeProfile(files({ "main.c": "int main(){}" }));
  let started = false, calls = 0;
  await executeLanguageBuild({ command: async () => { calls++; }, start: async () => { started = true; } }, profile, () => {}, new AbortController().signal);
  assert.equal(calls, 1); assert.equal(started, false);
  const web = runtimeProfile(files({ "package.json": pkg({ next: "15" }, { build: "next build", dev: "next dev" }) }));
  await assert.rejects(executeLanguageBuild({ command: async () => { throw Error("compile failed"); }, start: async () => { started = true; } }, web, () => {}, new AbortController().signal), /compile failed/);
  assert.equal(started, false);
});
test("persisted build logs remove known values, database credentials and terminal escapes", () => {
  const log = redactRuntimeLog('\u001b[31mERROR DATABASE_URL=postgresql://user:password@host/db\nTOKEN=private-token\nunknown-secret-value', ["unknown-secret-value"]);
  assert.doesNotMatch(log, /password|private-token|unknown-secret-value|\u001b/);
});
test("Vercel receives Next settings and encrypted variables before starting a deployment", async () => {
  const original = globalThis.fetch, calls: { url: string; body: any }[] = [];
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (String(url).includes("/v9/projects")) return Response.json({ id: "project" });
    if (String(url).includes("/env")) return Response.json({});
    return Response.json({ id: "deployment", readyState: "READY", url: "fixture.vercel.app" });
  }) as typeof fetch;
  try {
    await deployToVercel({ token: "test", name: "test", files: files({ "package.json": pkg({ next: "15" }), ".env": "SECRET=private", "app/page.tsx": "" }), env: { DATABASE_URL: "postgresql://example.invalid" }, log: () => {} });
    assert.match(calls[1].url, /\/env/); assert.equal(calls[1].body[0].type, "encrypted");
    assert.match(calls[2].url, /\/deployments/); assert.equal(calls[2].body.projectSettings.framework, "nextjs");
    assert.equal(calls[2].body.projectSettings.outputDirectory, null);
    assert.equal(calls[2].body.files.some((f: { file: string }) => f.file === ".env"), false);
    calls.length = 0;
    await assert.rejects(deployToVercel({ token: "test", name: "test", files: files({ "main.c": "" }), env: {}, log: () => {} }), /hosting/);
    assert.equal(calls.length, 0);
  } finally { globalThis.fetch = original; }
});

test("ZIP imports preserve unlisted source languages instead of silently dropping them", async () => {
  const { default: JSZip } = await import("jszip");
  const { readZip } = await import("../src/lib/import");
  const zip = new JSZip();
  zip.file("main.zig", 'pub fn main() void {}');
  zip.file("main.nim", 'echo "hello"');
  zip.file(".idaevia/runtime.json", '{"build":"zig build-exe main.zig","start":"./main","port":null}');
  zip.file(".env", "SECRET=do-not-import");
  zip.file("unknown-binary", new Uint8Array([0, 255, 10]));
  const result = await readZip(await zip.generateAsync({ type: "arraybuffer" }));
  assert.equal(result.html, null);
  assert.ok(result.files.some(f => f.path === "/main.zig"));
  assert.ok(result.files.some(f => f.path === "/main.nim"));
  assert.equal(result.files.some(f => f.path === "/.env"), false);
  assert.equal(result.files.some(f => f.path === "/unknown-binary"), false);
});
test("Vercel does not launch a build when required environment setup fails", async () => {
  const original = globalThis.fetch; let deployed = false;
  globalThis.fetch = (async (url) => {
    if (String(url).includes("/env")) return Response.json({}, { status: 403 });
    if (String(url).includes("/deployments")) deployed = true;
    return Response.json({ id: "fixture" });
  }) as typeof fetch;
  try {
    await assert.rejects(deployToVercel({ token: "test", name: "test", files: files({ "package.json": pkg({ next: "15" }) }), env: { TOKEN: "test-secret" }, log: () => {} }), /Deployment was not started/);
    assert.equal(deployed, false);
  } finally { globalThis.fetch = original; }
});

test("common terminal requests choose the language's commands", async () => {
  const { projectTaskCommand } = await import("../src/lib/runtime-profile");
  for (const [file, expected] of [["go.mod", "go test"], ["Cargo.toml", "cargo test"], ["pom.xml", "mvn test"], ["app.csproj", "dotnet test"]]) {
    const source = files({ [file]: "" });
    assert.ok(projectTaskCommand("run tests", source, runtimeProfile(source))?.includes(expected));
    assert.doesNotMatch(projectTaskCommand("run tests", source, runtimeProfile(source))!, /npm/);
  }
  const source = files({ "package.json": pkg({ vite: "5" }) });
  assert.match(projectTaskCommand("run tests", source, runtimeProfile(source))!, /No test script/);
});
test("host rejection and server failures never count as ready previews", async () => {
  const { previewResponseReady } = await import("../src/lib/preview-readiness");
  for (const status of [400, 403, 500, 502, 503]) assert.equal(previewResponseReady(status), false);
  for (const status of [200, 301, 302, 401, 404]) assert.equal(previewResponseReady(status), true);
});
