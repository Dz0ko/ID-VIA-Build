import Link from "next/link";
import { notFound } from "next/navigation";
import { RuntimeDetails } from "@/components/app/RuntimeDetails";
import { runtimeProfile } from "@/lib/runtime-profile";
import { deploymentProfile } from "@/lib/deployment-profile";
import { buildProjectFiles } from "@/lib/project-files";
import { readRuntimeReport } from "@/lib/runtime-report-store";
import { buildErrorExcerpt } from "@/lib/build-verify";
import { projectReleases } from "@/lib/project-releases";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/finance";
import { AdminProjectPreview } from "@/components/admin/AdminProjectPreview";
export const dynamic = "force-dynamic";
export default async function AdminProject({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ file?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, include: { user: { select: { email: true } }, files: { orderBy: { path: "asc" } }, _count: { select: { versions: true, agentRuns: true } } } });
  if (!project) notFound();
  const source = buildProjectFiles(project), profile = runtimeProfile(source), deployment = deploymentProfile(source);
  const [report, releases] = await Promise.all([readRuntimeReport(project), projectReleases(id, project.userId)]);
  const selected = (await searchParams).file;
  const fileId = project.files.find(f => f.id === selected)?.id ?? project.files[0]?.id;
  const file = fileId ? await db.projectFile.findFirst({ where: { id: fileId, projectId: id }, select: { path: true, content: true } }) : null;
  return <div className="space-y-6">
    <Link href={`/admin/projects?owner=${project.userId}`} className="text-sm underline underline-offset-4">← All projects by {project.user.email}</Link>
    <div><div className="flex justify-between gap-4"><h2 className="text-2xl font-semibold">{project.name}</h2><span className="pill">Read-only</span></div><p className="text-sm text-fog mt-2">{project.user.email} · {project.kind} · {project.status}</p>{project.description && <p className="text-sm mt-3">{project.description}</p>}<p className="text-xs text-ash mt-3">Created {project.createdAt.toISOString().slice(0, 10)} · Updated {project.updatedAt.toISOString().slice(0, 10)} · {project._count.versions} saved changes · {releases.length} build versions · {project._count.agentRuns} AI runs</p></div>
    <RuntimeDetails profile={profile} deployment={deployment} />
    {report && <details className="admin-details"><summary>Last build · {report.status} {report.current ? "" : "· earlier source"}</summary><pre className="whitespace-pre-wrap break-words text-xs text-fog p-4 max-h-80 overflow-auto">{report.log}</pre></details>}
    {project.kind === "app" && project.files.length ? <AdminProjectPreview projectId={id} name={project.name} lastBuild={report?.status === "error" ? `Last build failed ${report.origin === "platform" ? "on the platform side (build environment)" : "in the project's code or configuration"}${report.current ? "" : " (earlier source; the saved code changed since)"}. ${report.origin === "platform" ? "Retry the build; the platform team was notified." : "The owner's workspace repairs this automatically at the next Preview or Build & preview. A preview started here shows the project's own error page."}\n\n${buildErrorExcerpt(report.log, 900)}` : undefined} unavailable={profile.issue ?? (profile.previewPort === null ? "This target runs in Terminal and has no automatic browser preview. Its source and build results are available below." : undefined)} /> : project.html.trim() ? <section className="space-y-3"><h3 className="text-sm font-medium">Saved HTML preview</h3><iframe title={`${project.name} preview`} src={`/api/admin/projects/${id}/preview`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="w-full h-[560px] bg-white border border-graphite rounded-lg" /></section> : <p className="card p-5 text-sm text-fog">This project has no generated content yet.</p>}
    <details open={Boolean(selected)} className="admin-details"><summary>Source files <span>{project.files.length || (project.html ? 1 : 0)} saved files</span></summary><div className="pt-4 space-y-4">
      {!!project.files.length && <form className="flex gap-3"><label className="text-sm flex-1">File<select name="file" defaultValue={fileId} className="input w-full mt-2">{project.files.map(f => <option key={f.id} value={f.id}>{f.path}</option>)}</select></label><button className="btn btn-outline self-end">View file</button></form>}
      {(file || project.html) && <pre className="bg-ink border border-graphite rounded-lg p-4 text-xs overflow-auto max-h-[600px]"><code>{file?.content ?? project.html}</code></pre>}
    </div></details>
  </div>;
}
