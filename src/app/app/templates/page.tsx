import Link from "next/link";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates";
import { PageHeader } from "@/components/app/PageHeader";

export default async function Templates({ searchParams }: PageProps<"/app/templates">) {
  const sp = await searchParams;
  const cat = typeof sp.category === "string" ? sp.category : "";
  const list = cat ? TEMPLATES.filter((t) => t.category === cat) : TEMPLATES;
  return (
    <>
      <PageHeader title="Templates" subtitle={`${TEMPLATES.length} production-ready, AI-remixable templates`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-wrap gap-1.5 mb-6">
          <Link href="/app/templates" className={`pill ${!cat ? "border-signal text-signal-soft" : ""}`}>All</Link>
          {TEMPLATE_CATEGORIES.map((c) => <Link key={c} href={`/app/templates?category=${encodeURIComponent(c)}`} className={`pill ${cat === c ? "border-signal text-signal-soft" : ""}`}>{c}</Link>)}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((t) => (
            <div key={t.id} className="card overflow-hidden flex flex-col">
              <div className="h-40 bg-void border-b border-graphite overflow-hidden">
                <iframe title={t.name} src={`/api/templates/${t.id}`} sandbox="allow-scripts" className="w-[1200px] h-[800px] origin-top-left pointer-events-none" style={{ transform: "scale(0.25)" }} loading="lazy" />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-ash mt-1 flex-1">{t.description}</div>
                <div className="mt-3 flex gap-2">
                  <a href={`/api/templates/${t.id}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">Preview</a>
                  <Link href={`/app?template=${t.id}`} className="btn btn-primary btn-sm">Use template</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
