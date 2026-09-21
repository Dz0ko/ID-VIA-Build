import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/PageHeader";

const STEPS = [
  ["Write the prompt", "Name the project, describe it, and let the Builder create the first version."],
  ["Edit and refine", "Keep chatting: add or remove sections, change copy and design, or run specialist agents."],
  ["Test", "Run the production audit and fix issues with the Debugger. Preview on desktop, tablet and mobile."],
  ["Share for approval", "Create a client portal link so clients can comment and approve."],
  ["Get your launch guide", "Run the Deploy agent. It recommends a database, a server or hosting option, explains how to set up your domain and walks you through going live, step by step, for this specific project."],
  ["Export and go live", "Export the ZIP (static site or Vite React project) and follow the guide. Website projects also get an instant preview link on idaevia.app."],
];

export default async function Deployments() {
  const user = await requireUser();
  const projects = await db.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, slug: true, status: true, kind: true, publishedAt: true, updatedAt: true } });
  const appUrl = process.env.APP_URL ?? "";
  return (
    <>
      <PageHeader title="Deployments" subtitle="Preview links and your step-by-step launch guide" />
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Project</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">Preview link</th><th className="text-left p-3 font-medium">Last publish</th><th className="p-3" /></tr></thead>
            <tbody>
              {projects.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ash text-xs">No projects yet.</td></tr>}
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-graphite/60">
                  <td className="p-3"><Link href={`/app/projects/${p.id}`} className="hover:underline">{p.name}</Link>{p.kind === "app" && <span className="pill text-[10px] ml-2">React app</span>}</td>
                  <td className="p-3"><span className={`pill text-[10px] ${p.status === "PUBLISHED" ? "text-success border-success/40" : ""}`}>{p.status === "PUBLISHED" ? "Live preview" : "Draft"}</span></td>
                  <td className="p-3 font-mono text-xs text-fog">{p.status === "PUBLISHED" ? <a href={`/s/${p.slug}`} target="_blank" rel="noopener" className="hover:underline">{appUrl}/s/{p.slug}</a> : <span className="text-ash">{p.kind === "app" ? "export ZIP" : "not published"}</span>}</td>
                  <td className="p-3 text-xs text-ash">{p.publishedAt ? new Date(p.publishedAt).toLocaleString() : "never"}</td>
                  <td className="p-3 text-right"><Link href={`/app/projects/${p.id}`} className="btn btn-outline btn-sm">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-6">
          <h2 className="text-sm font-medium">How launching works</h2>
          <p className="text-xs text-ash mt-1">IDÆVIA builds and hosts previews. For production you follow a personalised guide generated for your project.</p>
          <ol className="mt-5 grid md:grid-cols-2 gap-x-8 gap-y-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3"><span className="font-mono text-signal-soft text-xs w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span><div><div className="text-sm font-medium">{t}</div><div className="text-xs text-ash mt-0.5">{d}</div></div></li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
