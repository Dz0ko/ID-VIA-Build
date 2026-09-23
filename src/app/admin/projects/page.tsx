import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/finance";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export default async function AdminProjects({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key].slice(0, 200) : "";
  const q = value("q").trim(), owner = value("owner"), status = value("status");
  const where: Prisma.ProjectWhereInput = {
    ...(owner ? { userId: owner } : {}),
    ...(["DRAFT", "PUBLISHED"].includes(status) ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }, { user: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const total = await db.project.count({ where });
  const pages = Math.max(1, Math.ceil(total / 25));
  const page = Math.min(pages, Math.max(1, Number.parseInt(value("page"), 10) || 1));
  const projects = await db.project.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 25, skip: (page - 1) * 25, select: { id: true, name: true, kind: true, status: true, createdAt: true, updatedAt: true, user: { select: { email: true, name: true } }, _count: { select: { files: true, versions: true } } } });
  const pageUrl = (n: number) => `/admin/projects?${new URLSearchParams({ q, owner, status, page: String(n) })}`;
  return <div className="space-y-5">
    <form className="flex flex-wrap items-end gap-3" action="/admin/projects">
      {owner && <input type="hidden" name="owner" value={owner} />}
      <label className="flex-1 text-xs text-fog space-y-2">Project or owner<input className="input w-full" name="q" placeholder="Search project, email or name…" defaultValue={q} /></label>
      <label className="text-xs text-fog space-y-2">Status<select className="input" name="status" defaultValue={status}><option value="">All statuses</option><option>DRAFT</option><option>PUBLISHED</option></select></label>
      <button className="btn btn-primary" type="submit">Search</button>
      {(q || owner || status) && <Link href="/admin/projects" className="btn btn-outline">Clear filters</Link>}
    </form>
    <div className="flex justify-between text-sm text-fog"><span>{total} projects{owner ? " · filtered by owner" : ""}</span><span>Newest first · read-only</span></div>
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Project", "Owner", "Status", "Files / versions", "Created", "Updated"].map(h => <th key={h} className="p-4 text-left text-xs font-medium text-fog">{h}</th>)}</tr></thead><tbody>
      {projects.map(p => <tr key={p.id} className="border-t border-graphite"><td className="p-4"><Link href={`/admin/projects/${p.id}`} className="font-medium underline underline-offset-4">{p.name}</Link><p className="text-xs text-ash mt-1">{p.kind}</p></td><td className="p-4"><div>{p.user.name !== p.user.email ? p.user.name : null}</div><span className="text-xs text-fog break-all">{p.user.email}</span></td><td className="p-4 text-xs">{p.status}</td><td className="p-4 tabular-nums">{p._count.files} / {p._count.versions}</td><td className="p-4 text-xs whitespace-nowrap">{p.createdAt.toISOString().slice(0, 10)}</td><td className="p-4 text-xs whitespace-nowrap">{p.updatedAt.toISOString().slice(0, 10)}</td></tr>)}
      {!projects.length && <tr><td colSpan={6} className="p-10 text-center text-fog">No projects match these filters.</td></tr>}
    </tbody></table></div>
    <nav aria-label="Project pages" className="flex items-center justify-between text-sm"><span>Page {page} of {pages}</span><div className="flex gap-3">{page > 1 && <Link href={pageUrl(page - 1)} className="btn btn-outline btn-sm">Previous</Link>}{page < pages && <Link href={pageUrl(page + 1)} className="btn btn-outline btn-sm">Next</Link>}</div></nav>
  </div>;
}
