import { MODERN_COMPONENTS } from "@/lib/modern-components";
import { EFFECTS } from "@/lib/library";
import { effectPreview } from "@/lib/previews";
import { PageHeader } from "@/components/app/PageHeader";
import { UseInProject } from "@/components/app/UseInProject";
import { LivePreview } from "@/components/app/LivePreview";

export default function Effects() {
  const effects = [
    ...MODERN_COMPONENTS.map((entry) => ({ ...entry, group: entry.category })),
    ...EFFECTS.map((entry) => ({ ...entry, html: effectPreview(entry.id) })),
  ];
  const groups = [...new Set(effects.map((entry) => entry.group))];
  return (
    <>
      <PageHeader title="Effects & animations" subtitle="Live examples: move the cursor or scroll inside a preview to see the effect" />
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="text-sm font-medium mb-3">{g}</h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {effects.filter((e) => e.group === g).map((e) => {
                const html = e.html;
                return (
                  <div key={e.id} className="card catalog-card flex flex-col">
                    {html && <LivePreview html={html} title={e.name} height={220} />}
                    <div className="catalog-card-copy flex-1">
                      <div className="font-medium text-sm">{e.name}</div>
                      <p className="text-xs text-ash mt-1">{e.description}</p>
                    </div>
                    <div className="catalog-card-footer flex justify-end"><UseInProject prompt={e.prompt} agent="animation" label="Add to project" /></div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
