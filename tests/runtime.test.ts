import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { runtimeCommand, runtimePath } from "../src/lib/runtime-command";
import { SERVER } from "../src/lib/runtime-build";

test("standalone runtime requests bypass generation without hijacking design prompts", () => {
  for (const text of ["npm run build", "run build", "please run the build", "can you run build", "napravi run build", "направи build", "napravi run build i otvori localhost:3000"]) assert.equal(runtimeCommand(text), "npm run build");
  for (const text of ["open localhost:3000", "otvori go na localhost:3000", "npm run dev", "preview"]) assert.equal(runtimeCommand(text), "preview");
  for (const text of ["Build a pricing page", "Add a preview button", "npm run build && curl evil.example", "run builder improve the hero"]) assert.equal(runtimeCommand(text), null);
});

test("runtime uploads cannot escape the isolated project directory", () => {
  assert.equal(runtimePath("src/components/Button.tsx"), "/home/user/project/src/components/Button.tsx");
  for (const path of ["../secret", "src/../../etc/passwd", "/etc/passwd", "src\\..\\secret", "src/./index", "src//index", "src/a\0b"]) assert.throws(() => runtimePath(path));
});

test("preview HTTP server serves built assets and blocks source symlinks", async () => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } = await import("node:fs/promises");
  const { spawn } = await import("node:child_process");
  const root = await mkdtemp(`${process.cwd()}/.runtime-test-`);
  let server = SERVER;
  let child: ReturnType<typeof spawn> | undefined;
  try {
    await mkdir(`${root}/dist`);
    await writeFile(`${root}/dist/index.html`, "<h1>Built preview</h1>");
    await writeFile(`${root}/source.txt`, "not public");
    await symlink(`${root}/source.txt`, `${root}/dist/leak.txt`);
    server = server.replace("server.listen(port,'0.0.0.0'", "server.listen(0,'127.0.0.1'");
    child = spawn(process.execPath, ["-e", server], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    const [data] = await once(child.stdout!, "data", { signal: AbortSignal.timeout(5000) });
    const port = String(data).match(/localhost:(\d+)/)?.[1];
    assert.ok(port);
    const url = `http://127.0.0.1:${port}`;
    assert.equal(await (await fetch(url)).text(), "<h1>Built preview</h1>");
    assert.equal((await fetch(`${url}/dashboard`)).status, 200);
    assert.equal((await fetch(`${url}/missing.js`)).status, 404);
    assert.equal((await fetch(`${url}/leak.txt`)).status, 403);
    assert.equal((await fetch(`${url}/source.txt`)).status, 404);
  } finally {
    if (child) { const closed = once(child, "close"); child.kill(); await closed; }
    await rm(root, { recursive: true, force: true });
  }
});

import { shellIntent } from "../src/lib/shell-intent";
test("chat forwards explicit shell commands verbatim, including quoting and pipelines", () => {
  for (const command of ["npm install lodash", "git diff --stat", "npm test && npm run build", "cd src && ls -la", "python3 -c 'print(2 + 2)'", "printf '%s' Hello | cat", "rm -rf dist", "export NAME='My app'"]) assert.equal(shellIntent(command), command);
  assert.equal(shellIntent("run npm test"), "npm test");
  assert.equal(shellIntent("vo terminal: docker ps"), "docker ps");
  assert.equal(shellIntent("terminal: find . -name '*.tsx'"), "find . -name '*.tsx'");
  for (const request of ["Build a dashboard", "Add a terminal panel", "Install a contact form", "Please change the npm button label", "run builder Improve the page", "go to the homepage", "make the hero darker", "find a better logo"]) assert.equal(shellIntent(request), null);
});

