"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COMPONENTS } from "@/lib/library";
import { componentPreview } from "@/lib/previews";
import { COMPONENT_EXAMPLES, COMPONENT_SOURCES } from "@/lib/component-examples";
import { LivePreview } from "./LivePreview";
import { UseInProject } from "./UseInProject";

type Entry = { id: string; name: string; description: string; prompt: string; html: string; category: string; source: string; technology: string };
const entries: Entry[] = [
  ...COMPONENT_EXAMPLES,
  ...COMPONENTS.map((c) => ({ ...c, description: c.prompt, html: componentPreview(c.id) ?? "", category: "Essentials", source: "essentials", technology: "HTML + CSS + JS" })),
];
const categories = ["All categories", "Motion", "Orbs", "Glass", "Loaders", "3D & shaders", "Essentials"];
const PAGE_SIZE = 9;

export function ComponentCatalog({ selected, onToggle }: { selected?: string[]; onToggle?: (id: string) => void } = {}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const [code, setCode] = useState<Entry | null>(null);
  const [copyState, setCopyState] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const sourceArea = useRef<HTMLTextAreaElement>(null);
  const filtered = useMemo(() => entries.filter((c) => {
    const collection = COMPONENT_SOURCES.find((s) => s.id === c.source);
    return (category === "All categories" || c.category === category) && (source === "all" || c.source === source) && `${c.name} ${c.description} ${c.technology} ${collection?.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [query, category, source]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selectedSource = COMPONENT_SOURCES.find((s) => s.id === source);

  useEffect(() => {
    if (code) dialog.current?.showModal();
    else dialog.current?.close();
  }, [code]);

  async function copy() {
    if (!code) return;
    try { await navigator.clipboard.writeText(code.html); setCopyState("Copied. Paste into an HTML file to run the demo."); }
    catch { sourceArea.current?.focus(); sourceArea.current?.select(); setCopyState("Select and copy the code below with Ctrl+C or ⌘C."); }
  }
  function reset() { setQuery(""); setCategory("All categories"); setSource("all"); setPage(1); }

  return (
    <div className="component-catalog flex-1 overflow-y-auto p-4 sm:p-6">
      <section className="mb-6" aria-label="Component collections">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div><p className="label mb-2">Build with a little more character</p><h2 className="text-2xl font-medium tracking-tight">Motion, material & dimension.</h2><p className="text-sm text-ash mt-2 max-w-2xl">24 new interactive examples inspired by five creative libraries. Explore a preview, inspect the code, then adapt it to your project.</p></div>
          <span className="rounded-full border border-graphite px-3 py-1 text-xs text-ash">{entries.length} components</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-active={source === "all"} onClick={() => { setSource("all"); setPage(1); }} className="component-collection btn btn-ghost btn-sm border border-graphite" aria-pressed={source === "all"}>All collections</button>
          {COMPONENT_SOURCES.map((s) => <button key={s.id} type="button" data-active={source === s.id} aria-pressed={source === s.id} onClick={() => { setSource(s.id); setCategory("All categories"); setPage(1); }} className="component-collection btn btn-ghost btn-sm border border-graphite">{s.name}</button>)}
        </div>
        {selectedSource ? <div className="mt-4 border-l-2 border-graphite pl-4 text-xs text-ash"><p>{selectedSource.description} {selectedSource.note}</p><a href={selectedSource.url} target="_blank" rel="noopener noreferrer" className="inline-block text-paper underline underline-offset-4 mt-2">Explore {selectedSource.name} ↗</a></div> : <p className="text-xs text-ash mt-3">The new demos are original IDÆVIA adaptations, with links to their inspiration. Each card identifies the preview technology.</p>}
      </section>
      <div className="flex flex-wrap gap-3 items-end mb-5">
        <label className="flex-1 min-w-48"><span className="label block mb-1.5">Search components</span><input className="input w-full" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Try orb, glass, SVG or shader…" /></label>
        <label><span className="label block mb-1.5">Category</span><select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <p className="text-xs text-ash pb-3" role="status">{filtered.length} result{filtered.length === 1 ? "" : "s"}</p>
      </div>
      {!filtered.length && <div className="card p-10 text-center"><h3 className="font-medium">No matching components</h3><p className="text-sm text-ash mt-2 mb-4">Try another name, category or collection.</p><button className="btn btn-ghost btn-sm" onClick={reset}>Clear filters</button></div>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((c) => {
          const collection = COMPONENT_SOURCES.find((s) => s.id === c.source);
          return <article key={c.id} className="card p-3 flex flex-col gap-3" data-component-id={c.id}>
            <LivePreview html={c.html} title={c.name} height={220} />
            <div className="px-1 flex-1"><div className="flex items-center justify-between gap-2 mb-2"><span className="label">{c.category}</span><span className="text-xs text-ash">{c.technology}</span></div><h3 className="font-medium text-sm">{c.name}</h3><p className="text-xs text-ash mt-1.5 leading-relaxed">{c.description}</p>{collection && <a className="text-xs text-ash hover:text-paper underline underline-offset-4 mt-3 inline-block" href={collection.url} target="_blank" rel="noopener noreferrer">Inspired by {collection.name} ↗</a>}</div>
            <div className="flex flex-wrap justify-between gap-2 px-1 pb-1"><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCopyState(""); setCode(c); }}>View code</button>{onToggle ? <button type="button" className="btn btn-primary btn-sm" aria-pressed={selected?.includes(c.id) ?? false} disabled={!selected?.includes(c.id) && (selected?.length ?? 0) >= 3} onClick={() => onToggle(c.id)}>{selected?.includes(c.id) ? "Selected ✓" : "Select component"}</button> : <UseInProject prompt={`${c.prompt}${c.prompt.includes("[COMPONENT:") ? "" : ` [COMPONENT:${c.id}]`}`} label="Add to project" />}</div>
          </article>;
        })}
      </div>
      {pages > 1 && <nav className="flex items-center justify-center gap-4 mt-6" aria-label="Component pages"><button className="btn btn-ghost btn-sm disabled:opacity-40" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button><span className="text-xs text-ash">Page {current} of {pages}</span><button className="btn btn-ghost btn-sm disabled:opacity-40" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button></nav>}
      <dialog ref={dialog} aria-labelledby="component-code-title" className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-graphite bg-ink text-paper p-5 backdrop:bg-black/75" onClose={() => setCode(null)}>
        <div className="flex items-center justify-between gap-3 mb-3"><div><h2 id="component-code-title" className="font-medium">{code?.name} · source</h2><p className="text-xs text-ash mt-1">Standalone HTML demo. Add to project adapts it to your selected stack.</p></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setCode(null)} aria-label="Close source code">Close</button></div>
        <textarea ref={sourceArea} className="input w-full h-[50vh] font-mono text-xs resize-none" aria-label="Component source code" readOnly value={code?.html ?? ""} spellCheck={false} />
        <div className="flex flex-wrap gap-3 items-center justify-between mt-3"><span className="text-xs text-ash" role="status">{copyState || "New collection demos are original IDÆVIA implementations."}</span><button type="button" className="btn btn-primary btn-sm" onClick={copy}>Copy code</button></div>
      </dialog>
    </div>
  );
}
