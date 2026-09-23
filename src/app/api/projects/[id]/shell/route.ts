import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/security";
import { connectShell, ensureShell, refreshShellTimeout, ShellError, stopShell, syncSavedShell } from "@/lib/shell-session";

export const maxDuration = 300;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect") }),
  z.object({ action: z.literal("input"), data: z.string().min(1).max(16_384) }),
  z.object({ action: z.literal("command"), data: z.string().min(1).max(8000) }),
  z.object({ action: z.literal("resize"), cols: z.number().int().min(10).max(500), rows: z.number().int().min(2).max(200) }),
  z.object({ action: z.literal("preview"), port: z.number().int().min(1024).max(65535) }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("download") }),
]);

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { files: true } });
  if (!project) return { error: Response.json({ error: "Not found" }, { status: 404 }) };
  return { user, project };
}
function failure(error: unknown) {
  return Response.json({ error: error instanceof ShellError ? error.message : "Terminal request failed. Check the runtime connection and E2B quota." }, { status: 409 });
}

export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/shell">) {
  const { id } = await ctx.params;
  const access = await owned(id);
  if (access.error) return access.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid terminal action" }, { status: 400 });
  const action = parsed.data;
  const limited = await rateLimit(`shell:${access.user.id}:${action.action === "connect" ? "connect" : "io"}`, action.action === "connect" ? 20 : 900, 60);
  if (limited) return limited;
  try {
    if (action.action === "connect") {
      const state = await ensureShell(access.project);
      return Response.json({ expiresAt: state.expiresAt });
    }
    if (action.action === "stop") { await stopShell(id); return Response.json({ ok: true }); }
    const { sandbox, state } = await connectShell(id);
    if (action.action === "download") {
      await sandbox.commands.run("tar -czf /home/user/project-export.tar.gz --exclude=node_modules --exclude=.git -C /home/user/project .", { timeoutMs: 30_000 });
      const size = await sandbox.commands.run("stat -c %s /home/user/project-export.tar.gz", { timeoutMs: 5000 });
      if (Number(size.stdout.trim()) > 20_000_000) throw new ShellError("Archive exceeds 20 MB. Remove large generated files before downloading.");
      const data = await sandbox.files.read("/home/user/project-export.tar.gz", { format: "bytes" });
      return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/gzip", "Content-Disposition": 'attachment; filename="workspace.tar.gz"', "Cache-Control": "no-store" } });
    }
    if (action.action === "sync") {
      const processes = await sandbox.commands.run(`ps -o tpgid=,pgid= -p ${state.pid}`, { timeoutMs: 5000 });
      const [foreground, shell] = processes.stdout.trim().split(/\s+/);
      if (!foreground || foreground !== shell) throw new ShellError("Stop the running command before syncing saved code.");
      await syncSavedShell(sandbox, state, access.project);
    } else if (action.action === "input" || action.action === "command") {
      if (action.action === "command") {
        // Do not accidentally send a chat request into an interactive child process.
        const result = await sandbox.commands.run(`ps -o tpgid=,pgid= -p ${state.pid}`, { timeoutMs: 5000 });
        const [foreground, shell] = result.stdout.trim().split(/\s+/);
        if (!foreground || foreground !== shell) throw new ShellError("A command is already running. Use the terminal to answer it or press Ctrl+C first.");
        await syncSavedShell(sandbox, state, access.project);
      }
      await sandbox.pty.sendInput(state.pid, new TextEncoder().encode(action.data + (action.action === "command" ? "\n" : "")));
      if (state.expiresAt - Date.now() < 10 * 60_000) await refreshShellTimeout(id, sandbox, state);
    } else if (action.action === "resize") {
      await sandbox.pty.resize(state.pid, { cols: action.cols, rows: action.rows });
    } else if (action.action === "preview") {
      let lastPort = action.port;
      for (let port = action.port; port <= Math.min(action.port + 20, 65535); port++) {
        const url = `https://${sandbox.getHost(port)}`;
        lastPort = port;
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: "manual", cache: "no-store" });
          if (response.status < 400) return Response.json({ url, port });
        } catch { /* Try the next candidate port. */ }
      }
      throw new ShellError(`No working preview found between ports ${action.port} and ${lastPort}. Start the server with --host 0.0.0.0 and try again.`);
    }
    return Response.json({ ok: true });
  } catch (e) { return failure(e); }
}

export async function GET(req: Request, ctx: RouteContext<"/api/projects/[id]/shell">) {
  const { id } = await ctx.params;
  const access = await owned(id);
  if (access.error) return access.error;
  const limited = await rateLimit(`shell:stream:${access.user.id}`, 30, 60);
  if (limited) return limited;
  try {
    const { sandbox, state } = await connectShell(id);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => { try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* Disconnected */ } };
        let handle: Awaited<ReturnType<typeof sandbox.pty.connect>> | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const disconnect = () => { void handle?.disconnect(); };
        req.signal.addEventListener("abort", disconnect, { once: true });
        const heartbeat = setInterval(() => send("heartbeat", {}), 15_000);
        try {
          handle = await sandbox.pty.connect(state.pid, { timeoutMs: 0, onData: (data) => send("output", Buffer.from(data).toString("base64")) });
          if (req.signal.aborted) return;
          send("ready", {});
          // End before the serverless limit; EventSource reconnects without restarting bash.
          await Promise.race([handle.wait(), new Promise<void>((resolve) => { timer = setTimeout(resolve, 270_000); req.signal.addEventListener("abort", () => resolve(), { once: true }); })]);
          if (handle.exitCode !== undefined) send("closed", { exitCode: handle.exitCode });
        } catch { if (!req.signal.aborted) send("closed", { message: "Terminal connection ended. Reconnect if the shell has exited." }); }
        finally {
          clearInterval(heartbeat); clearTimeout(timer);
          req.signal.removeEventListener("abort", disconnect);
          await handle?.disconnect().catch(() => {});
          try { controller.close(); } catch { /* Already closed */ }
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
  } catch (e) { return failure(e); }
}
