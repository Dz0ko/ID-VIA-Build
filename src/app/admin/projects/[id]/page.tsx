import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/finance";
export const dynamic = "force-dynamic";
export default async function AdminProject({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ file?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { id: true, name: true, description: true, kind: true, status: true, html: true, createdAt: true, updatedAt: true, userId: true, user: { select: { email: true } }, files: { select: { id: true, path: true }, orderBy: { path: "asc" } }, _count: { select: { versions: true, agentRuns: true } } } });
  if (!project) notFound();
  const selected = (await searchParams).file;
  const fileId = project.files.find(f => f.id === selected)?.id ?? project.files[0]?.id;
  const file = fileId ? await db.projectFile.findFirst({ where: { id: fileId, projectId: id }, select: { path: true, content: true } }) : null;
  return <div className="space-y-6">
    <Link href={`/admin/projects?owner=${project.userId}`} className="text-sm underline underline-offset-4">← All projects by {project.user.email}</Link>
    <div><div className="flex justify-between gap-4"><h2 className="text-2xl font-semibold">{project.name}</h2><span className="pill">Read-only</span></div><p className="text-sm text-fog mt-2">{project.user.email} · {project.kind} · {project.status}</p>{project.description && <p className="text-sm mt-3">{project.description}</p>}<p className="text-xs text-ash mt-3">Created {project.createdAt.toISOString().slice(0, 10)} · Updated {project.updatedAt.toISOString().slice(0, 10)} · {project._count.versions} versions · {project._count.agentRuns} AI runs</p></div>
    {project.html.trim() ? <section className="space-y-3"><h3 className="text-sm font-medium">Saved HTML preview</h3><iframe title={`${project.name} preview`} src={`/api/admin/projects/${id}/preview`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="w-full h-[560px] bg-white border border-graphite rounded-lg" /></section> : <p className="card p-5 text-sm text-fog">{project.files.length ? "This project contains source files. Its selected stack must be built to run; inspect the saved code below." : "This project has no generated content yet."}</p>}
    <details className="admin-details" open={!project.html.trim()}><summary>Source files <span>{project.files.length || (project.html ? 1 : 0)} saved files</span></summary><div className="pt-4 space-y-4">
      {!!project.files.length && <form className="flex gap-3"><label className="text-sm flex-1">File<select name="file" defaultValue={fileId} className="input w-full mt-2">{project.files.map(f => <option key={f.id} value={f.id}>{f.path}</option>)}</select></label><button className="btn btn-outline self-end">View file</button></form>}
      {(file || project.html) && <pre className="bg-ink border border-graphite rounded-lg p-4 text-xs overflow-auto max-h-[600px]"><code>{file?.content ?? project.html}</code></pre>}
    </div></details>
  </div>;
}
