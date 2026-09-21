import { EFFECTS } from "@/lib/library";
import { PageHeader } from "@/components/app/PageHeader";
import { UseInProject } from "@/components/app/UseInProject";

export default function Effects() {
  const groups = ["Hover", "Scroll", "Cursor", "Background"] as const;
  return (
    <>
      <PageHeader title="Effects & animations" subtitle="Hover, scroll, cursor and background effects: no code required" />
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="text-sm font-medium mb-3">{g} effects</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {EFFECTS.filter((e) => e.group === g).map((e) => (
                <div key={e.id} className="card p-4 flex flex-col gap-3">
                  <div className="font-medium text-sm">{e.name}</div>
                  <p className="text-xs text-ash flex-1">{e.description}</p>
                  <div className="flex justify-end"><UseInProject prompt={e.prompt} agent="animation" label="Add to project" /></div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
