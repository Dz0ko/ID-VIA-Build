"use client";

import { Markdown } from "@/components/Markdown";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkle, Send, Trash2, FilePlus2, Lightbulb, Palette, LayoutTemplate, Rocket } from "@/components/icons";
import { parseActions, type AssistantAction } from "@/lib/assistant";

type Msg = { id: string; role: string; content: string; createdAt?: string };

const STARTERS = [
  { icon: Lightbulb, label: "Give me 5 SaaS ideas I could build this week", text: "Give me 5 SaaS product ideas I could build this week with IDÆVIA. For each: audience, core value, key screens, monetisation." },
  { icon: Palette, label: "Design direction for a fintech landing page", text: "Design a premium landing page for a fintech app: palette with hex codes, typography, section layout, motion and which of your templates and effects to use." },
  { icon: LayoutTemplate, label: "Which template fits a restaurant?", text: "Which of your templates, prompts, components and effects should I use for a restaurant website in Skopje? Then write the build brief." },
  { icon: Rocket, label: "Plan a dashboard for a delivery startup", text: "Plan and design an operations dashboard app for a food delivery startup: screens, components, data model and a build brief." },
];

export function AssistantChat({ offline, name }: { offline: boolean; name: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [stream, setStream] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const d = await fetch("/api/assistant").then((r) => r.json()).catch(() => ({}));
      setMessages(d.messages ?? []);
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, stream]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null); setInput("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text }]);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Request failed"); }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = ""; let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "delta") { acc += ev.text; setStream(acc); }
          else if (ev.type === "done") { setMessages((m) => [...m, { id: ev.id, role: "assistant", content: ev.content }]); setStream(""); }
          else if (ev.type === "error") throw new Error(ev.message);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStream("");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }, [busy, router]);

  async function createProject(a: AssistantAction) {
    setCreating(a.name);
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: a.name, kind: a.kind, description: a.prompt }) });
    const d = await res.json();
    setCreating(null);
    if (!res.ok) return setError(d.error);
    router.push(`/app/projects/${d.project.id}?prompt=${encodeURIComponent(a.prompt)}&auto=1`);
  }
  async function clear() {
    if (!confirm("Clear the whole conversation with the IDÆVIA Agent?")) return;
    await fetch("/api/assistant", { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {offline && <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning">Offline mode: the agent answers with built-in ideas. Add an AI provider key in .env for real conversations.</div>}
          {loaded && messages.length === 0 && !stream && (
            <div className="text-center py-10">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-paper text-void grid place-items-center text-2xl font-semibold relative">Æ<span className="absolute w-2.5 h-2.5 rounded-full bg-signal right-1.5 bottom-1.5" /></div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">Hi {name.split(" ")[0]}, I am the IDÆVIA Agent.</h2>
              <p className="mt-2 text-sm text-ash max-w-md mx-auto">I designed the templates, prompts, components and effects in IDÆVIA. Ask me for project ideas, a design direction, or tell me what to design and I will hand a ready brief to the Builder.</p>
              <div className="mt-6 grid sm:grid-cols-2 gap-2 text-left">
                {STARTERS.map((s) => <button key={s.label} onClick={() => send(s.text)} className="card p-3 text-sm text-fog hover:border-ash transition flex items-start gap-3"><s.icon size={16} className="text-signal-soft mt-0.5 shrink-0" />{s.label}</button>)}
              </div>
            </div>
          )}
          {messages.map((m) => <Bubble key={m.id} m={m} onCreate={createProject} creating={creating} />)}
          {stream && <Bubble m={{ id: "stream", role: "assistant", content: stream }} onCreate={createProject} creating={creating} streaming />}
          {error && <div className="text-sm text-error">{error}</div>}
          <div ref={end} />
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-graphite p-3">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={2} className="input flex-1 resize-none" placeholder="Ask for ideas, a design direction, or say what to design…" />
          <button disabled={busy || !input.trim()} className="btn btn-primary"><Send size={14} />Send</button>
          {messages.length > 0 && <button type="button" onClick={clear} className="btn btn-ghost btn-sm text-ash" title="Clear conversation"><Trash2 size={14} /></button>}
        </div>
      </form>
    </div>
  );
}

function Bubble({ m, onCreate, creating, streaming }: { m: Msg; onCreate: (a: AssistantAction) => void; creating: string | null; streaming?: boolean }) {
  if (m.role === "user") return <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-graphite px-4 py-2.5 text-sm whitespace-pre-wrap">{m.content}</div>;
  const { text, actions } = parseActions(m.content);
  return (
    <div className="max-w-[92%] flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-paper text-void grid place-items-center text-xs font-semibold shrink-0 mt-1"><Sparkle size={13} /></div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-bl-sm border border-graphite px-4 py-3 text-sm text-fog">
          <Markdown text={streaming ? text.replace(/<<<ACTION[\s\S]*$/, "") : text} />
        </div>
        {!streaming && actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {actions.map((a, i) => (
              <button key={i} disabled={creating !== null} onClick={() => onCreate(a)} className="btn btn-signal btn-sm" title={a.prompt}><FilePlus2 size={12} />{creating === a.name ? "Creating…" : `Create “${a.name}”`}<span className="pill text-[9px] ml-1 border-paper/30">{a.kind === "app" ? "React app" : "website"}</span></button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
