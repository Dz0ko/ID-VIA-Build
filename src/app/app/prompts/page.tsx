import { PROMPT_LIBRARY, PROMPT_PACKS } from "@/lib/library";
import { PageHeader } from "@/components/app/PageHeader";
import { UseInProject } from "@/components/app/UseInProject";

export default function Prompts() {
  const cats = Array.from(new Set(PROMPT_LIBRARY.map((p) => p.category)));
  return (
    <>
      <PageHeader title="Prompts" subtitle="Production-ready prompts and prompt packs" />
      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        <section>
          <h2 className="text-sm font-medium mb-3">Prompt packs</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {PROMPT_PACKS.map((pack) => (
              <div key={pack.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="font-medium">{pack.name}</div><div className="text-xs text-ash mt-1">{pack.description}</div></div>
                  <UseInProject label="Run pack" prompt={pack.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.prompt}`).join("\n")} />
                </div>
                <ol className="mt-4 space-y-1.5 text-xs text-fog">
                  {pack.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="font-mono text-ash w-4">{i + 1}.</span><span><span className="text-paper">{s.title}</span>{s.agent && <span className="ml-1 pill text-[10px]">{s.agent}</span>}<span className="block text-ash">{s.prompt}</span></span></li>)}
                </ol>
              </div>
            ))}
          </div>
        </section>
        {cats.map((c) => (
          <section key={c}>
            <h2 className="text-sm font-medium mb-3">{c}</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {PROMPT_LIBRARY.filter((p) => p.category === c).map((p) => (
                <div key={p.id} className="card p-4 flex flex-col gap-3">
                  <div className="font-medium text-sm">{p.title}</div>
                  <p className="text-xs text-ash flex-1">{p.prompt}</p>
                  <div className="flex justify-end"><UseInProject prompt={p.prompt} label="Use prompt" /></div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
