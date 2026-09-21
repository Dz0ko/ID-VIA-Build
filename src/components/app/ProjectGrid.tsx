"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Trash2, ExternalLink } from "lucide-react";

export type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  kind: string;
  description: string | null;
  updatedAt: string | Date;
  publishedAt: string | Date | null;
};

export function ProjectGrid({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.refresh();
  }
  if (!projects.length)
    return (
      <div className="card p-10 text-center text-sm text-ash">
        No projects yet. Create one from a prompt or a template.
      </div>
    );
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => (
        <div key={p.id} className="card p-4 flex flex-col gap-3 group">
          <Link href={`/app/projects/${p.id}`} className="block">
            <div className="h-28 rounded-lg bg-void border border-graphite grid place-items-center overflow-hidden">
              <iframe title={p.name} src={`/api/projects/${p.id}/preview`} className="w-[1200px] h-[720px] origin-top-left pointer-events-none" style={{ transform: "scale(0.24)" }} loading="lazy" />
            </div>
          </Link>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/app/projects/${p.id}`} className="text-sm font-medium truncate block hover:underline">{p.name}</Link>
              <div className="text-xs text-ash">Updated {new Date(p.updatedAt).toLocaleDateString()}</div>
            </div>
            <span className={`pill text-[10px] ${p.status === "PUBLISHED" ? "border-success/40 text-success" : ""}`}>{p.status === "PUBLISHED" ? "Live" : "Draft"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {p.status === "PUBLISHED" && (
              <a href={`/s/${p.slug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm text-fog"><Globe size={12} />Visit <ExternalLink size={10} /></a>
            )}
            <button onClick={() => remove(p.id, p.name)} className="btn btn-ghost btn-sm ml-auto text-ash hover:text-error"><Trash2 size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
