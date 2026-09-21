"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, GitBranch, FileArchive, Image as ImageIcon, Lock } from "lucide-react";
import type { PlanId } from "@/lib/plans";

export function ImportPanel({ plan }: { plan: PlanId }) {
  const router = useRouter();
  const locked = plan === "FREE";
  const [url, setUrl] = useState("");
  const [extra, setExtra] = useState("");
  const [repo, setRepo] = useState("");
  const [zip, setZip] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importUrl() {
    setBusy("url"); setError(null);
    const res = await fetch("/api/import/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, extra: extra || undefined }) });
    const d = await res.json(); setBusy(null);
    if (!res.ok) return setError(d.error);
    sessionStorage.setItem(`idaevia:prompt:${d.project.id}`, d.prompt);
    router.push(`/app/projects/${d.project.id}?auto=1&from=session`);
  }
  async function importGithub() {
    setBusy("github"); setError(null);
    const res = await fetch("/api/import/github", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl: repo }) });
    const d = await res.json(); setBusy(null);
    if (!res.ok) return setError(d.error);
    router.push(`/app/projects/${d.project.id}`);
  }
  async function importZip() {
    if (!zip) return;
    setBusy("zip"); setError(null);
    const fd = new FormData(); fd.append("file", zip);
    const res = await fetch("/api/import/zip", { method: "POST", body: fd });
    const d = await res.json(); setBusy(null);
    if (!res.ok) return setError(d.error);
    router.push(`/app/projects/${d.project.id}`);
  }

  const lockedBadge = locked ? <span className="pill text-[10px] flex items-center gap-1"><Lock size={9} />Starter+</span> : null;

  return (
    <div className="grid lg:grid-cols-2 gap-4 max-w-5xl">
      {error && <div className="lg:col-span-2 text-sm text-error border border-error/40 bg-error/10 rounded-lg px-4 py-2">{error} {locked && <Link href="/pricing" className="underline">Upgrade</Link>}</div>}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium flex items-center gap-2"><Globe size={14} className="text-signal-soft" />From a live website (URL)</h2>{lockedBadge}</div>
        <p className="text-xs text-ash">IDÆVIA analyses the page structure (navigation, headings, sections, colours, fonts, CTAs) and rebuilds an <b>original</b> site with the same hierarchy. Protected content, logos and images are not copied.</p>
        <input className="input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="input" placeholder="Optional: “make it for my dental clinic in Skopje, in Macedonian”" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <button disabled={!url || busy !== null || locked} onClick={importUrl} className="btn btn-primary btn-sm">{busy === "url" ? "Analysing…" : "Analyse & rebuild"}</button>
      </div>
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium flex items-center gap-2"><GitBranch size={14} className="text-signal-soft" />From GitHub</h2>{lockedBadge}</div>
        <p className="text-xs text-ash">Imports a static site (index.html in root, public/, dist/ or docs/) from a public repository. The file becomes your editable project.</p>
        <input className="input" placeholder="https://github.com/owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
        <button disabled={!repo || busy !== null || locked} onClick={importGithub} className="btn btn-primary btn-sm">{busy === "github" ? "Importing…" : "Import repository"}</button>
      </div>
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium flex items-center gap-2"><FileArchive size={14} className="text-signal-soft" />From a ZIP</h2>{lockedBadge}</div>
        <p className="text-xs text-ash">A static site (index.html) becomes a website project. A React project (src/App.tsx + components) becomes a multi-file app project with a live sandbox.</p>
        <input type="file" accept=".zip" className="input" onChange={(e) => setZip(e.target.files?.[0] ?? null)} />
        <button disabled={!zip || busy !== null || locked} onClick={importZip} className="btn btn-primary btn-sm">{busy === "zip" ? "Uploading…" : "Import ZIP"}</button>
      </div>
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium flex items-center gap-2"><ImageIcon size={14} className="text-signal-soft" />From a screenshot / reference image</h2>{lockedBadge}</div>
        <p className="text-xs text-ash">Open any project, click the <b>image</b> button next to the chat and attach up to 4 reference images. The Builder recreates layout, typography, colours and spacing as editable code. Combine several references (“hero from #1, pricing from #2”).</p>
        <Link href="/app?prompt=Recreate%20the%20attached%20reference%20design%20as%20a%20complete%20website." className="btn btn-outline btn-sm">New project for a screenshot</Link>
      </div>
    </div>
  );
}
