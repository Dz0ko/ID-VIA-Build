"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, MessageSquare, AlertCircle, Lock } from "@/components/icons";

const AppSandbox = dynamic(() => import("./app/AppSandbox").then((m) => m.AppSandbox), { ssr: false });

type Data = {
  project: { name: string; kind: string; status: string; clientStatus: string; updatedAt: string; hasContent: boolean };
  comments: { id: string; authorName: string; body: string; kind: string; resolved: boolean; createdAt: string }[];
  permissions: { canComment: boolean; canApprove: boolean };
  brand: { name: string; logoUrl: string | null; accent: string; hideIdaevia: boolean; welcome: string | null; teamName: string | null };
};

export function ClientPortal({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [pw, setPw] = useState("");
  const [needPw, setNeedPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ path: string; content: string }[]>([]);

  const load = useCallback(async (password = pw) => {
    const res = await fetch(`/api/portal/${token}`, { headers: password ? { "x-portal-password": password } : {} });
    const d = await res.json();
    if (res.status === 401 && d.code === "PASSWORD") { setNeedPw(true); return; }
    if (!res.ok) { setError(d.error); return; }
    setNeedPw(false); setData(d);
    if (d.project?.kind === "app") {
      const f = await fetch(`/api/portal/${token}/files`, { headers: password ? { "x-portal-password": password } : {} }).then((r) => r.json());
      setFiles(f.files ?? []);
    }
  }, [token, pw]);

  useEffect(() => {
    const t = setTimeout(() => {
      try { setName(localStorage.getItem("idaevia:portal:name") ?? ""); } catch { /* ignore */ }
      load("");
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(kind: "COMMENT" | "CHANGE_REQUEST" | "APPROVAL") {
    if (!name.trim()) return setError("Please enter your name.");
    setBusy(true); setError(null);
    try { localStorage.setItem("idaevia:portal:name", name); } catch { /* ignore */ }
    const res = await fetch(`/api/portal/${token}`, { method: "POST", headers: { "Content-Type": "application/json", ...(pw ? { "x-portal-password": pw } : {}) }, body: JSON.stringify({ name, body, kind }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) return setError(d.error);
    setBody(""); load();
  }

  if (error && !data) return <div className="min-h-screen grid place-items-center text-sm text-ash">{error}</div>;
  if (needPw) return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={(e) => { e.preventDefault(); load(pw); }} className="card p-6 w-full max-w-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Lock size={14} />This preview is password protected</div>
        <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoFocus />
        <button className="btn btn-primary w-full">Open</button>
      </form>
    </div>
  );
  if (!data) return <div className="min-h-screen grid place-items-center text-sm text-ash">Loading…</div>;

  const { project, brand, permissions } = data;
  const statusPill = project.clientStatus === "APPROVED" ? ["Approved", "text-success border-success/40"] : project.clientStatus === "CHANGES_REQUESTED" ? ["Changes requested", "text-warning border-warning/40"] : ["In review", ""];
  const previewSrc = `/api/portal/${token}/preview${pw ? `?pw=${encodeURIComponent(pw)}` : ""}`;

  return (
    <div className="min-h-screen flex flex-col" style={{ ["--accent" as string]: brand.accent }}>
      <header className="h-14 border-b border-graphite px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-7 w-auto rounded" /> : <span className="w-7 h-7 rounded-lg grid place-items-center text-xs font-semibold text-white" style={{ background: brand.accent }}>{brand.name.slice(0, 1)}</span>}
          <div><div className="text-sm font-medium">{brand.name}</div><div className="text-[11px] text-ash">Client portal · {project.name}</div></div>
        </div>
        <span className={`pill text-xs ${statusPill[1]}`}>{statusPill[0]}</span>
      </header>
      <div className="flex-1 grid lg:grid-cols-[1fr_360px] min-h-0">
        <div className="p-4 bg-[#050506] min-h-[60vh]">
          <div className="h-full min-h-[60vh] rounded-lg overflow-hidden border border-graphite bg-white">
            {project.kind === "app" ? (files.length ? <div className="h-full min-h-[60vh]"><AppSandbox files={files} /></div> : <div className="h-full min-h-[60vh] grid place-items-center text-sm text-ash bg-void">Loading app…</div>) : <iframe title="preview" src={previewSrc} className="w-full h-full min-h-[60vh]" sandbox="allow-scripts allow-forms allow-popups allow-modals" />}
          </div>
        </div>
        <aside className="border-l border-graphite flex flex-col">
          {brand.welcome && <div className="p-4 text-sm text-fog border-b border-graphite">{brand.welcome}</div>}
          <div className="p-4 border-b border-graphite space-y-2">
            <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            {permissions.canComment && <textarea className="input min-h-20" placeholder="Leave feedback or request a change…" value={body} onChange={(e) => setBody(e.target.value)} />}
            {error && <div className="text-xs text-error">{error}</div>}
            <div className="flex flex-wrap gap-2">
              {permissions.canComment && <button disabled={busy} onClick={() => send("COMMENT")} className="btn btn-outline btn-sm"><MessageSquare size={12} />Comment</button>}
              {permissions.canComment && <button disabled={busy} onClick={() => send("CHANGE_REQUEST")} className="btn btn-outline btn-sm text-warning"><AlertCircle size={12} />Request changes</button>}
              {permissions.canApprove && <button disabled={busy || project.clientStatus === "APPROVED"} onClick={() => send("APPROVAL")} className="btn btn-sm text-white" style={{ background: brand.accent }}><CheckCircle2 size={12} />Approve</button>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {data.comments.length === 0 && <div className="text-xs text-ash">No feedback yet.</div>}
            {data.comments.map((c) => (
              <div key={c.id} className={`rounded-lg border p-3 ${c.kind === "APPROVAL" ? "border-success/40" : c.kind === "CHANGE_REQUEST" ? "border-warning/40" : "border-graphite"} ${c.resolved ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between text-xs text-ash"><span className="text-fog font-medium">{c.authorName}</span><span>{new Date(c.createdAt).toLocaleString()}</span></div>
                <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
                {c.resolved && <div className="mt-1 text-[10px] text-success">Resolved</div>}
              </div>
            ))}
          </div>
          {!brand.hideIdaevia && <div className="p-3 border-t border-graphite text-[11px] text-ash text-center">Powered by IDÆVIA Build</div>}
        </aside>
      </div>
    </div>
  );
}
