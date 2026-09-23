"use client";

import { Markdown } from "@/components/Markdown";
import { useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; role: string; content: string; authorName: string | null; createdAt: string };
type Snapshot = { thread: { id: string; status: string; assignedTo?: string; botPending: boolean; user?: { name: string | null; email: string } }; messages: Message[]; hasMore: boolean };
const statuses: Record<string, string> = { BOT: "Automated support", WAITING: "Waiting for a manager", HUMAN: "Manager conversation", CLOSED: "Resolved" };
async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Support is unavailable. Please try again.");
  return body;
}

export function SupportChat({ threadId, adminId }: { threadId?: string; adminId?: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [older, setOlder] = useState<Message[]>([]);
  const [more, setMore] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Connecting…");
  const [attempt, setAttempt] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const apply = useCallback((next: Snapshot) => {
    setData(previous => previous?.thread.id === next.thread.id ? { ...next, messages: [...new Map([...previous.messages, ...next.messages].map(message => [message.id, message])).values()].sort((a, b) => a.id.localeCompare(b.id)), hasMore: previous.hasMore } : next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    request(threadId ? `/api/support/${threadId}` : "/api/support", threadId ? undefined : { method: "POST" }).then(next => {
      if (!cancelled) { apply(next); setMore(next.hasMore); setError(""); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [threadId, apply, attempt]);
  const id = data?.thread.id;
  useEffect(() => {
    if (!id) return;
    let source: EventSource | null = null;
    const connect = () => {
      source?.close(); source = null;
      if (document.hidden) return;
      source = new EventSource(`/api/support/${id}/events`);
      source.onopen = () => setConnection("Live updates connected");
      source.onmessage = event => { try { apply(JSON.parse(event.data)); } catch { setConnection("Reconnecting…"); } };
      source.onerror = () => setConnection("Reconnecting… Your messages are saved.");
    };
    connect(); document.addEventListener("visibilitychange", connect);
    return () => { source?.close(); document.removeEventListener("visibilitychange", connect); };
  }, [id, apply]);
  const lastId = data?.messages.at(-1)?.id;
  useEffect(() => { if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [lastId, data?.thread.botPending]);

  async function send(action = "message") {
    if (!id || busy || (action === "message" && !text.trim())) return;
    const key = `${action}:${text.trim()}`;
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    setBusy(true); setError(""); follow.current = true;
    try {
      const next = await request(`/api/support/${id}`, { method: "POST", body: JSON.stringify({ action, asManager: !!adminId, message: action === "message" ? text.trim() : undefined, clientId: retry.current.id }) });
      apply(next); if (action === "message") setText(""); retry.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : "Message not sent. Try again."); }
    finally { setBusy(false); }
  }
  async function loadOlder() {
    if (!id || !data || busy) return;
    setBusy(true); setError("");
    try {
      const before = older[0]?.id ?? data.messages[0]?.id;
      const next = await request(`/api/support/${id}?before=${encodeURIComponent(before ?? "")}`) as Snapshot;
      follow.current = false; setOlder(previous => [...next.messages, ...previous]); setMore(next.hasMore);
    } catch { setError("Could not load earlier messages. Try again."); }
    finally { setBusy(false); }
  }
  const messages = [...new Map([...older, ...(data?.messages ?? [])].map(message => [message.id, message])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const ownedByOther = !!adminId && !!data?.thread.assignedTo && data.thread.assignedTo !== adminId;
  return <section className="flex flex-col min-h-0 h-full rounded-2xl border border-graphite bg-ink overflow-hidden" aria-label="Support conversation">
    <header className="p-5 border-b border-graphite flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-medium">{adminId ? data?.thread.user?.name || data?.thread.user?.email || "Conversation" : "IDÆVIA Live Support"}</h2><p className="text-xs text-ash mt-1">{data ? statuses[data.thread.status] : "Loading conversation…"}</p>{adminId && <p className="text-xs text-ash mt-1">{data?.thread.user?.email}</p>}</div>
      <div className="flex gap-2">{adminId ? <><button className="btn btn-ghost btn-sm" disabled={!data || busy} onClick={() => void send("claim")}>{ownedByOther ? "Take over" : "Join conversation"}</button><button className="btn btn-ghost btn-sm" disabled={!data || busy || ownedByOther || data.thread.status === "CLOSED"} onClick={() => void send("close")}>Resolve</button></> : <button className="btn btn-ghost btn-sm" disabled={!data || busy || ["WAITING", "HUMAN"].includes(data.thread.status)} onClick={() => void send("handoff")}>Talk to a person</button>}</div>
    </header>
    <div ref={scroll} onScroll={() => { if (scroll.current) follow.current = scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 100; }} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
      {more && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void loadOlder()}>Load earlier messages</button>}
      {!messages.length && <div className="max-w-lg text-sm text-fog leading-relaxed"><p>Hi, I’m IDÆVIA’s automated support assistant. Tell me what you need help with and I’ll guide you through it.</p><p className="text-xs text-ash mt-3">You can ask for a manager at any time. Never share passwords, API keys or payment details. Support does not use your project credits.</p></div>}
      <div role="log" aria-label="Support messages" aria-live="polite" aria-relevant="additions" className="space-y-4">{messages.map(message => <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[90%] rounded-xl bg-graphite p-4" : "mr-auto max-w-[90%] rounded-xl border border-graphite p-4"}><div className="text-xs text-ash mb-2">{message.role === "user" ? (adminId ? "Customer" : "You") : message.role === "system" ? "Conversation update" : message.authorName || "IDÆVIA Live Support · automated"} · <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.role === "assistant" ? <Markdown text={message.content} /> : message.content}</div></article>)}</div>
      {data?.thread.botPending && <p role="status" className="text-xs text-ash">IDÆVIA support is writing…</p>}
      {data?.thread.status === "WAITING" && <p className="text-xs text-ash">A manager will reply here when available. Your conversation stays saved if you leave.</p>}
    </div>
    <form className="p-4 border-t border-graphite" onSubmit={event => { event.preventDefault(); void send(); }}>
      {error && <p role="alert" className="text-sm text-red-400 mb-3">{error} {!data && <button type="button" className="underline" onClick={() => setAttempt(x => x + 1)}>Retry</button>}</p>}
      <label htmlFor="support-message" className="sr-only">Message support</label><textarea id="support-message" value={text} onChange={event => setText(event.target.value)} maxLength={4000} disabled={busy} placeholder={adminId ? "Reply to the customer…" : "How can we help?"} rows={3} className="input w-full resize-none" />
      <div className="flex justify-between items-center gap-3 mt-3"><span role="status" className="text-xs text-ash">{connection}</span><button className="btn btn-primary btn-sm" disabled={!data || busy || !text.trim() || ownedByOther || (!adminId && data.thread.botPending)}>{busy ? "Sending…" : "Send message"}</button></div>
    </form>
  </section>;
}
