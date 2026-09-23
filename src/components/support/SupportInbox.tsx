"use client";
import { useEffect, useState } from "react";
import { SupportChat } from "./SupportChat";
type Thread = { id: string; status: string; user: { name: string | null; email: string }; messages: { content: string; role: string }[] };
export function SupportInbox({ adminId }: { adminId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      if (controller.signal.aborted) return;
      try {
        if (!document.hidden) {
          const response = await fetch(`/api/admin/support?${new URLSearchParams({ status, q: query, page: String(page) })}`, { signal: controller.signal, cache: "no-store" });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          setThreads(body.threads); setTotal(body.total); setError("");
        }
      } catch { if (!controller.signal.aborted) setError("Could not refresh conversations. Retrying…"); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 5000); }
    }
    timer = setTimeout(refresh, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [status, query, page]);
  return <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-5 h-[calc(100dvh-190px)] min-h-[500px]">
    <aside className="flex flex-col min-h-0 gap-3"><input className="input w-full" aria-label="Search support customers" placeholder="Search name or email…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /><select className="input w-full" aria-label="Conversation status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All conversations</option><option value="WAITING">Waiting for a manager</option><option value="HUMAN">With a manager</option><option value="BOT">Automated support</option><option value="CLOSED">Resolved</option></select>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      <div className="flex-1 overflow-y-auto space-y-2">{threads.map(thread => <button key={thread.id} onClick={() => setSelected(thread.id)} aria-pressed={selected === thread.id} className={selected === thread.id ? "w-full text-left rounded-xl border border-signal bg-graphite p-3" : "w-full text-left rounded-xl border border-graphite p-3 hover:bg-graphite"}><p className="text-sm truncate">{thread.user.name || thread.user.email}</p><p className="text-xs text-ash mt-1">{thread.status === "WAITING" ? "Waiting for you" : thread.status === "HUMAN" ? "With a manager" : thread.status === "CLOSED" ? "Resolved" : "Automated support"}</p><p className="text-xs text-fog mt-2 truncate">{thread.messages[0]?.content || "New conversation"}</p></button>)}{!threads.length && <p className="text-sm text-ash p-4">No conversations in this view.</p>}</div>
      <div className="flex justify-between items-center text-xs text-ash"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(x => x - 1)}>Previous</button><span>{page} / {Math.max(1, Math.ceil(total / 30))}</span><button className="btn btn-ghost btn-sm" disabled={page * 30 >= total} onClick={() => setPage(x => x + 1)}>Next</button></div>
    </aside>
    {selected ? <SupportChat key={selected} threadId={selected} adminId={adminId} /> : <div className="rounded-2xl border border-graphite flex items-center justify-center text-sm text-ash">Select a conversation to read and reply.</div>}
  </div>;
}
