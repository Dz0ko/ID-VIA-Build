"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, Rocket, Download, Monitor, Tablet, Smartphone, Code2, Eye, History, MessageSquare, TerminalSquare, AlertTriangle, Lock, Play, RotateCcw, Save, Activity, ExternalLink, Users, FileCode2, Folder, ChevronRight,
} from "lucide-react";
import type { AgentDef } from "@/lib/agents";
import type { PlanId, ModelTier } from "@/lib/plans";
import type { AuditResult } from "@/lib/audit";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false });

type Version = { id: string; number: number; message: string; createdAt: string };
type Msg = { id: string; role: string; content: string; agentId: string | null; creditsUsed: number; model: string | null; createdAt: string };
type Run = { id: string; agentId: string; status: string; task: string; model: string | null; creditsUsed: number; startedAt: string; finishedAt: string | null; output: string | null };

export interface WorkspaceProps {
  project: {
    id: string; name: string; slug: string; status: string; html: string; description: string | null; health: string | null;
    versions: Version[]; messages: Msg[]; agentRuns: Run[];
  };
  agents: AgentDef[];
  allowedAgentIds: string[];
  minPlanByAgent: Record<string, PlanId>;
  teams: { id: string; name: string; description: string; agents: string[] }[];
  plan: PlanId;
  maxTier: ModelTier;
  credits: number;
  offline: boolean;
}

type LogLine = { t: string; text: string; kind?: "info" | "ok" | "err" };
const TIERS: ModelTier[] = ["fast", "standard", "advanced", "premium"];

