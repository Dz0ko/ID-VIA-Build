"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type P = { id: string; name: string };

/** "Use in project" picker: sends a prompt to an existing project or starts a new one. */
export function UseInProject({ prompt, agent, label = "Use", placement = "bottom" }: { prompt: string; agent?: string; label?: string; placement?: "top" | "bottom" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<P[] | null>(null);

  useEffect(() => {
    if (open && !projects) fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects ?? []));
  }, [open, projects]);

  const q = `prompt=${encodeURIComponent(prompt)}${agent ? `&agent=${agent}` : ""}`;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn btn-primary btn-sm">{label}</button>
      {open && (
        <div className={placement === "top" ? "absolute right-0 bottom-full mb-1 z-20 card p-2 w-64 max-h-64 overflow-y-auto text-xs space-y-1" : "absolute right-0 top-full mt-1 z-20 card p-2 w-64 max-h-64 overflow-y-auto text-xs space-y-1"}>
          <button onClick={() => router.push(`/app?${q}`)} className="w-full text-left px-2 py-1.5 rounded hover:bg-graphite">＋ New project with this prompt</button>
          <div className="label px-2 pt-1">Existing project</div>
          {projects === null && <div className="px-2 text-ash">Loading…</div>}
          {projects?.length === 0 && <div className="px-2 text-ash">No projects yet.</div>}
          {projects?.map((p) => (
            <button key={p.id} onClick={() => router.push(`/app/projects/${p.id}?${q}`)} className="w-full text-left px-2 py-1.5 rounded hover:bg-graphite truncate">{p.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
