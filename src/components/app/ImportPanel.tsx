"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, GitBranch, FileArchive, Image as ImageIcon, Lock } from "@/components/icons";
import type { PlanId } from "@/lib/plans";
import { saveImportHandoff, type ImportHandoff } from "@/lib/import-handoff";
export function ImportPanel({ plan }: { plan: PlanId }) {
  const router = useRouter(), locked = plan === "FREE";
  const [name, setName] = useState(""), [url, setUrl] = useState(""), [extra, setExtra] = useState(""), [repo, setRepo] = useState("");
  const [zip, setZip] = useState<File | null>(null), [images, setImages] = useState<File[]>([]), [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState("");
  const [pending, setPending] = useState<{ id: string; key: string; handoff: ImportHandoff } | null>(null);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);
  async function request(path: string, body: FormData | Record<string, unknown>) {
    const res = await fetch(path, { method: "POST", ...(body instanceof FormData ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Import failed (${res.status}). Try again.`);
    return data;
  }
  async function start(kind: string) {
    if (busy || locked) return; setBusy(kind); setError("");
    try {
      if (kind === "zip") {
        if (!zip || zip.size > 3 * 1024 * 1024) throw new Error("Choose a ZIP up to 3 MB.");
        const form = new FormData(); form.append("file", zip); if (name.trim()) form.append("name", name.trim());
        const data = await request("/api/import/zip", form); router.push(`/app/projects/${data.project.id}`); return;
      }
      if (kind === "github") { const data = await request("/api/import/github", { repoUrl: repo.trim(), name: name.trim() || undefined }); router.push(`/app/projects/${data.project.id}`); return; }
      let handoff: ImportHandoff; let projectId: string;
      const key = JSON.stringify({ kind, name, url, extra, files: images.map(f => [f.name, f.size, f.lastModified]) });
      if (pending?.key === key) { await saveImportHandoff(pending.id, pending.handoff); router.push(`/app/projects/${pending.id}?auto=1&from=import`); return; }
      if (kind === "screenshot") {
        if (!images.length || images.length > 4) throw new Error("Choose 1–4 reference images.");
        const references = await Promise.all(images.map(async file => {
          if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 4_500_000) throw new Error("Use PNG, JPG, WebP or GIF images under 4.5 MB each.");
          const bitmap = await createImageBitmap(file).catch(() => { throw new Error(`Could not read ${file.name}. Choose a valid image.`); }); bitmap.close();
          const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Could not read image.")); reader.readAsDataURL(file); });
          return { name: file.name, mediaType: file.type as NonNullable<ImportHandoff["images"]>[number]["mediaType"], data };
        }));
        if (references.reduce((total, image) => total + image.data.length, 0) > 4_000_000) throw new Error("These images are too large together. Resize them or upload fewer images (3 MB combined).");
        handoff = { prompt: `Build a complete editable website from the attached screenshot${images.length > 1 ? "s" : ""}. Recreate the layout, typography, colors, spacing and visual details accurately. Implement responsive behavior and working interactions.\nSTACK CHOICE: HTML + CSS + JavaScript\n${extra.trim() ? `Additional instructions: ${extra.trim()}` : ""}`, images: references, createdAt: Date.now() };
        projectId = pending?.key === key ? pending.id : (await request("/api/projects", { name: name.trim() || images[0].name.replace(/\.[^.]+$/, "").slice(0, 80) || "Screenshot project", kind: "website" })).project.id;
      } else {
        // Retry a failed browser handoff without creating another project.
        const data = await request("/api/import/url", { url: url.trim(), name: name.trim() || undefined, extra: extra.trim() || undefined });
        projectId = data.project.id; handoff = { prompt: data.prompt, createdAt: Date.now() };
      }
      setPending({ id: projectId, key, handoff });
      await saveImportHandoff(projectId, handoff);
      router.push(`/app/projects/${projectId}?auto=1&from=import`);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed. Please try again."); }
    finally { setBusy(null); }
  }
  const badge = locked ? <span className="pill text-[10px] flex items-center gap-1"><Lock size={9} />Starter+</span> : null;
  return <div className="max-w-5xl space-y-5">
    <div className="card p-5 grid sm:grid-cols-2 gap-4"><label className="text-sm">Project name <span className="text-ash">(optional)</span><input className="input mt-2 w-full" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Name your imported project" /></label><label className="text-sm">Design instructions <span className="text-ash">(URL / screenshot)</span><input className="input mt-2 w-full" maxLength={1000} value={extra} onChange={e => setExtra(e.target.value)} placeholder="Optional changes, language or business details" /></label></div>
    {error && <div role="alert" className="text-sm text-error border border-error/40 rounded-lg p-4">{error}{pending && <Link href={`/app/projects/${pending.id}`} className="block underline mt-2">Open the created project</Link>}</div>}
    {locked && <p className="text-sm text-ash">Imports are available from Starter. <Link href="/pricing" className="underline">View plans</Link></p>}
    <div className="grid lg:grid-cols-2 gap-4">
      <form onSubmit={e => { e.preventDefault(); void start("screenshot"); }} className="card p-5 space-y-4"><div className="flex justify-between gap-2"><h2 className="font-medium flex gap-2 items-center"><ImageIcon size={16} />From screenshots</h2>{badge}</div><p className="text-sm text-ash">Upload a reference and start building immediately. Your new project opens in chat for progress, questions and changes.</p><label className="block text-xs text-ash">1–4 images · PNG, JPG, WebP or GIF · 3 MB combined<input required aria-label="Reference screenshots" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="input mt-2 w-full" onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length > 4) { setError("Choose up to 4 images."); e.target.value = ""; setImages([]); setPreviews([]); } else { setImages(files); setPreviews(files.map(f => URL.createObjectURL(f))); setError(""); } }} /></label><div className="flex gap-2 flex-wrap">{previews.map((src, i) => <img key={src} src={src} alt={images[i]?.name || "Reference"} className="h-20 w-28 object-contain rounded-lg border border-graphite" />)}</div><button disabled={locked || !!busy || !images.length} className="btn btn-primary">{busy === "screenshot" ? "Preparing project…" : "Build from screenshots"}</button></form>
      <form onSubmit={e => { e.preventDefault(); void start("url"); }} className="card p-5 space-y-4"><div className="flex justify-between gap-2"><h2 className="font-medium flex gap-2 items-center"><Globe size={16} />From a website URL</h2>{badge}</div><p className="text-sm text-ash">Rebuild a public page as editable code using its headings, sections, colors and typography. For pages behind login or rendered entirely with JavaScript, use a screenshot.</p><label className="block text-sm">Website URL<input required type="url" className="input mt-2 w-full" placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} /></label><button disabled={locked || !!busy || !url.trim()} className="btn btn-primary">{busy === "url" ? "Reading website…" : "Rebuild website"}</button></form>
      <form onSubmit={e => { e.preventDefault(); void start("zip"); }} className="card p-5 space-y-4"><div className="flex justify-between gap-2"><h2 className="font-medium flex gap-2 items-center"><FileArchive size={16} />From a project ZIP</h2>{badge}</div><p className="text-sm text-ash">Import source code, configuration and assets with their folder structure. Supports static sites and projects in multiple languages; framework projects run in Terminal.</p><label className="block text-xs text-ash">3 MB ZIP · up to 200 files / 2 MB extracted · 500 KB per file<input required aria-label="Project ZIP" type="file" accept=".zip,application/zip" className="input mt-2 w-full" onChange={e => setZip(e.target.files?.[0] ?? null)} /></label><p className="text-xs text-ash">Dependencies, caches and private environment/key files are excluded. Include .env.example for setup instructions.</p><button disabled={locked || !!busy || !zip} className="btn btn-primary">{busy === "zip" ? "Importing files…" : "Import project ZIP"}</button></form>
      <form onSubmit={e => { e.preventDefault(); void start("github"); }} className="card p-5 space-y-4"><div className="flex justify-between gap-2"><h2 className="font-medium flex gap-2 items-center"><GitBranch size={16} />From GitHub</h2>{badge}</div><p className="text-sm text-ash">Import source files from a public repository or branch. The same file limits apply as ZIP import. For a private repository, upload its ZIP.</p><label className="block text-sm">Repository URL<input required type="url" className="input mt-2 w-full" value={repo} onChange={e => setRepo(e.target.value)} placeholder="https://github.com/owner/repository" /></label><button disabled={locked || !!busy || !repo.trim()} className="btn btn-primary">{busy === "github" ? "Fetching source…" : "Import repository"}</button></form>
    </div>
  </div>;
}
