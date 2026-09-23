"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

type Command = { id: number; text: string };
export function ShellTerminal({ projectId, active, command, onPreview, onConsumed }: {
  projectId: string; active: boolean; command: Command | null;
  onPreview: (url: string) => void; onConsumed: (id: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const events = useRef<EventSource | null>(null);
  const input = useRef("");
  const sending = useRef(false);
  const connected = useRef(false);
  const connecting = useRef(false);
  const disposed = useRef(false);
  const consumed = useRef<number | null>(null);
  const attempted = useRef<number | null>(null);
  const callbacks = useRef({ onPreview, onConsumed });
  const [status, setStatus] = useState("Disconnected");
  const [port, setPort] = useState("3000");
  const endpoint = `/api/projects/${projectId}/shell`;
  useEffect(() => { callbacks.current = { onPreview, onConsumed }; });

  const request = useCallback(async (body: object) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Terminal request failed");
    return result;
  }, [endpoint]);

  const preview = useCallback(async (requestedPort: number, quiet = false) => {
    try {
      const result = await request({ action: "preview", port: requestedPort });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".e2b.app")) throw new Error("Invalid preview address");
      if (!disposed.current && result.port) setPort(String(result.port));
      if (!disposed.current) callbacks.current.onPreview(url.href);
      return true;
    } catch (e) { if (!quiet) terminal.current?.writeln(`\r\n${e instanceof Error ? e.message : "Preview unavailable"}`); return false; }
  }, [request]);

  const connect = useCallback(async () => {
    if (connecting.current || disposed.current) return;
    connecting.current = true;
    connected.current = false;
    setStatus("Connecting…");
    events.current?.close();
    try {
      await request({ action: "connect" });
      if (disposed.current) return;
      const source = new EventSource(endpoint);
      events.current = source;
      let recent = "";
      let failures = 0;
      const seenPorts = new Set<number>();
      source.addEventListener("ready", () => {
        connected.current = true;
        failures = 0;
        setStatus("Connected");
        fit.current?.fit();
        terminal.current?.focus();
        void request({ action: "resize", cols: terminal.current?.cols ?? 100, rows: terminal.current?.rows ?? 28 }).catch(() => {});
      });
      source.addEventListener("output", (event) => {
        const bytes = Uint8Array.from(atob(JSON.parse(event.data)), (c) => c.charCodeAt(0));
        terminal.current?.write(bytes);
        recent = (recent + new TextDecoder().decode(bytes)).slice(-2000);
        const matches = recent.matchAll(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})/g);
        for (const match of matches) {
          const detected = Number(match[1]);
          if (detected < 1024 || detected > 65535 || seenPorts.has(detected)) continue;
          seenPorts.add(detected);
          setPort(String(detected));
          void (async () => {
            for (let attempt = 0; attempt < 4 && !disposed.current; attempt++) {
              if (await preview(detected, true)) break;
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          })();
        }
      });
      source.addEventListener("closed", () => {
        source.close(); connected.current = false; setStatus("Session ended");
        terminal.current?.writeln("\r\nShell exited or expired. Connect to start again.");
      });
      source.onerror = () => { connected.current = false; if (++failures >= 3) { source.close(); setStatus("Disconnected"); terminal.current?.writeln("\r\nConnection lost. Click Connect to resume or restart an expired session."); } else setStatus("Reconnecting…"); };
    } catch (e) {
      setStatus("Disconnected");
      terminal.current?.writeln(`\r\n${e instanceof Error ? e.message : "Could not connect"}`);
    } finally { connecting.current = false; }
  }, [endpoint, preview, request]);

  useEffect(() => {
    disposed.current = false;
    const term = new Terminal({ fontSize: 13, lineHeight: 1.35, fontFamily: "ui-monospace, SFMono-Regular, monospace", cursorBlink: true, scrollback: 5000, theme: { background: "#050506", foreground: "#d4d4d8", cursor: "#a5a0ff" } });
    const addon = new FitAddon();
    term.loadAddon(addon);
    term.open(host.current!);
    terminal.current = term; fit.current = addon;
    term.writeln("IDÆVIA · isolated Linux terminal\r\nConnect to use npm, Git, tests, interactive commands and dev servers.\r\nFiles persist during this session; download your work before it expires.\r\n");
    const subscription = term.onData((data) => { if (connected.current) input.current += data; });
    const flush = setInterval(async () => {
      if (!input.current || sending.current || !connected.current) return;
      sending.current = true;
      const data = input.current.slice(0, 16_384); input.current = input.current.slice(data.length);
      try { await request({ action: "input", data }); }
      catch (e) { input.current = ""; term.writeln(`\r\nInput delivery failed; inspect the prompt before retrying. ${e instanceof Error ? e.message : ""}`); }
      finally { sending.current = false; }
    }, 80);
    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!host.current?.clientWidth || !host.current?.clientHeight) return;
        addon.fit();
        if (connected.current) void request({ action: "resize", cols: term.cols, rows: term.rows }).catch(() => {});
      }, 150);
    });
    observer.observe(host.current!);
    return () => {
      disposed.current = true; connected.current = false;
      events.current?.close(); subscription.dispose(); observer.disconnect();
      clearInterval(flush); clearTimeout(resizeTimer); term.dispose(); terminal.current = null;
    };
  }, [request]);

  useEffect(() => {
    if (!command || consumed.current === command.id) return;
    if (!connected.current) {
      // Wait for an explicit Connect after a failed attempt; never resend a command on reconnect.
      if (status === "Disconnected") return;
      return;
    }
    consumed.current = command.id;
    void request({ action: command.text === "\x03" ? "input" : "command", data: command.text }).catch((e) => {
      terminal.current?.writeln(`\r\n${e instanceof Error ? e.message : "Command could not be sent"}`);
    }).finally(() => callbacks.current.onConsumed(command.id));
  }, [command, request, status]);

  useEffect(() => {
    if (command && !connected.current && attempted.current !== command.id) {
      attempted.current = command.id;
      void connect();
    }
  }, [command, connect]);

  useEffect(() => { if (active) { fit.current?.fit(); terminal.current?.focus(); } }, [active]);

  return <div className="flex-1 min-h-0 flex flex-col bg-[#050506]">
    <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-graphite px-3 py-2 text-xs">
      <span className="text-ash">{status} · session expires after 15 min without input</span>
      <button className="btn btn-outline btn-sm" onClick={() => void connect()}>Connect</button>
      <button className="btn btn-ghost btn-sm" onClick={() => { input.current += "\x03"; }}>Ctrl+C</button>
      <input aria-label="Preview port" type="number" min={1024} max={65535} value={port} onChange={(e) => setPort(e.target.value)} className="input w-20" />
      <button className="btn btn-outline btn-sm" onClick={() => void preview(Number(port))}>Open preview</button>
      <button className="btn btn-ghost btn-sm" title="Merge saved editor changes into the runtime; conflicting shell edits are preserved" onClick={() => { void request({ action: "sync" }).then(() => terminal.current?.writeln("\r\nSaved changes synced. Runtime-only files are retained.")).catch((e) => terminal.current?.writeln(String(e.message))); }}>Sync saved code</button>
      <button className="btn btn-ghost btn-sm" onClick={() => { void (async () => {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "download" }) });
        if (!response.ok) throw new Error((await response.json()).error);
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a"); link.href = url; link.download = "workspace.tar.gz"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      })().catch((e) => terminal.current?.writeln(String(e.message))); }}>Download files</button>
      <button className="btn btn-ghost btn-sm" onClick={() => { void request({ action: "stop" }).then(() => { events.current?.close(); connected.current = false; setStatus("Stopped"); }).catch((e) => terminal.current?.writeln(String(e.message))); }}>Stop session</button>
    </div>
    {command && <div className="shrink-0 px-3 py-2 text-xs text-signal-soft">Queued: <code>{command.text}</code>{status !== "Connected" && " · Click Connect to run"}</div>}
    <div ref={host} className="flex-1 min-h-0 p-3 overflow-hidden" />
  </div>;
}
