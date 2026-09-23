import { Sandbox } from "e2b";
import { randomUUID } from "node:crypto";
import { SERVER } from "../src/lib/runtime-build";

async function main() {
  if (!process.env.E2B_API_KEY) throw new Error("E2B_API_KEY is not configured");
  const sandbox = await Sandbox.create({ timeoutMs: 180_000, network: { allowPublicTraffic: true } });
  let handle: Awaited<ReturnType<typeof sandbox.pty.create>> | undefined;
  let output = "";
  const decoder = new TextDecoder();
  const onData = (data: Uint8Array) => { output += decoder.decode(data, { stream: true }); };
  const waitFor = async (text: string) => {
    const deadline = Date.now() + 45_000;
    while (!output.includes(text)) { if (Date.now() > deadline) throw new Error("PTY output check timed out"); await new Promise((resolve) => setTimeout(resolve, 100)); }
  };
  const command = async (cmd: string) => {
    const marker = `DONE_${randomUUID().replaceAll("-", "")}`;
    await sandbox.pty.sendInput(handle!.pid, new TextEncoder().encode(`${cmd}; printf '\\n${marker}:%s\\n' "$?"\n`));
    await waitFor(`\r\n${marker}:0\r\n`);
  };
  try {
    console.log("Isolated E2B runtime created.");
    await sandbox.files.write([
      { path: "/home/user/project/package.json", data: JSON.stringify({ private: true, scripts: { build: "mkdir -p dist && cp index.html dist/index.html" } }) },
      { path: "/home/user/project/index.html", data: "<!doctype html><h1>Shell preview smoke test</h1>" },
      { path: "/home/user/project/.preview.cjs", data: SERVER },
    ]);
    handle = await sandbox.pty.create({ cols: 100, rows: 28, cwd: "/home/user/project", timeoutMs: 0, onData });
    await command("stty -echo; export IDAEVIA_SMOKE=persisted; mkdir -p nested; cd nested");
    await command('test "$IDAEVIA_SMOKE" = persisted && test "$PWD" = /home/user/project/nested');
    console.log("Shell working directory and environment persist between commands.");
    const pid = handle.pid;
    await handle.disconnect();
    handle = await sandbox.pty.connect(pid, { timeoutMs: 0, onData });
    await command('test "$IDAEVIA_SMOKE" = persisted && cd ..');
    console.log("Reconnected to the same live shell.");
    await command("npm install --no-audit --no-fund && npm run build");
    console.log("npm install and npm run build exited successfully.");
    await sandbox.pty.sendInput(pid, new TextEncoder().encode("node .preview.cjs\n"));
    const url = `https://${sandbox.getHost(3000)}`;
    let ready = false;
    for (let i = 0; i < 20; i++) {
      try { const res = await fetch(url, { signal: AbortSignal.timeout(3000) }); if (res.ok && (await res.text()).includes("Shell preview smoke test")) { ready = true; break; } } catch { /* Starting */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("Preview did not become ready");
    console.log("HTTPS preview on port 3000 serves the built site.");
    await sandbox.pty.sendInput(pid, new Uint8Array([3]));
    await command("true");
    console.log("Ctrl+C stopped the server; shell remains usable.");
  } finally {
    await handle?.disconnect().catch(() => {});
    await sandbox.kill();
    console.log("Test runtime destroyed.");
  }
}
main().catch((error) => { console.error("Live terminal test failed:", error instanceof Error ? error.name : "Unknown error"); process.exitCode = 1; });
