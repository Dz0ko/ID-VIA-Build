"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, FilePlus2 } from "lucide-react";

type Template = { id: string; name: string; category: string };

/** New project: a name and a prompt. Everything else happens in the workspace chat. */
export function NewProject({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const initialPrompt = params.get("prompt") ?? "";
  const initialTemplate = params.get("template") ?? "";
  const initialKind = params.get("kind") === "app" ? "app" : "website";
  const template = templates.find((t) => t.id === initialTemplate);
  const [open, setOpen] = useState(Boolean(initialPrompt || initialTemplate));
  const [name, setName] = useState(template ? template.name : "");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || (prompt ? prompt.slice(0, 40) : "Untitled project"),
        templateId: template?.id,
        description: prompt || undefined,
        kind: initialKind,
      }),
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
          <div className="card w-full max-w-xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold">New project</h2>
              <p className="text-sm text-ash">Give it a name and describe what to build. You can keep chatting, adding and removing things afterwards. Everything is saved.</p>
              {template && <span className="pill mt-2">Template: {template.name}</span>}
            </div>
            <label className="block"><span className="label">Project name</span><input autoFocus className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nimbus CRM landing" /></label>
            <label className="block">
              <span className="label flex items-center gap-1"><Sparkles size={11} />Prompt</span>
              <textarea className="input mt-1 min-h-32" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) create(); }} placeholder="Build a premium dark SaaS landing page for an AI CRM targeting agencies, with pricing, testimonials and FAQ." />
            </label>
            {error && <div className="text-sm text-error">{error}</div>}
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={loading || (!name.trim() && !prompt.trim())} onClick={create}>{loading ? "Creating…" : prompt ? "Create and build" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