export function Workspace(p: WorkspaceProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [html, setHtml] = useState(p.project.html);
  const [savedHtml, setSavedHtml] = useState(p.project.html);
  const [versions, setVersions] = useState(p.project.versions);
  const [messages, setMessages] = useState(p.project.messages);
  const [runs, setRuns] = useState(p.project.agentRuns);
  const [status, setStatus] = useState(p.project.status);
  const [credits, setCredits] = useState(p.credits);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [bottom, setBottom] = useState<"chat" | "changes" | "logs" | "problems" | "terminal">("chat");
  const [agentId, setAgentId] = useState("builder");
  const [tier, setTier] = useState<ModelTier | "auto">("auto");
  const [input, setInput] = useState(params.get("prompt") ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [stream, setStream] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([{ t: now(), text: "Workspace ready.", kind: "info" }]);
  const [audit, setAudit] = useState<AuditResult | null>(p.project.health ? JSON.parse(p.project.health) : null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termLines, setTermLines] = useState<string[]>(["IDÆVIA terminal — type `help`"]);
  const [termInput, setTermInput] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef<string | null>(null);

  const dirty = html !== savedHtml;
  const agent = p.agents.find((a) => a.id === agentId)!;
  const previewSrc = useMemo(() => html || `<!DOCTYPE html><html><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0a0a0b;color:#8a8a93">Describe what to build in the chat below.</body></html>`, [html]);

  const log = useCallback((text: string, kind: LogLine["kind"] = "info") => setLogs((l) => [...l, { t: now(), text, kind }]), []);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, stream]);

  const runOne = useCallback(async (request: string, agentToRun: string) => {
    if (!request.trim() || busyRef.current) return;
    setError(null);
    busyRef.current = agentToRun;
    setBusy(agentToRun);
    setStream("");
    setBottom("chat");
    const optimistic: Msg = { id: `tmp-${Date.now()}`, role: "user", content: request, agentId: agentToRun, creditsUsed: 0, model: null, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    log(`▶ ${agentToRun}: ${request.slice(0, 80)}`);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/projects/${p.project.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, agentId: agentToRun, tier: tier === "auto" ? undefined : tier }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      let usedCredits = 0;
      let mode: "rewrite" | "report" = "rewrite";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "meta") {
            usedCredits = ev.credits;
            setCredits((c) => c - ev.credits);
            log(`Routed → ${ev.tier} tier · ${ev.provider}/${ev.model} · task=${ev.taskClass} · ${ev.credits} credits${ev.fallback ? " · OFFLINE MOCK" : ""}`);
          } else if (ev.type === "delta") {
            acc += ev.text;
            setStream(acc);
          } else if (ev.type === "done") {
            mode = ev.mode;
            if (ev.mode === "rewrite") {
              setHtml(ev.html);
              setSavedHtml(ev.html);
              setVersions((v) => [{ id: `v${ev.versionNumber}`, number: ev.versionNumber, message: `${agentToRun}: ${request.slice(0, 120)}`, createdAt: new Date().toISOString() }, ...v]);
              setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: `Updated the project (v${ev.versionNumber}).`, agentId: agentToRun, creditsUsed: ev.creditsUsed, model: null, createdAt: new Date().toISOString() }]);
              setView("preview");
              log(`✓ v${ev.versionNumber} saved (${ev.creditsUsed} credits)`, "ok");
            } else {
              setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: ev.report, agentId: agentToRun, creditsUsed: ev.creditsUsed, model: null, createdAt: new Date().toISOString() }]);
              log(`✓ ${agentToRun} report ready (${ev.creditsUsed} credits)`, "ok");
            }
            setRuns((r) => [{ id: `r-${Date.now()}`, agentId: agentToRun, status: "DONE", task: request, model: null, creditsUsed: ev.creditsUsed, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), output: mode === "rewrite" ? `v${ev.versionNumber}` : "report" }, ...r]);
          } else if (ev.type === "error") {
            setCredits((c) => c + usedCredits);
            throw new Error(ev.message);
          }
        }
      }
      setStream("");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg);
      log(`✗ ${msg}`, "err");
      setStream("");
      return false;
    } finally {
      busyRef.current = null;
      setBusy(null);
      abortRef.current = null;
      router.refresh();
    }
  }, [log, p.project.id, router, tier]);

  /** Run one agent, or a chain of agents sequentially (agent teams). */
  const run = useCallback(async (request: string, agentToRun: string = agentId, chain: string[] = []) => {
    for (const id of [agentToRun, ...chain]) {
      const ok = await runOne(request, id);
      if (!ok) break;
    }
  }, [agentId, runOne]);

  useEffect(() => {
    if (params.get("auto") === "1" && !autoRan.current && input && !p.project.html) {
      autoRan.current = true;
      const req = input;
      setInput("");
      run(req, "builder");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveCode(asVersion: boolean) {
    const res = await fetch(`/api/projects/${p.project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, saveVersion: asVersion }) });
    const d = await res.json();
    if (res.ok) {
      setSavedHtml(html);
      if (d.versionNumber) setVersions((v) => [{ id: `v${d.versionNumber}`, number: d.versionNumber, message: "Manual edit", createdAt: new Date().toISOString() }, ...v]);
      log(asVersion ? `✓ Saved as v${d.versionNumber}` : "✓ Saved", "ok");
    } else setError(d.error);
  }

  async function restore(n: number) {
    const res = await fetch(`/api/projects/${p.project.id}/versions/${n}`, { method: "POST" });
    const d = await res.json();
    if (res.ok) { setHtml(d.html); setSavedHtml(d.html); setVersions((v) => [{ id: `v${d.versionNumber}`, number: d.versionNumber, message: `Restored v${n}`, createdAt: new Date().toISOString() }, ...v]); log(`↺ Restored v${n} as v${d.versionNumber}`, "ok"); }
  }

  async function previewVersion(n: number) {
    const res = await fetch(`/api/projects/${p.project.id}/versions/${n}`);
    const d = await res.json();
    if (res.ok) { setHtml(d.version.html); setView("preview"); log(`Previewing v${n} (unsaved — Save or Restore to keep)`); }
  }

  async function publish() {
    setPublishing(true);
    if (dirty) await saveCode(false);
    const res = await fetch(`/api/projects/${p.project.id}/publish`, { method: "POST" });
    const d = await res.json();
    setPublishing(false);
    if (res.ok) { setStatus("PUBLISHED"); log(`🚀 Published → ${d.url}`, "ok"); setBottom("logs"); }
    else setError(d.error);
  }

  async function runAudit() {
    if (dirty) await saveCode(false);
    const res = await fetch(`/api/projects/${p.project.id}/audit`, { method: "POST" });
    const d = await res.json();
    if (res.ok) { setAudit(d.audit); setBottom("problems"); log(`Audit: overall ${d.audit.overall}/100, ${d.audit.issues.length} issues`); }
  }

  async function exportZip() {
    const res = await fetch(`/api/projects/${p.project.id}/export`);
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    const blob = await res.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${p.project.slug}.zip`; a.click();
    log("⬇ Exported ZIP", "ok");
  }

  function term(cmd: string) {
    const out: string[] = [`$ ${cmd}`];
    const c = cmd.trim();
    const arg = c.split(/\s+/).slice(1).join(" ");
    if (c === "help") out.push("Commands: ls, cat index.html | head, versions, git log, git checkout v<N>, npm run build, npm run audit, deploy, export, clear, agents, run <agent> <task>");
    else if (c === "ls") out.push("index.html  README.md  versions/  .idaevia/");
    else if (c.startsWith("cat")) out.push(...html.split("\n").slice(0, 20), "…");
    else if (c === "versions" || c === "git log") out.push(...versions.map((v) => `v${String(v.number).padStart(2, "0")}  ${new Date(v.createdAt).toLocaleString()}  ${v.message}`));
    else if (c.startsWith("git checkout v")) { const n = Number(c.replace("git checkout v", "")); restore(n); out.push(`Restoring v${n}…`); }
    else if (c === "npm run build") out.push(`Compiling index.html… ${(Buffer_byteLength(html) / 1024).toFixed(1)} KB`, "✓ Build OK (static, no bundling required)");
    else if (c === "npm run audit") { runAudit(); out.push("Running production audit… see Problems tab"); }
    else if (c === "deploy") { publish(); out.push("Deploying…"); }
    else if (c === "export") { exportZip(); out.push("Exporting…"); }
    else if (c === "clear") { setTermLines([]); return; }
    else if (c === "agents") out.push(...p.agents.map((a) => `${p.allowedAgentIds.includes(a.id) ? "●" : "○"} ${a.id.padEnd(14)} ${a.short}`));
    else if (c.startsWith("run ")) { const [id, ...rest] = arg.split(" "); run(rest.join(" ") || "Improve the project.", id); out.push(`Running ${id}…`); }
    else if (c) out.push(`command not found: ${c}. Try 'help'.`);
    setTermLines((l) => [...l, ...out]);
  }

  const width = device === "desktop" ? "100%" : device === "tablet" ? 820 : 390;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="h-14 shrink-0 border-b border-graphite px-3 flex items-center gap-2">
        <Link href="/app/projects" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{p.project.name}</div>
          <div className="text-[11px] text-ash font-mono truncate">{status === "PUBLISHED" ? `live · /s/${p.project.slug}` : "draft"} · {credits.toLocaleString()} credits</div>
        </div>
        <div className="mx-auto flex items-center gap-1 border border-graphite rounded-full p-0.5">
          <button onClick={() => setView("preview")} className={`btn btn-sm ${view === "preview" ? "btn-primary" : "btn-ghost"}`}><Eye size={13} />Preview</button>
          <button onClick={() => setView("code")} className={`btn btn-sm ${view === "code" ? "btn-primary" : "btn-ghost"}`}><Code2 size={13} />Code</button>
        </div>
        <div className="hidden lg:flex items-center gap-0.5 border border-graphite rounded-full p-0.5">
          {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, I]) => (
            <button key={d} onClick={() => setDevice(d)} className={`btn btn-sm ${device === d ? "bg-graphite" : "btn-ghost"}`} title={d}><I size={13} /></button>
          ))}
        </div>
        {audit && <button onClick={() => setBottom("problems")} className="pill text-xs gap-1.5" title="Project health"><Activity size={11} className={audit.overall >= 90 ? "text-success" : audit.overall >= 70 ? "text-warning" : "text-error"} />{audit.overall}</button>}
        <button onClick={runAudit} className="btn btn-outline btn-sm" title="Production audit"><AlertTriangle size={13} />Audit</button>
        <button onClick={exportZip} className="btn btn-outline btn-sm" title="Export code"><Download size={13} /></button>
        {status === "PUBLISHED" && <a href={`/s/${p.project.slug}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm"><ExternalLink size={13} /></a>}
        <button onClick={publish} disabled={publishing || !html} className="btn btn-signal btn-sm"><Rocket size={13} />{publishing ? "Deploying…" : status === "PUBLISHED" ? "Redeploy" : "Deploy"}</button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr_240px]">
        {/* File explorer */}
        <aside className="border-r border-graphite overflow-y-auto p-2 text-xs">
          <div className="label px-2 py-1">Explorer</div>
          <div className="px-2 py-1 flex items-center gap-1.5 text-fog"><Folder size={12} className="text-ash" />{p.project.slug}</div>
          <button onClick={() => setView("code")} className={`w-full text-left px-2 py-1 pl-6 flex items-center gap-1.5 rounded ${view === "code" ? "bg-graphite text-paper" : "text-fog hover:bg-ink"}`}><FileCode2 size={12} className="text-signal-soft" />index.html{dirty && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-warning" />}</button>
          <div className="px-2 py-1 pl-6 text-ash flex items-center gap-1.5"><FileCode2 size={12} />README.md</div>
          <div className="px-2 py-1 pl-6 text-ash flex items-center gap-1.5"><Folder size={12} />public/</div>
          <div className="label px-2 py-1 mt-4 flex items-center gap-1"><History size={11} />Versions</div>
          {versions.length === 0 && <div className="px-2 text-ash">No versions yet.</div>}
          {versions.map((v) => (
            <div key={v.id} className="group px-2 py-1 rounded hover:bg-ink">
              <button onClick={() => previewVersion(v.number)} className="w-full text-left flex items-center gap-1.5"><ChevronRight size={10} className="text-ash" /><span className="font-mono text-signal-soft">v{String(v.number).padStart(2, "0")}</span><span className="truncate text-fog">{v.message}</span></button>
              <button onClick={() => restore(v.number)} className="hidden group-hover:flex items-center gap-1 pl-5 text-[10px] text-ash hover:text-paper"><RotateCcw size={9} />restore</button>
            </div>
          ))}
        </aside>

        {/* Center */}
        <section className="min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 bg-[#050506] p-3 overflow-auto">
            {view === "preview" ? (
              <div className="h-full mx-auto bg-white rounded-lg overflow-hidden border border-graphite transition-all" style={{ width, maxWidth: "100%" }}>
                <iframe title="preview" srcDoc={previewSrc} className="w-full h-full" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              </div>
            ) : (
              <div className="h-full flex flex-col rounded-lg overflow-hidden border border-graphite">
                <div className="h-9 flex items-center gap-2 px-3 bg-ink border-b border-graphite text-xs">
                  <span className="font-mono text-fog">index.html</span>
                  {dirty && <span className="text-warning">● unsaved</span>}
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => saveCode(false)} disabled={!dirty} className="btn btn-ghost btn-sm"><Save size={12} />Save</button>
                    <button onClick={() => saveCode(true)} disabled={!dirty} className="btn btn-outline btn-sm">Save as version</button>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <MonacoEditor height="100%" language="html" theme="vs-dark" value={html} onChange={(v) => setHtml(v ?? "")} options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on", fontFamily: "JetBrains Mono, monospace", scrollBeyondLastLine: false }} />
                </div>
              </div>
            )}
          </div>

          {/* Bottom panel */}
          <div className="h-[280px] shrink-0 border-t border-graphite flex flex-col">
            <div className="h-9 flex items-center gap-1 px-2 border-b border-graphite text-xs">
              {([["chat", "AI Chat", MessageSquare], ["changes", "Changes", History], ["terminal", "Terminal", TerminalSquare], ["logs", "Logs", Activity], ["problems", "Problems", AlertTriangle]] as const).map(([id, label, I]) => (
                <button key={id} onClick={() => setBottom(id)} className={`btn btn-sm ${bottom === id ? "bg-graphite text-paper" : "btn-ghost"}`}><I size={12} />{label}{id === "problems" && audit?.issues.length ? <span className="ml-1 text-[10px] text-warning">{audit.issues.length}</span> : null}</button>
              ))}
              {busy && <span className="ml-auto flex items-center gap-2 text-signal-soft"><span className="w-1.5 h-1.5 rounded-full bg-signal pulse-dot" />{busy} working…<button onClick={() => abortRef.current?.abort()} className="text-ash hover:text-paper">stop</button></span>}
            </div>

            {bottom === "chat" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
                  {messages.length === 0 && !stream && <div className="text-ash text-xs">Describe what you want. Example: “Build a dark SaaS landing page for an AI CRM with pricing and FAQ.”</div>}
                  {messages.map((m) => (
                    <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.role === "user" ? "ml-auto bg-graphite rounded-br-sm" : "border border-graphite rounded-bl-sm text-fog"}`}>
                      {m.role !== "user" && <div className="font-mono text-[10px] text-signal-soft mb-1">{m.agentId ?? "assistant"}{m.creditsUsed ? ` · ${m.creditsUsed} cr` : ""}</div>}
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    </div>
                  ))}
                  {stream && (
                    <div className="max-w-[85%] rounded-2xl px-3 py-2 border border-graphite rounded-bl-sm text-fog">
                      <div className="font-mono text-[10px] text-signal-soft mb-1">{busy} · streaming</div>
                      <pre className="font-mono text-[11px] whitespace-pre-wrap break-words max-h-32 overflow-hidden text-ash">{stream.slice(-1200)}</pre>
                    </div>
                  )}
                  {error && <div className="text-error text-xs">{error}</div>}
                  <div ref={chatEnd} />
                </div>
                <form onSubmit={(e) => { e.preventDefault(); const r = input; setInput(""); run(r); }} className="p-2 border-t border-graphite flex gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="input py-1.5 text-xs w-36">
                      {p.agents.map((a) => <option key={a.id} value={a.id} disabled={!p.allowedAgentIds.includes(a.id)}>{a.name}{p.allowedAgentIds.includes(a.id) ? "" : ` (${p.minPlanByAgent[a.id]})`}</option>)}
                    </select>
                    <select value={tier} onChange={(e) => setTier(e.target.value as ModelTier | "auto")} className="input py-1.5 text-xs w-36">
                      <option value="auto">Auto routing</option>
                      {TIERS.map((t) => <option key={t} value={t} disabled={TIERS.indexOf(t) > TIERS.indexOf(p.maxTier)}>{t} tier{TIERS.indexOf(t) > TIERS.indexOf(p.maxTier) ? " (upgrade)" : ""}</option>)}
                    </select>
                  </div>
                  <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const r = input; setInput(""); run(r); } }} rows={2} className="input flex-1 resize-none" placeholder={agent.mode === "rewrite" ? "What should the AI build or change?" : `Ask ${agent.name} for a report…`} />
                  <button disabled={!!busy || !input.trim()} className="btn btn-primary"><Play size={14} />Run</button>
                </form>
              </div>
            )}

            {bottom === "changes" && (
              <div className="flex-1 overflow-y-auto p-3 text-xs">
                {runs.length === 0 && <div className="text-ash">No agent runs yet.</div>}
                <table className="w-full">
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-b border-graphite/60">
                        <td className="py-1.5 pr-3 font-mono text-signal-soft">{r.agentId}</td>
                        <td className="py-1.5 pr-3 text-fog truncate max-w-[380px]">{r.task}</td>
                        <td className="py-1.5 pr-3 text-ash">{r.output?.startsWith("v") ? r.output : r.status}</td>
                        <td className="py-1.5 pr-3 text-ash">{r.creditsUsed} cr</td>
                        <td className="py-1.5 text-ash">{new Date(r.startedAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bottom === "terminal" && (
              <div className="flex-1 min-h-0 flex flex-col font-mono text-xs bg-[#050506]">
                <div className="flex-1 overflow-y-auto p-3 space-y-0.5 text-fog">{termLines.map((l, i) => <div key={i} className={l.startsWith("$") ? "text-paper" : ""}>{l}</div>)}</div>
                <form onSubmit={(e) => { e.preventDefault(); term(termInput); setTermInput(""); }} className="flex items-center gap-2 px-3 py-2 border-t border-graphite"><span className="text-signal-soft">$</span><input value={termInput} onChange={(e) => setTermInput(e.target.value)} className="flex-1 bg-transparent outline-none" placeholder="npm run build" autoFocus /></form>
              </div>
            )}

            {bottom === "logs" && (
              <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
                {logs.map((l, i) => <div key={i} className={l.kind === "err" ? "text-error" : l.kind === "ok" ? "text-success" : "text-fog"}><span className="text-ash">{l.t}</span> {l.text}</div>)}
              </div>
            )}

            {bottom === "problems" && (
              <div className="flex-1 overflow-y-auto p-3 text-xs">
                {!audit ? (
                  <div className="text-ash">Run an audit to see Performance, SEO, Accessibility, Security, Code and Mobile scores. <button onClick={runAudit} className="text-signal-soft underline">Run now</button></div>
                ) : (
                  <>
                    <div className="grid grid-cols-7 gap-2 mb-3">
                      {([["Overall", audit.overall], ["Performance", audit.performance], ["SEO", audit.seo], ["A11y", audit.accessibility], ["Security", audit.security], ["Code", audit.codeQuality], ["Mobile", audit.mobile]] as const).map(([l, v]) => (
                        <div key={l} className="card p-2"><div className="text-[10px] text-ash">{l}</div><div className={`text-lg font-semibold ${v >= 90 ? "text-success" : v >= 70 ? "text-warning" : "text-error"}`}>{v}</div></div>
                      ))}
                    </div>
                    {audit.issues.length === 0 ? <div className="text-success">No issues found. Production ready.</div> : (
                      <div className="space-y-1">
                        {audit.issues.map((i, k) => <div key={k} className="flex gap-2"><span className={`pill text-[10px] ${i.severity === "high" ? "text-error border-error/40" : i.severity === "medium" ? "text-warning border-warning/40" : ""}`}>{i.area}</span><span className="text-fog">{i.message}</span></div>)}
                        <button disabled={!!busy} onClick={() => run(`Fix all of these audit issues without changing the design:\n- ${audit.issues.map((i) => i.message).join("\n- ")}`, "debugger")} className="btn btn-signal btn-sm mt-2">Fix all with Debugger</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* AI team */}
        <aside className="border-l border-graphite overflow-y-auto p-2 text-xs">
          <div className="label px-2 py-1 flex items-center gap-1"><Users size={11} />AI team</div>
          {p.offline && <div className="mx-2 mb-2 rounded border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">Offline mode — add an API key for real agents.</div>}
          <div className="label px-2 py-1 mt-1">One-click</div>
          <div className="px-2 grid gap-1 mb-2">
            {[["Make it Premium", "make-premium"], ["Improve Project", "optimize-landing"], ["Production Ready", "production-ready"]].map(([l, id]) => {
              const team = p.teams.find((t) => t.id === id)!;
              const locked = team.agents.some((a) => !p.allowedAgentIds.includes(a));
              return <button key={id} disabled={!!busy || locked} onClick={() => run(`${l}: improve the project for this goal.`, team.agents[0], team.agents.slice(1))} className="btn btn-outline btn-sm justify-between" title={team.description}>{l}{locked && <Lock size={10} />}</button>;
            })}
            <button disabled={!!busy} onClick={() => run("Make the entire site work perfectly on mobile: fix overflow, spacing, typography, navigation, grids and touch targets.", "builder")} className="btn btn-outline btn-sm">Make it Mobile</button>
          </div>
          <div className="label px-2 py-1">Agent teams</div>
          <div className="px-2 grid gap-1 mb-2">
            {p.teams.map((t) => {
              const locked = t.agents.some((a) => !p.allowedAgentIds.includes(a));
              return <button key={t.id} disabled={!!busy || locked} onClick={() => run(input || `Run the ${t.name} workflow on this project.`, t.agents[0], t.agents.slice(1))} className="text-left rounded-lg border border-graphite px-2 py-1.5 hover:border-ash disabled:opacity-50 min-w-0 overflow-hidden" title={t.description}><div className="font-medium flex items-center justify-between">{t.name}{locked && <Lock size={10} className="text-ash" />}</div><div className="text-[10px] text-ash truncate">{t.description}</div></button>;
            })}
          </div>
          <div className="label px-2 py-1">Agents</div>
          {p.agents.map((a) => {
            const allowed = p.allowedAgentIds.includes(a.id);
            const active = busy === a.id;
            return (
              <button key={a.id} disabled={!allowed} onClick={() => { setAgentId(a.id); setBottom("chat"); }} className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 ${agentId === a.id ? "bg-graphite" : "hover:bg-ink"} ${allowed ? "" : "opacity-50"}`} title={a.description}>
                <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-success pulse-dot" : allowed ? "bg-ash/50" : "bg-graphite"}`} />
                <span className="flex-1 min-w-0"><span className="block text-fog">{a.name}</span><span className="block text-[10px] text-ash truncate">{a.short}</span></span>
                {!allowed && <span className="text-[9px] text-ash flex items-center gap-0.5"><Lock size={9} />{p.minPlanByAgent[a.id]}</span>}
              </button>
            );
          })}
        </aside>
      </div>
    </div>
  );
}

function now() {
  return new Date().toLocaleTimeString([], { hour12: false });
}
function Buffer_byteLength(s: string) {
  return new TextEncoder().encode(s).length;
}
