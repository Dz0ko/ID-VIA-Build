import { COMPONENTS } from "@/lib/library";
import { componentPreview } from "@/lib/previews";
import { PageHeader } from "@/components/app/PageHeader";
import { UseInProject } from "@/components/app/UseInProject";
import { LivePreview } from "@/components/app/LivePreview";

export default function Components() {
  return (
    <>
      <PageHeader title="Components" subtitle="Live examples: hover and click inside a preview, then add it to a project" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {COMPONENTS.map((c) => {
            const html = componentPreview(c.id);
            return (
              <div key={c.id} className="card p-3 flex flex-col gap-3">
                {html && <LivePreview html={html} title={c.name} />}
                <div className="px-1 flex-1">
                  <div className="font-medium text-sm">{c.name}</div>
                  <p className="text-xs text-ash mt-1">{c.prompt}</p>
                </div>
                <div className="flex justify-end px-1 pb-1"><UseInProject prompt={c.prompt} label="Add to project" /></div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
