import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { runtimeCommand, runtimePath } from "../src/lib/runtime-command";
import { executeProjectBuild, type BuildRuntime } from "../src/lib/runtime-build";

test("standalone runtime requests bypass generation without hijacking design prompts", () => {
  for (const text of ["npm run build", "run build", "please run the build", "can you run build", "napravi run build", "направи build", "napravi run build i otvori localhost:3000"]) assert.equal(runtimeCommand(text), "npm run build");
  for (const text of ["open localhost:3000", "otvori go na localhost:3000", "npm run dev", "preview"]) assert.equal(runtimeCommand(text), "preview");
  for (const text of ["Build a pricing page", "Add a preview button", "npm run build && curl evil.example", "run builder improve the hero"]) assert.equal(runtimeCommand(text), null);
});

test("runtime uploads cannot escape the isolated project directory", () => {
  assert.equal(runtimePath("src/components/Button.tsx"), "/home/user/project/src/components/Button.tsx");
  for (const path of ["../secret", "src/../../etc/passwd", "/etc/passwd", "src\\..\\secret", "src/./index", "src//index", "src/a\0b"]) assert.throws(() => runtimePath(path));
});

function fake(fail?: string) {
  const calls: string[] = [];
  const runtime: BuildRuntime = {
    command: async (command) => { calls.push(command); if (command === fail) throw new Error("exit code 1"); },
    writeServer: async () => { calls.push("write-server"); },
    startServer: async () => { calls.push("start-server"); },
  };
  return { runtime, calls };
}

test("React build installs, compiles, starts and checks HTTP readiness in order", async () => {
  const { runtime, calls } = fake();
  await executeProjectBuild(runtime, true, () => {}, new AbortController().signal);
  assert.deepEqual(calls.slice(0, 4), ["npm install --no-audit --no-fund", "npm run build", "write-server", "start-server"]);
  assert.match(calls[4], /127\.0\.0\.1:3000/);
});

test("compiler failure never starts a preview server", async () => {
  const { runtime, calls } = fake("npm run build");
  await assert.rejects(executeProjectBuild(runtime, true, () => {}, new AbortController().signal), /exit code 1/);
  assert.equal(calls.includes("start-server"), false);
});

test("cancelling installation prevents compilation and preview", async () => {
  const { runtime, calls } = fake();
  const ac = new AbortController();
  runtime.command = async (command) => { calls.push(command); ac.abort(); };
  await assert.rejects(executeProjectBuild(runtime, true, () => {}, ac.signal), { name: "AbortError" });
  assert.equal(calls.length, 1);
});

test("static sites prepare output without pretending to run an npm compiler", async () => {
  const { runtime, calls } = fake();
  await executeProjectBuild(runtime, false, () => {}, new AbortController().signal);
  assert.equal(calls[0], "mkdir -p dist && cp index.html dist/index.html");
  assert.equal(calls.some((c) => c.startsWith("npm")), false);
  assert.ok(calls.includes("start-server"));
});


test("preview HTTP server serves built assets and blocks source symlinks", async () => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } = await import("node:fs/promises");
  const { spawn } = await import("node:child_process");
  const root = await mkdtemp(`${process.cwd()}/.runtime-test-`);
  let server = "";
  const { runtime } = fake();
  runtime.writeServer = async (source) => { server = source; };
  await executeProjectBuild(runtime, false, () => {}, new AbortController().signal);
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
