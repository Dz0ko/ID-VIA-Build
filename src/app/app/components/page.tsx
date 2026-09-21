import { COMPONENTS } from "@/lib/library";
import { PageHeader } from "@/components/app/PageHeader";
import { UseInProject } from "@/components/app/UseInProject";

export default function Components() {
  return (
    <>
      <PageHeader title="Components" subtitle="Preview → customise → add to a project" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {COMPONENTS.map((c) => (
            <div key={c.id} className="card p-4 flex flex-col gap-3">
              <div className="font-medium text-sm">{c.name}</div>
              <p className="text-xs text-ash flex-1">{c.prompt}</p>
              <div className="flex justify-end"><UseInProject prompt={c.prompt} label="Add" /></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