import { runtimeProfile } from "../src/lib/runtime-profile";
test("runtime selection follows manifests over stale language labels and uses Next hostname flag", () => {
  const profile = runtimeProfile([{ path: "/package.json", content: JSON.stringify({ scripts: { dev: "next dev", build: "next build" }, dependencies: { next: "16" } }) }], "Java");
  assert.equal(profile.label, "Next.js");
  assert.match(profile.preview, /--hostname 0.0.0.0/);
  assert.doesNotMatch(profile.preview, /--host /);
  assert.match(profile.build, /npm run build/);
  assert.equal(runtimeCommand("give me a preview run it"), "preview");
  assert.equal(runtimeCommand("run it"), "preview");
});
test("non-JavaScript manifests select their own runtimes without npm", () => {
  for (const [path, command] of [["go.mod", "go run"], ["Cargo.toml", "cargo run"], ["pom.xml", "compile exec:java"], ["manage.py", "runserver"], ["app.csproj", "dotnet run"], ["Package.swift", "swift run"]]) {
    const profile = runtimeProfile([{ path, content: "" }], "Next.js");
    assert.ok(profile.preview.includes(command), path);
    assert.doesNotMatch(profile.preview, /npm/);
  }
  const api = runtimeProfile([{ path: "main.py", content: "app = FastAPI()" }, { path: "requirements.txt", content: "fastapi\nuvicorn" }], "Python");
  assert.match(api.preview, /uvicorn 'main:app'/);
  assert.match(api.preview, /--host 0.0.0.0/);
  assert.match(runtimeProfile([], "Unknown").preview, /No automatic runtime detected/);
});

test("Prisma previews generate the client and prepare only the isolated local database", () => {
  const profile = runtimeProfile([
    { path: "/package.json", content: JSON.stringify({ scripts: { dev: "next dev" }, dependencies: { next: "15" } }) },
    { path: "/prisma/schema.prisma", content: 'datasource db { provider = "postgresql" }' },
  ], "");
  assert.match(profile.preview, /prisma generate/);
  assert.match(profile.preview, /if \[ "\$IDAEVIA_LOCAL_DATABASE" = 1 \]; then npx --no-install prisma db push --skip-generate; fi/);
  assert.doesNotMatch(profile.preview, /accept-data-loss|migrate reset/);
});

import { runtimeMemoryEnvironment, runtimeResources } from "../src/lib/runtime-resources";
import { runtimeFailureHint } from "../src/lib/runtime-diagnostics";
test("app memory budgets exceed static-site budgets and leave RAM outside the JS heap", () => {
  assert.equal(runtimeResources("app").memoryMB, 4096);
  assert.equal(runtimeResources("website").memoryMB, 2048);
  assert.equal(runtimeMemoryEnvironment(4096).NODE_OPTIONS, "--max-old-space-size=3072");
  assert.equal(runtimeMemoryEnvironment(2048).NODE_OPTIONS, "--max-old-space-size=1536");
});
test("runtime profiles preserve package managers, Python isolation and custom commands", () => {
  const pkg = { path: "package.json", content: JSON.stringify({ scripts: { dev: "vite", build: "vite build" } }) };
  for (const [lock, manager] of [["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"]]) {
    const profile = runtimeProfile([pkg, { path: lock, content: "" }], "");
    assert.ok(profile.preview.includes(`corepack ${manager} run dev --host`));
    assert.ok(profile.build.includes(`corepack ${manager} run build`));
    assert.doesNotMatch(profile.preview, /\bnpm run dev/);
  }
  assert.match(runtimeProfile([{ path: "main.py", content: "print(1)" }], "").preview, /venv .*activate/);
  const custom = runtimeProfile([{ path: ".idaevia/runtime.json", content: JSON.stringify({ build: "cd backend && make", start: "cd backend && ./server" }) }], "");
  assert.ok(custom.preview.includes("cd backend && ./server"));
  assert.ok(custom.preview.indexOf("cd backend && make") < custom.preview.indexOf("cd backend && ./server")); // a preview builds before it starts
  assert.ok(custom.build.includes("cd backend && make") && !custom.build.includes("./server"));
  assert.match(runtimeProfile([{ path: ".idaevia/runtime.json", content: "{}" }], "").preview, /Invalid/);
  assert.match(runtimeProfile([{ path: "Package.swift", content: "" }], "").preview, /Required runtime tool is unavailable/);
});
test("runtime failures produce specific help without treating normal logs as errors", () => {
  assert.match(runtimeFailureHint("FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory")!, /memory/);
  assert.match(runtimeFailureHint("ModuleNotFoundError: No module named flask")!, /dependency/);
  assert.match(runtimeFailureHint("Environment variable not found: DATABASE_URL")!, /setting/);
  assert.equal(runtimeFailureHint("Ready in 500ms. GET / 200"), null);
  assert.equal(runtimeFailureHint(runtimeProfile([{ path: "go.mod", content: "module preview" }], "Go").preview), null);
  assert.match(runtimeFailureHint("\r\nRequired runtime tool is unavailable: swift. Open a new session.")!, /toolchain/);
});

