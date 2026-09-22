"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandIcon } from "@/components/BrandIcon";

type Field = { key: string; label: string; secret?: boolean; placeholder?: string };
type Info = Record<string, { name: string; blurb: string; docs: string; fields: Field[] }>;
type Row = { provider: string; label: string | null; meta: Record<string, unknown>; updatedAt: string };

const ORDER = ["github", "vercel", "supabase", "higgsfield", "netlify"];

export function IntegrationsPanel() {
  const params = useSearchParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [githubOAuth, setGithubOAuth] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(() => {
    if (params.get("connected") === "github") return { ok: true, text: "GitHub connected. You can now `git push` from any project terminal." };
    if (params.get("error")) return { ok: false, text: "Could not connect GitHub. Try again or paste a token." };
    return null;
  });

  const load = useCallback(async () => {
    const d = await fetch("/api/integrations").then((r) => r.json());
    setInfo(d.providers); setRows(d.integrations ?? []); setGithubOAuth(Boolean(d.githubOAuth));
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function save(provider: string) {
    setBusy(provider); setMsg(null);
    const res = await fetch("/api/integrations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, secret: form }) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? "Could not save." });
    setMsg({ ok: true, text: `${info?.[provider].name} connected as ${d.label}.` }); setOpen(null); setForm({}); load();
  }
  async function disconnect(provider: string) {
    if (!confirm(`Disconnect ${info?.[provider].name}? Stored credentials are deleted.`)) return;
    await fetch("/api/integrations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
    load();
  }

  if (!info) return <div className="text-sm text-ash">Loading…</div>;
  return (
    <div className="space-y-4">
      {msg && <div className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-success/40 bg-success/10 text-success" : "border-error/40 bg-error/10 text-error"}`}>{msg.text}</div>}
      <p className="text-xs text-ash">Credentials are encrypted at rest (AES-256-GCM) and only used by your own project terminal: <code className="font-mono">git push</code>, <code className="font-mono">deploy vercel</code>, <code className="font-mono">supabase link</code>. They are never shown again after saving and never sent to AI providers.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {ORDER.map((id) => {
          const p = info[id]; const row = rows.find((r) => r.provider === id); const editing = open === id;
          return (
            <div key={id} className={`card p-5 flex flex-col ${row ? "border-success/30" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-ink border border-graphite grid place-items-center"><BrandIcon name={id === "github" ? "branch" : id === "vercel" || id === "netlify" ? "launch" : id === "supabase" ? "database" : "image"} size={18} /></div>
                  <div><div className="text-sm font-medium">{p.name}</div><div className="text-[11px] text-ash">{row ? <span className="text-success">Connected · {row.label}</span> : "Not connected"}</div></div>
                </div>
                {row ? (
                  <div className="flex gap-2"><button onClick={() => { setOpen(editing ? null : id); setForm({}); }} className="btn btn-outline btn-sm">Update</button><button onClick={() => disconnect(id)} className="btn btn-outline btn-sm">Disconnect</button></div>
                ) : id === "github" && githubOAuth ? (
                  <div className="flex gap-2"><a href="/api/integrations/github" className="btn btn-primary btn-sm">Connect GitHub</a><button onClick={() => { setOpen(editing ? null : id); setForm({}); }} className="btn btn-outline btn-sm">Token</button></div>
                ) : (
                  <button onClick={() => { setOpen(editing ? null : id); setForm({}); }} className="btn btn-primary btn-sm">Connect</button>
                )}
              </div>
              <p className="mt-3 text-xs text-fog leading-relaxed">{p.blurb} <a href={p.docs} target="_blank" rel="noopener" className="text-signal-soft hover:underline">Where to get it →</a></p>
              {editing && (
                <div className="mt-4 space-y-2.5 border-t border-graphite pt-4">
                  {p.fields.map((f) => (
                    <label key={f.key} className="block text-xs"><span className="label">{f.label}</span><input type={f.secret ? "password" : "text"} className="input mt-1 font-mono" value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} autoComplete="off" spellCheck={false} /></label>
                  ))}
                  <div className="flex justify-end gap-2"><button onClick={() => setOpen(null)} className="btn btn-outline btn-sm">Cancel</button><button disabled={busy === id} onClick={() => save(id)} className="btn btn-primary btn-sm">{busy === id ? "Verifying…" : "Save & verify"}</button></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
