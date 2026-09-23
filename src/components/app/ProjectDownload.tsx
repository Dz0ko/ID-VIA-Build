"use client";
import { useEffect, useId, useRef, useState } from "react";
import { downloadName } from "@/lib/download-name";
import { Download } from "@/components/icons";
export function ProjectDownloadDialog({ projectId, name, open, onClose, beforeDownload }: { projectId: string; name: string; open: boolean; onClose: () => void; beforeDownload?: () => Promise<void> }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [filename, setFilename] = useState(name), [folder, setFolder] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  async function download(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await beforeDownload?.();
      const base = downloadName(filename);
      const res = await fetch(`/api/projects/${projectId}/export?${new URLSearchParams({ name: base, folder: folder ? "1" : "0" })}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not download. Try again.");
      const url = URL.createObjectURL(await res.blob()); const a = document.createElement("a"); a.href = url; a.download = `${base}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed. Try again."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} onClose={onClose} onCancel={e => { if (busy) e.preventDefault(); }} aria-labelledby={titleId} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-ink text-paper border border-graphite p-6 backdrop:bg-black/75">
    <form onSubmit={download} className="space-y-4"><h2 id={titleId} className="text-lg font-semibold">Download project</h2><p className="text-sm text-ash">Download saved source and assets as a ZIP. This name only changes the download, not your project.</p>
      <label className="block text-sm">Download name<input required maxLength={80} value={filename} onChange={e => setFilename(e.target.value)} className="input mt-2 w-full" /></label>
      <p className="text-xs text-ash">{downloadName(filename)}.zip</p><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={folder} onChange={e => setFolder(e.target.checked)} />Put files inside a folder with this name</label>
      <p className="text-xs text-ash">Connected account credentials and saved environment secrets are excluded.</p>{error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="btn btn-ghost">Cancel</button><button disabled={busy || !filename.trim()} className="btn btn-primary">{busy ? "Preparing…" : "Download ZIP"}</button></div>
    </form>
  </dialog>;
}
export function ProjectDownload({ projectId, name }: { projectId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} className="btn btn-ghost btn-sm"><Download size={12} />Download</button><ProjectDownloadDialog projectId={projectId} name={name} open={open} onClose={() => setOpen(false)} /></>;
}
