import { BrandIcon } from "@/components/BrandIcon";
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
  ["Push and deploy from the terminal", "Connect GitHub and Vercel in Integrations, then run `git push` and `deploy vercel` in the project terminal. Websites also get an instant preview link on idaevia.app with `publish`."],
];

export default async function Deployments() {
  const user = await requireUser();
  const projects = await db.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, slug: true, status: true, kind: true, publishedAt: true, updatedAt: true, gitRemote: true } });
  const history = await db.deployment.findMany({ where: { project: { userId: user.id } }, orderBy: { createdAt: "desc" }, take: 40, include: { project: { select: { name: true, id: true } } } });
  const appUrl = process.env.APP_URL ?? "";
  return (
    <>
      <PageHeader title="Deployments" subtitle="Preview links, GitHub pushes, Vercel deploys and your launch guide" />
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
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-graphite text-sm font-medium flex items-center justify-between"><span>Deploy history</span><span className="text-[11px] text-ash">From the project terminal: <code className="font-mono">publish</code>, <code className="font-mono">git push</code>, <code className="font-mono">deploy vercel</code></span></div>
          <table className="w-full text-xs">
            <thead className="text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">When</th><th className="text-left p-3 font-medium">Project</th><th className="text-left p-3 font-medium">Target</th><th className="text-left p-3 font-medium">Status</th><th className="text-left p-3 font-medium">URL</th></tr></thead>
            <tbody>
              {history.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ash">No deploys yet. Open a project, click Terminal and run <code className="font-mono">help</code>.</td></tr>}
              {history.map((d) => (
                <tr key={d.id} className="border-b border-graphite/60">
                  <td className="p-3 text-ash whitespace-nowrap">{new Date(d.createdAt).toLocaleString()}</td>
                  <td className="p-3"><Link href={`/app/projects/${d.project.id}`} className="hover:underline">{d.project.name}</Link></td>
                  <td className="p-3 capitalize">{d.provider}</td>
                  <td className="p-3"><span className={`pill text-[10px] ${d.status === "READY" ? "border-success/40 text-success" : d.status === "ERROR" ? "border-error/40 text-error" : "border-warning/40 text-warning"}`}>{d.status.toLowerCase()}</span></td>
                  <td className="p-3 font-mono">{d.url ? <a href={d.url} target="_blank" rel="noopener" className="hover:underline">{d.url.replace(/^https?:\/\//, "")}</a> : <span className="text-ash">{d.log.split("\n").slice(-1)[0]?.slice(0, 80)}</span>}</td>
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
              <li key={t} className="flex gap-3"><span className="w-6 h-6 shrink-0 rounded-md grid place-items-center bg-signal/15 text-signal-soft"><BrandIcon name="check" size={13} /></span><div><div className="text-sm font-medium">{t}</div><div className="text-xs text-ash mt-0.5">{d}</div></div></li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