test("a start command that runs before any build is explained as missing build output, not a broken dependency", () => {
  assert.match(runtimeFailureHint("Error: Cannot find module '/home/user/project/dist/server.js'\n    at Module._resolveFilename")!, /build output that does not exist yet/);
  assert.match(runtimeFailureHint("Error: Cannot find module 'express'")!, /could not compile or load a dependency/);
});

test("a custom runtime installs its dependencies unless its own commands already do", () => {
  const withPackage = runtimeProfile([
    { path: ".idaevia/runtime.json", content: JSON.stringify({ build: "npm run build", start: "npm start", port: 3000 }) },
    { path: "package.json", content: JSON.stringify({ scripts: { build: "prisma generate && next build", start: "next start" } }) },
  ], "");
  assert.ok(withPackage.build.includes("npm install --no-audit --no-fund && (\n  npm run build") || withPackage.build.includes("npm install --no-audit --no-fund && (\nnpm run build"), withPackage.build);
  assert.ok(withPackage.preview.indexOf("npm install") < withPackage.preview.indexOf("npm run build") && withPackage.preview.indexOf("npm run build") < withPackage.preview.indexOf("npm start"));
  const selfInstalling = runtimeProfile([
    { path: ".idaevia/runtime.json", content: JSON.stringify({ build: "npm install && npm run build", start: "npm start" }) },
    { path: "package.json", content: "{}" },
  ], "");
  assert.equal(selfInstalling.preview.split("npm install").length, 2); // once, from the project's own command
  const pnpm = runtimeProfile([{ path: ".idaevia/runtime.json", content: JSON.stringify({ build: "pnpm build", start: "pnpm start" }) }, { path: "package.json", content: "{}" }, { path: "pnpm-lock.yaml", content: "" }], "");
  assert.ok(pnpm.build.includes("corepack pnpm install && ("));
  const bare = runtimeProfile([{ path: ".idaevia/runtime.json", content: JSON.stringify({ build: "make", start: "./server" }) }], "");
  assert.doesNotMatch(bare.build, /npm|pip|composer/);
});

test("a custom runtime with a production start previews through its dev script so saved changes hot-reload", () => {
  const files = [
    { path: ".idaevia/runtime.json", content: JSON.stringify({ build: "npm run build", start: "npm start", port: 3000 }) },
    { path: "package.json", content: JSON.stringify({ scripts: { dev: "next dev", build: "prisma generate && next build", start: "next start" } }) },
  ];
  const profile = runtimeProfile(files, "");
  assert.ok(profile.preview.includes("npm run dev -- --hostname 0.0.0.0 --port 3000"), profile.preview);
  assert.doesNotMatch(profile.preview, /npm start/);
  assert.ok(profile.build.includes("npm run build") && !profile.build.includes("npm run dev")); // verification keeps the production build
  const noDev = runtimeProfile([files[0], { path: "package.json", content: JSON.stringify({ scripts: { build: "tsc", start: "node dist/server.js" } }) }], "");
  assert.ok(noDev.preview.includes("npm run build") && noDev.preview.includes("npm start"));
});
