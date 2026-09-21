"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, LayoutTemplate, FilePlus2 } from "lucide-react";

type Template = { id: string; name: string; category: string };

export function NewProject({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const initialPrompt = params.get("prompt") ?? "";
  const initialTemplate = params.get("template") ?? "";
  const [open, setOpen] = useState(Boolean(initialPrompt || initialTemplate));
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [templateId, setTemplateId] = useState<string>(initialTemplate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || (prompt ? prompt.slice(0, 40) : "Untitled project"), templateId: templateId || undefined, description: prompt || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    const q = prompt ? `?prompt=${encodeURIComponent(prompt)}&auto=1` : "";
    router.push(`/app/projects/${data.project.id}${q}`);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm"><FilePlus2 size={14} />New project</button>
      {open && (
        <div className="fixed inset-0 z-50 bg-void/70 backdrop-blur-sm grid place-items-center p-6" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold">New project</h2>
              <p className="text-sm text-ash">Start from a prompt, a template, or both — the AI remixes the template with your prompt.</p>
            </div>
            <label className="block"><span className="label">Project name</span><input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nimbus CRM landing" /></label>
            <label className="block">
              <span className="label flex items-center gap-1"><Sparkles size={11} />Describe what to build (optional)</span>
              <textarea className="input mt-1 min-h-28" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Build a premium dark SaaS landing page for an AI CRM targeting agencies, with pricing, testimonials and FAQ…" />
            </label>
            <div>
              <span className="label flex items-center gap-1"><LayoutTemplate size={11} />Template (optional)</span>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                <button onClick={() => setTemplateId("")} className={`text-left rounded-lg border px-3 py-2 text-xs ${templateId === "" ? "border-signal bg-graphite" : "border-graphite hover:border-ash"}`}>Blank / AI from scratch</button>
                {templates.map((t) => (
                  <button key={t.id} onClick={() => setTemplateId(t.id)} className={`text-left rounded-lg border px-3 py-2 text-xs ${templateId === t.id ? "border-signal bg-graphite" : "border-graphite hover:border-ash"}`}>
                    <div className="font-medium truncate">{t.name}</div><div className="text-ash">{t.category}</div>
                  </button>
                ))}
              </div>
            </div>
            {error && <div className="text-sm text-error">{error}</div>}
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={loading} onClick={create}>{loading ? "Creating…" : prompt ? "Create & build" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
