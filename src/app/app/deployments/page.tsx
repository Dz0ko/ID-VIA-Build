import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/PageHeader";

export default async function Deployments() {
  const user = await requireUser();
  const projects = await db.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, slug: true, status: true, publishedAt: true, updatedAt: true } });
  const appUrl = process.env.APP_URL ?? "";
  return (
    <>
      <PageHeader title="Deployments & domains" subtitle="IDÆVIA hosting: every project gets a URL instantly" />
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-ash border-b border-graphite"><tr><th className="text-left p-3 font-medium">Project</th><th className="text-left p-3 font-medium">Environment</th><th className="text-left p-3 font-medium">URL</th><th className="text-left p-3 font-medium">Last deploy</th><th className="p-3" /></tr></thead>
            <tbody>
              {projects.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ash text-xs">No projects yet.</td></tr>}
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-graphite/60">
                  <td className="p-3"><Link href={`/app/projects/${p.id}`} className="hover:underline">{p.name}</Link></td>
                  <td className="p-3"><span className={`pill text-[10px] ${p.status === "PUBLISHED" ? "text-success border-success/40" : ""}`}>{p.status === "PUBLISHED" ? "Production" : "Draft"}</span></td>
                  <td className="p-3 font-mono text-xs text-fog">{p.status === "PUBLISHED" ? <a href={`/s/${p.slug}`} target="_blank" rel="noopener" className="hover:underline">{appUrl}/s/{p.slug}</a> : <span className="text-ash">—</span>}</td>
                  <td className="p-3 text-xs text-ash">{p.publishedAt ? new Date(p.publishedAt).toLocaleString() : "never"}</td>
                  <td className="p-3 text-right"><Link href={`/app/projects/${p.id}`} className="btn btn-outline btn-sm">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="text-sm font-medium">Custom domains</h2>
            <p className="text-xs text-ash mt-1">Available on Starter and above. Point your domain to IDÆVIA hosting:</p>
            <pre className="mt-3 font-mono text-xs bg-void border border-graphite rounded-lg p-3 text-fog">CNAME   www     sites.idaevia.app
A       @       76.76.21.21</pre>
            <p className="text-xs text-ash mt-2">Automatic SSL is issued once DNS propagates. Export the ZIP to deploy anywhere else (Vercel, Netlify, Cloudflare Pages).</p>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-medium">Deploy pipeline</h2>
            <ol className="mt-3 text-xs text-fog space-y-1">
              {["Analyze", "Build", "Test (audit)", "Optimize", "Deploy", "SSL", "Domain", "Live"].map((s, i) => <li key={s} className="flex gap-2"><span className="font-mono text-ash w-4">{i + 1}.</span>{s}</li>)}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
