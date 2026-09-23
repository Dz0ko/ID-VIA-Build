"use client";

import { ProjectDownload } from "./ProjectDownload";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Trash2, ExternalLink } from "@/components/icons";

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
    <div className="project-grid">
      {projects.map((p) => (
        <div key={p.id} className="card project-card flex flex-col group">
          <Link href={`/app/projects/${p.id}`} className="project-cover" aria-label={`Open ${p.name}`}>
            <div className="project-thumbnail">
              <iframe title={p.name} src={`/api/projects/${p.id}/preview`} className="project-thumbnail-frame" tabIndex={-1} loading="lazy" />
            </div>
          </Link>
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <Link href={`/app/projects/${p.id}`} className="text-sm font-medium truncate block hover:underline">{p.name}</Link>
              <div className="text-xs text-ash mt-1.5">{p.kind === "app" ? "Application" : "Website"} · {new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
            </div>
            <span className={`pill text-[10px] ${p.status === "PUBLISHED" ? "border-success/40 text-success" : ""}`}>{p.status === "PUBLISHED" ? "Live" : "Draft"}</span>
          </div>
          <div className="project-card-actions flex items-center gap-2 text-xs px-3 py-2">
            <ProjectDownload projectId={p.id} name={p.name} />
            {p.status === "PUBLISHED" && (
              <a href={`/s/${p.slug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm text-fog"><Globe size={12} />Visit <ExternalLink size={10} /></a>
            )}
            <button aria-label={`Delete ${p.name}`} title="Delete project" onClick={() => remove(p.id, p.name)} className="btn btn-ghost btn-sm ml-auto text-ash hover:text-error"><Trash2 size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
