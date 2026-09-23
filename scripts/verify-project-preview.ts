import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { db } = await import("../src/lib/db");
  const { ensureShell, connectShell } = await import("../src/lib/shell-session");
  const { runtimeProfile } = await import("../src/lib/runtime-profile");
  const id = process.argv[2];
  if (!id) throw new Error("Pass the project ID to inspect its isolated preview.");
  try {
    const project = await db.project.findUniqueOrThrow({ where: { id }, include: { files: true } });
    const state = await ensureShell(project);
    const { sandbox } = await connectShell(id);
    const info = await sandbox.getInfo();
    console.log(`Runtime ready: ${info.memoryMB} MiB.`);
    const runtime = runtimeProfile(project.files, "");
    const handle = await sandbox.pty.connect(state.pid, { timeoutMs: 0, onData: data => { process.stdout.write(new TextDecoder().decode(data)); } });
    await sandbox.pty.sendInput(state.pid, new TextEncoder().encode(runtime.preview + "\n"));
    const url = `https://${sandbox.getHost(3000)}`;
    let ready = false;
    for (let i = 0; i < 150; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) { console.log(`\nPREVIEW_READY ${url}\nHTML_BYTES ${(await response.text()).length}`); ready = true; break; }
      } catch { /* server still booting */ }
    }
    await handle.disconnect();
    if (!ready) throw new Error("Preview did not return HTTP 200.");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Preview verification failed"); if (error && typeof error === "object" && "stderr" in error) console.error(String(error.stderr).replace(/PASSWORD '[^']+'/g, "PASSWORD [redacted]")); process.exitCode = 1; });
