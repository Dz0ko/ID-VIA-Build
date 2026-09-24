"use client";

import { useEffect, useRef, useState } from "react";

type Preview = { url: string; expiresAt: number };
function previewValue(value: { url?: string; expiresAt?: number }): Preview | null {
  try {
    const url = new URL(value.url ?? "");
    return url.protocol === "https:" && url.hostname.endsWith(".e2b.app") && typeof value.expiresAt === "number"
      ? { url: url.href, expiresAt: value.expiresAt } : null;
  } catch { return null; }
}
export function AdminProjectPreview({ projectId, name }: { projectId: string; name: string }) {
  const endpoint = `/api/admin/projects/${projectId}/runtime`;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("Start a preview of the saved project.");
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (data.ready) setPreview(previewValue(data));
    }).catch(() => {});
    return () => { controller.abort(); active.current?.abort(); };
  }, [endpoint]);
  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => { setPreview(null); setProgress("This temporary preview expired. Start it again to continue."); }, Math.max(0, preview.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [preview]);
  async function request(action: "start" | "stop") {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(""); setProgress(action === "start" ? "Preparing preview…" : "Stopping preview…");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }), signal: controller.signal });
      if (!response.ok) throw new Error((await response.json()).error ?? "Preview request failed");
      if (action === "stop") { setPreview(null); setProgress("Preview stopped. The saved project is unchanged."); return; }
      if (!response.body) throw new Error("The preview connection did not open.");
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = "", ready = false;
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const parts = buffer.split("\n\n"); buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find(l => l.startsWith("data: ")); if (!line) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === "progress") setProgress(event.message);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "ready") {
            const value = previewValue(event); if (!value) throw new Error("Invalid preview response");
            ready = true; setPreview(value); setProgress("Preview ready");
          }
        }
      }
      if (!ready) throw new Error("The connection ended before the preview was ready. Please retry.");
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not open preview");
    } finally { active.current = null; setBusy(false); }
  }
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-medium">Project preview</h3><p className="text-xs text-ash mt-1">Temporary copy of saved code. External integrations are not connected.</p></div>
      <div className="flex items-center gap-2">
        {preview ? <><a className="btn btn-outline btn-sm" href={preview.url} target="_blank" rel="noopener noreferrer">Open preview ↗</a><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void request("stop")}>Stop preview</button></>
          : <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void request("start")}>{busy ? "Starting preview…" : "Start preview"}</button>}
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {preview ? <iframe title={`${name} admin preview`} src={preview.url} sandbox="allow-scripts allow-forms allow-same-origin allow-modals" referrerPolicy="no-referrer" className="w-full h-[680px] bg-white border border-graphite rounded-lg" />
      : <div className="border border-graphite rounded-lg p-8 text-center text-sm text-fog" role="status">{progress}</div>}
  </section>;
}
