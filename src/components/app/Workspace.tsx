"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, Rocket, Download, Monitor, Tablet, Smartphone, Code2, Eye, History, MessageSquare, TerminalSquare, AlertTriangle, Lock, Play, RotateCcw, Save, Activity, ExternalLink, Users, FileCode2, Folder, ChevronRight, Image as ImageIcon, X, Share2, Link2, Trash2, CheckCircle2,
} from "@/components/icons";
import { shellIntent } from "@/lib/shell-intent";
import { runtimeCommand } from "@/lib/runtime-command";
import { ComposerSelect } from "./ComposerSelect";
import { WorkspaceMenuButton } from "./Shell";
import type { AgentDef } from "@/lib/agents";
import type { PlanId, ModelTier } from "@/lib/plans";
import { MODEL_TIERS } from "@/lib/plans";
import type { AuditResult } from "@/lib/audit";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false });
const ShellTerminal = dynamic(() => import("./ShellTerminal").then((m) => m.ShellTerminal), { ssr: false });
const AppSandbox = dynamic(() => import("./AppSandbox").then((m) => m.AppSandbox), { ssr: false });

type Version = { id: string; number: number; message: string; createdAt: string };
type Msg = { id: string; role: string; content: string; agentId: string | null; creditsUsed: number; model: string | null; createdAt: string };
type Run = { id: string; agentId: string; status: string; task: string; model: string | null; creditsUsed: number; startedAt: string; finishedAt: string | null; output: string | null };
type ProjFile = { path: string; content: string };
type ShareLink = { id: string; token: string; label: string | null; hasPassword: boolean; canComment: boolean; canApprove: boolean; createdAt: string };
type Comment = { id: string; authorName: string; body: string; kind: string; resolved: boolean; createdAt: string };
type CustomAgent = { id: string; name: string; description: string; tier: string; mode: string };
type RefImage = { name: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string };

export interface WorkspaceProps {
  project: {
    id: string; name: string; slug: string; status: string; kind: string; html: string; description: string | null; health: string | null; clientStatus: string;
    versions: Version[]; messages: Msg[]; agentRuns: Run[]; files: ProjFile[];
  };
  agents: AgentDef[];
  customAgents: CustomAgent[];
  allowedAgentIds: string[];
  minPlanByAgent: Record<string, PlanId>;
  teams: { id: string; name: string; description: string; agents: string[] }[];
  plan: PlanId;
  maxTier: ModelTier;
  credits: number;
  offline: boolean;
  visionAllowed: boolean;
  customAgentsAllowed: boolean;
}

type LogLine = { t: string; text: string; kind?: "info" | "ok" | "err" };
const TIERS: ModelTier[] = [...MODEL_TIERS];
/** What the user can pick explicitly: the Claude model of each tier, plus the GPT alternative on premium/frontier. */
const MODEL_CHOICES: { value: string; label: string; tier: ModelTier }[] = [
  { value: "fast:anthropic", label: "Fast · Claude Haiku 4.5", tier: "fast" },
  { value: "standard:anthropic", label: "Standard · Claude Sonnet 5", tier: "standard" },
  { value: "advanced:anthropic", label: "Advanced · Sonnet 5 high effort", tier: "advanced" },
  { value: "premium:anthropic", label: "Premium · Claude Opus 5", tier: "premium" },
  { value: "premium:openai", label: "Premium · GPT-5.6 Sol", tier: "premium" },
  { value: "frontier:anthropic", label: "Frontier · Claude Fable 5.1", tier: "frontier" },
  { value: "frontier:openai", label: "Frontier · GPT-6 Astra", tier: "frontier" },
];

export function Workspace(p: WorkspaceProps) {
  const router = useRouter();
  const params = useSearchParams();
  const isApp = p.project.kind === "app";
  const [html, setHtml] = useState(p.project.html);
  const [savedHtml, setSavedHtml] = useState(p.project.html);
  const [files, setFiles] = useState<ProjFile[]>(p.project.files);
  const [savedFiles, setSavedFiles] = useState<ProjFile[]>(p.project.files);
  const [activeFile, setActiveFile] = useState<string>(p.project.files[0]?.path ?? "/App.tsx");
  const [versions, setVersions] = useState(p.project.versions);
  const [messages, setMessages] = useState(p.project.messages);
  const [runs, setRuns] = useState(p.project.agentRuns);
  const [status, setStatus] = useState(p.project.status);
  const [clientStatus, setClientStatus] = useState(p.project.clientStatus);
  const [credits, setCredits] = useState(p.credits);
  const [showFiles, setShowFiles] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState(true);
  const [fileQuery, setFileQuery] = useState("");
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [bottom, setBottom] = useState<"chat" | "changes" | "logs" | "problems" | "terminal" | "share">("chat");
  const [agentId, setAgentId] = useState("auto");
  const [tier, setTier] = useState<ModelTier | "auto">("auto");
  const [provider, setProvider] = useState<"anthropic" | "openai" | undefined>(undefined);
  const [input, setInput] = useState(params.get("prompt") ?? "");
  const [images, setImages] = useState<RefImage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [stream, setStream] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([{ t: now(), text: "Workspace ready.", kind: "info" }]);
  const [runtimePreview, setRuntimePreview] = useState<{ url: string; source: string } | null>(null);
  const runtimeSource = isApp ? JSON.stringify(files) : html;
  const runtimeUrl = runtimePreview?.source === runtimeSource ? runtimePreview.url : null;
  const terminalAction = useRef<((cmd: string) => Promise<void>) | null>(null);
  const terminalRunning = useRef(false);
  const terminalAbort = useRef<AbortController | null>(null);
  const buildAfterRun = useRef(false);
  const [shellCommand, setShellCommand] = useState<{ id: number; text: string } | null>(null);
  const [shellOpened, setShellOpened] = useState(false);
  const [termBusy, setTermBusy] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(p.project.health ? JSON.parse(p.project.health) : null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termLines, setTermLines] = useState<string[]>([]);
  const [termInput, setTermInput] = useState("");
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [linkForm, setLinkForm] = useState({ label: "", password: "" });
  const terminalEnd = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const followChat = useRef(true);
  const autoRan = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = isApp ? JSON.stringify(files) !== JSON.stringify(savedFiles) : html !== savedHtml;
  const allAgents = useMemo(() => [
    ...p.agents,
    ...p.customAgents.map((c): AgentDef => ({ id: `custom:${c.id}`, name: c.name, short: c.description.slice(0, 60) || "Custom agent", description: c.description, order: 999, tier: c.tier as ModelTier, multiplier: 2, mode: c.mode === "report" ? "report" : "rewrite", systemPrompt: "", tags: ["custom"] })),
  ], [p.agents, p.customAgents]);
  const agent = allAgents.find((a) => a.id === agentId) ?? allAgents[0];
  const isAuto = agentId === "auto";
  const isAllowed = useCallback((id: string) => (id === "auto" ? true : id.startsWith("custom:") ? p.customAgentsAllowed : p.allowedAgentIds.includes(id)), [p.allowedAgentIds, p.customAgentsAllowed]);
  const previewSrc = useMemo(() => html || `<!DOCTYPE html><html><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0a0a0b;color:#8a8a93">Describe what to build in the chat below.</body></html>`, [html]);
  const log = useCallback((text: string, kind: LogLine["kind"] = "info") => setLogs((l) => [...l, { t: now(), text, kind }]), []);

  useEffect(() => { const el = chatEnd.current?.parentElement; if (el && followChat.current) el.scrollTop = el.scrollHeight; }, [messages, stream, busy, bottom]);
  useEffect(() => { const el = terminalEnd.current?.parentElement; if (el) el.scrollTop = el.scrollHeight; }, [termLines, bottom]);
  useEffect(() => {
    const t = setTimeout(() => setTermLines(["IDÆVIA terminal · project commands and isolated builds. Type `help`.", "Try: npm run build · preview · stop · status · git push · deploy vercel"]), 0);
    return () => clearTimeout(t);
  }, []);

  const runOne = useCallback(async (request: string, agentToRun: string, imgs: RefImage[] = []) => {
    if (!request.trim() || busyRef.current) return false;
    setError(null);
    busyRef.current = agentToRun;
    setBusy(agentToRun);
    setStream("");
    setBottom("chat");
    setExpandedPanel(true);
    followChat.current = true;
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: imgs.length ? `${request}\n[${imgs.length} image(s) attached]` : request, agentId: agentToRun, creditsUsed: 0, model: null, createdAt: new Date().toISOString() }]);
    log(`▶ ${agentToRun}: ${request.slice(0, 80)}${imgs.length ? ` (+${imgs.length} img)` : ""}`);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/projects/${p.project.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, agentId: agentToRun, tier: tier === "auto" ? undefined : tier, provider: tier === "auto" ? undefined : provider, images: imgs.length ? imgs.map((i) => ({ mediaType: i.mediaType, data: i.data })) : undefined }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Request failed (${res.status})`); }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      let usedCredits = 0;
      let completed = false;
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
          if (ev.type === "picked") { const a = allAgents.find((x) => x.id === ev.agent); log(`Router → handing this to ${a?.name ?? ev.agent}${a?.profession ? ` (${a.profession})` : ""}`); setBusy(ev.agent); busyRef.current = ev.agent; }
          else if (ev.type === "agent") { setMessages((m) => [...m, { id: `i-${Date.now()}`, role: "assistant", content: ev.text, agentId: ev.agent, creditsUsed: 0, model: null, createdAt: new Date().toISOString() }]); log(`${ev.name} (${ev.profession}) started`); }
          else if (ev.type === "meta") {
            usedCredits = ev.credits; setCredits((c) => c - ev.credits);
            log(`Routed → ${ev.tier} tier · ${ev.provider}/${ev.model} · task=${ev.taskClass} · ${ev.credits} credits${ev.fallback ? " · template engine" : ""}`);
          } else if (ev.type === "delta") { acc += ev.text; setStream(acc); }
          else if (ev.type === "done") {
            completed = true;
            if (ev.mode === "rewrite") {
              // A code-writing agent hands off to the isolated terminal after it
              // finishes. The build is intentionally queued only once, after a
              // chained workflow has completed, so every specialist can edit
              // the same source without starting competing runtimes.
              buildAfterRun.current = true;
              if (ev.files) { setFiles(ev.files); setSavedFiles(ev.files); setActiveFile((f) => (ev.files.some((x: ProjFile) => x.path === f) ? f : "/App.tsx")); }
              else { setHtml(ev.html); setSavedHtml(ev.html); }
              setVersions((v) => [{ id: `v${ev.versionNumber}`, number: ev.versionNumber, message: `${agentToRun}: ${request.slice(0, 120)}`, createdAt: new Date().toISOString() }, ...v]);
              setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: ev.note ?? `Updated the ${isApp ? "app" : "project"} (v${ev.versionNumber}).`, agentId: busyRef.current ?? agentToRun, creditsUsed: ev.creditsUsed, model: null, createdAt: new Date().toISOString() }]);
              setView("preview");
              log(`✓ v${ev.versionNumber} saved (${ev.creditsUsed} credits)`, "ok");
            } else {
              setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: ev.report, agentId: busyRef.current ?? agentToRun, creditsUsed: ev.creditsUsed, model: null, createdAt: new Date().toISOString() }]);
              log(`✓ ${agentToRun} report ready (${ev.creditsUsed} credits)`, "ok");
            }
            setRuns((r) => [{ id: `r-${Date.now()}`, agentId: agentToRun, status: "DONE", task: request, model: null, creditsUsed: ev.creditsUsed, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), output: ev.mode === "rewrite" ? `v${ev.versionNumber}` : "report" }, ...r]);
          } else if (ev.type === "error") { setCredits((c) => c + usedCredits); throw new Error(ev.message); }
        }
      }
      if (!completed) throw new Error("The connection ended before the agent finished. Please try again.");
      setStream("");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg); log(`✗ ${msg}`, "err"); setStream("");
      return false;
    } finally {
      busyRef.current = null; setBusy(null); abortRef.current = null; router.refresh();
    }
  }, [allAgents, isApp, log, p.project.id, provider, router, tier]);

  useEffect(() => { terminalAction.current = term; });

  const run = useCallback(async (request: string, agentToRun: string = agentId, chain: string[] = []) => {
    if (!request.trim() || busyRef.current || terminalRunning.current) return;
    const command = shellIntent(request) ?? runtimeCommand(request);
    if (command && !chain.length) { await terminalAction.current?.(command); return; }
    const imgs = images; setImages([]);
    buildAfterRun.current = false;
    let completed = true;
    for (const [i, id] of [agentToRun, ...chain].entries()) {
      const ok = await runOne(request, id, i === 0 ? imgs : []);
      if (!ok) { completed = false; setInput((current) => current || request); if (i === 0) setImages(imgs); break; }
    }
    if (completed && buildAfterRun.current) {
      buildAfterRun.current = false;
      log("↪ Code complete · handing off to Terminal for build and preview");
      await term("npm run build");
    }
  }, [agentId, images, runOne]);

  useEffect(() => {
    if (params.get("auto") === "1" && !autoRan.current) {
      autoRan.current = true;
      let req = input;
      if (params.get("from") === "session") { try { req = sessionStorage.getItem(`idaevia:prompt:${p.project.id}`) ?? req; sessionStorage.removeItem(`idaevia:prompt:${p.project.id}`); } catch { /* ignore */ } }
      const hasContent = isApp ? p.project.files.length > 0 : Boolean(p.project.html);
      if (req && !hasContent) { setInput(""); run(req, "builder"); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attachImages(list: FileList | null) {
    if (!list) return;
    const next: RefImage[] = [];
    for (const f of Array.from(list).slice(0, 4 - images.length)) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type) || f.size > 4_500_000) { setError("Images must be PNG/JPEG/WebP/GIF under 4.5 MB."); continue; }
      const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(f); });
      next.push({ name: f.name, mediaType: f.type as RefImage["mediaType"], data });
    }
    setImages((i) => [...i, ...next]);
    if (next.length && !input) setInput("Recreate the attached reference design as a complete, original website with the same layout, typography, colours and spacing.");
  }

  async function perform(task: () => Promise<unknown>) {
    setError(null);
    try { await task(); } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed. Please try again.";
      setError(message); log(message, "err");
    }
  }
  const saveCode = (asVersion: boolean) => perform(() => persistCode(asVersion));
  async function persistCode(asVersion: boolean) {
    if (isApp) {
      const res = await fetch(`/api/projects/${p.project.id}/files`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files, saveVersion: asVersion }) });
      const d = await res.json();
      if (res.ok) { setSavedFiles(files); if (d.versionNumber) setVersions((v) => [{ id: `v${d.versionNumber}`, number: d.versionNumber, message: "Manual edit", createdAt: new Date().toISOString() }, ...v]); log(asVersion ? `✓ Saved as v${d.versionNumber}` : "✓ Saved", "ok"); } else throw new Error(d.error ?? "Request failed");
      return;
    }
    const res = await fetch(`/api/projects/${p.project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, saveVersion: asVersion }) });
    const d = await res.json();
    if (res.ok) { setSavedHtml(html); if (d.versionNumber) setVersions((v) => [{ id: `v${d.versionNumber}`, number: d.versionNumber, message: "Manual edit", createdAt: new Date().toISOString() }, ...v]); log(asVersion ? `✓ Saved as v${d.versionNumber}` : "✓ Saved", "ok"); } else throw new Error(d.error ?? "Request failed");
  }
  const restore = (n: number) => perform(() => restoreRequest(n));
  async function restoreRequest(n: number) {
    const res = await fetch(`/api/projects/${p.project.id}/versions/${n}`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    if (d.files) { setFiles(d.files); setSavedFiles(d.files); setActiveFile((current) => d.files.some((f: ProjFile) => f.path === current) ? current : d.files[0]?.path ?? "/App.tsx"); } else { setHtml(d.html); setSavedHtml(d.html); }
    setVersions((v) => [{ id: `v${d.versionNumber}`, number: d.versionNumber, message: `Restored v${n}`, createdAt: new Date().toISOString() }, ...v]); log(`↺ Restored v${n} as v${d.versionNumber}`, "ok");
  }
  const previewVersion = (n: number) => perform(() => previewVersionRequest(n));
  async function previewVersionRequest(n: number) {
    const res = await fetch(`/api/projects/${p.project.id}/versions/${n}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    if (d.version.files) { setFiles(d.version.files); setActiveFile((current) => d.version.files.some((f: ProjFile) => f.path === current) ? current : d.version.files[0]?.path ?? "/App.tsx"); } else setHtml(d.version.html);
    setView("preview"); log(`Previewing v${n} (unsaved: Save or Restore to keep)`);
  }
  const publish = () => perform(async () => { try { await publishRequest(); } finally { setPublishing(false); } });
  async function publishRequest() {
    setPublishing(true);
    if (dirty) await persistCode(false);
    const res = await fetch(`/api/projects/${p.project.id}/publish`, { method: "POST" });
    const d = await res.json(); setPublishing(false);
    if (res.ok) { setStatus("PUBLISHED"); log(`🚀 Published → ${d.url}`, "ok"); setBottom("logs"); } else throw new Error(d.error ?? "Request failed");
  }
  const runAudit = () => perform(() => runAuditRequest());
  async function runAuditRequest() {
    if (isApp) { setError("Production audit currently covers website projects; run the QA / Security agents for apps."); return; }
    if (dirty) await persistCode(false);
    const res = await fetch(`/api/projects/${p.project.id}/audit`, { method: "POST" });
    const d = await res.json();
    if (res.ok) { setAudit(d.audit); setBottom("problems"); log(`Audit: overall ${d.audit.overall}/100, ${d.audit.issues.length} issues`); } else throw new Error(d.error ?? "Audit failed");
  }
  const exportZip = () => perform(() => exportZipRequest());
  async function exportZipRequest() {
    if (dirty) await persistCode(false);
    const res = await fetch(`/api/projects/${p.project.id}/export`);
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    const blob = await res.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${p.project.slug}.zip`; a.click(); URL.revokeObjectURL(a.href);
    log("⬇ Exported ZIP", "ok");
  }
  const loadShare = () => perform(() => loadShareRequest());
  async function loadShareRequest() {
    const res = await fetch(`/api/projects/${p.project.id}/share`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "Could not load share links");
    setLinks(d.links ?? []); setComments(d.comments ?? []); if (d.clientStatus) setClientStatus(d.clientStatus);
  }
  const createLink = () => perform(() => createLinkRequest());
  async function createLinkRequest() {
    const res = await fetch(`/api/projects/${p.project.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: linkForm.label || undefined, password: linkForm.password || undefined }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    setLinkForm({ label: "", password: "" }); await loadShareRequest(); log(`🔗 Client portal link created: ${d.url}`, "ok");
  }
  const shareAction = (body: Record<string, unknown>) => perform(() => shareActionRequest(body));
  async function shareActionRequest(body: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${p.project.id}/share`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json()).error ?? "Could not update share link");
    await loadShareRequest();
  }

  async function term(cmdRaw: string) {
    const platformAction = /^platform:\s*/i.test(cmdRaw);
    const cmd = cmdRaw.trim().replace(/^platform:\s*/i, "");
    const out: string[] = [`$ ${cmd}`];
    const push = (...l: string[]) => setTermLines((x) => [...x, ...l]);
    if (!cmd || terminalRunning.current || busyRef.current) return;
    const execution = platformAction ? null : runtimeCommand(cmd);
    const shell = platformAction ? null : shellIntent(cmd);
    if (shell || execution) {
      if (dirty) { try { await persistCode(false); } catch (e) { setError(e instanceof Error ? e.message : "Could not save source"); return; } }
      const text = shell ?? (execution === "preview" ? (isApp ? "npm install && npm run dev -- --host 0.0.0.0 --port 3000" : "npm run dev") : execution === "stop" ? "\x03" : "npm run build");
      setShellCommand({ id: Date.now(), text }); setShellOpened(true); setBottom("terminal"); setExpandedPanel(true);
      return;
    }
    setBottom("terminal");
    setExpandedPanel(true);
    if (cmd === "clear") { setTermLines([]); return; }
    if (cmd === "versions" || cmd === "git log") { push(...out, ...versions.map((v) => `v${String(v.number).padStart(2, "0")}  ${new Date(v.createdAt).toLocaleString()}  ${v.message}`)); return; }
    if (cmd.startsWith("git checkout v")) { const n = Number(cmd.replace("git checkout v", "")); restore(n); push(...out, `Restoring v${n}…`); return; }
    if (cmd === "export") { exportZip(); push(...out, "Exporting…"); return; }
    if (cmd === "agents") { push(...out, ...allAgents.map((a) => `${isAllowed(a.id) ? "●" : "○"} ${a.id.padEnd(18)} ${a.short}`)); return; }
    if (!execution && cmd.startsWith("run ")) { const [id, ...rest] = cmd.slice(4).split(" "); run(rest.join(" ") || "Improve the project.", id); push(...out, `Running ${id}…`); return; }
    {
      // Project commands use the same authenticated server endpoint on web and desktop.
      // Web: real commands run on the server and stream their log lines (git push, deploy vercel, publish, env…).
      push(...out);
      setTermBusy(true);
      terminalRunning.current = true;
      const ac = new AbortController();
      terminalAbort.current = ac;
      if (execution) setRuntimePreview(null);
      try {
        if (dirty) await persistCode(false);
        const res = await fetch(`/api/projects/${p.project.id}/terminal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd }), signal: ac.signal });
        if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); push(`✗ ${d.error ?? `HTTP ${res.status}`}`); setTermBusy(false); return; }
        const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
          for (const part of parts) {
            const m = part.match(/^data: (.*)$/m); if (!m) continue;
            try { const ev = JSON.parse(m[1]) as { kind: string; line: string }; if (ev.kind === "done") continue; if (ev.kind === "preview") { const url = new URL(ev.line); if (url.protocol === "https:" && url.hostname.endsWith(".e2b.app")) { setRuntimePreview({ url: url.href, source: runtimeSource }); setView("preview"); setExpandedPanel(false); } } push(ev.line); if (ev.kind === "ok") log(ev.line, "ok"); if (ev.kind === "err") log(ev.line, "err"); if (/^✓ Live at |^https:\/\//.test(ev.line) && cmd.startsWith("publish")) setStatus("PUBLISHED"); } catch { /* ignore */ }
          }
        }
      } catch (e) { push(`✗ ${e instanceof Error ? e.message : "terminal error"}`); }
      finally { setTermBusy(false); terminalRunning.current = false; terminalAbort.current = null; }
      return;
    }

  }

  useEffect(() => {
    if (!runtimePreview) return;
    const timer = setTimeout(() => setRuntimePreview(null), 15 * 60_000);
    return () => clearTimeout(timer);
  }, [runtimePreview]);

  const width = device === "desktop" ? "100%" : device === "tablet" ? 820 : 390;
  const fileTree = useMemo(() => files.filter((f) => f.path.toLowerCase().includes(fileQuery.toLowerCase())).sort((a, b) => a.path.localeCompare(b.path)), [files, fileQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="min-h-14 shrink-0 border-b border-graphite px-3 py-2 flex flex-wrap items-center gap-2">
        <WorkspaceMenuButton />
        <Link aria-label="Back to projects" href="/app/projects" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /></Link>
        <div className="min-w-0 max-w-48">
          <div className="text-sm font-medium truncate">{p.project.name} {isApp && <span className="pill text-[10px] ml-1">React app</span>}</div>
          <div className="text-[11px] text-ash font-mono truncate">{status === "PUBLISHED" ? `live · /s/${p.project.slug}` : "draft"} · {credits.toLocaleString()} credits{clientStatus !== "NONE" && ` · client: ${clientStatus.toLowerCase().replace("_", " ")}`}</div>
        </div>
        <div className="mx-auto flex items-center gap-1 border border-graphite rounded-full p-0.5">
          <button onClick={() => { setBottom("chat"); setExpandedPanel(true); }} className={`btn btn-sm ${expandedPanel && bottom === "chat" ? "btn-primary" : "btn-ghost"}`}><MessageSquare size={13} />Chat</button>
          <button onClick={() => { setView("preview"); setExpandedPanel(false); }} className={`btn btn-sm ${!expandedPanel && view === "preview" ? "btn-primary" : "btn-ghost"}`}><Eye size={13} />Preview</button>
          <button onClick={() => { setView("code"); setExpandedPanel(false); setShowFiles(true); }} className={`btn btn-sm ${!expandedPanel && view === "code" ? "btn-primary" : "btn-ghost"}`}><Code2 size={13} />Code</button>
        </div>
        <button disabled={!!busy || termBusy} onClick={() => term(isApp ? "npm install && npm run build && npm run preview -- --host 0.0.0.0 --port 3000" : "npm run build && npm run preview")} className="btn btn-outline btn-sm"><Play size={13} />{termBusy ? "Running…" : "Build & preview"}</button>
        {!isApp && <div className="hidden lg:flex items-center gap-0.5 border border-graphite rounded-full p-0.5">
          {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, I]) => (
            <button key={d} onClick={() => setDevice(d)} className={`btn btn-sm ${device === d ? "bg-graphite" : "btn-ghost"}`} title={d}><I size={13} /></button>
          ))}
        </div>}
        <button onClick={() => setShowFiles(!showFiles)} aria-expanded={showFiles} className="btn btn-ghost btn-sm" title="Toggle project files"><Folder size={14} />Files</button>
        <button onClick={() => setShowTeam(!showTeam)} aria-expanded={showTeam} className="btn btn-ghost btn-sm" title="Toggle AI team"><Users size={14} />Agents</button>
        {audit && <button onClick={() => setBottom("problems")} className="pill text-xs gap-1.5" title="Project health"><Activity size={11} className={audit.overall >= 90 ? "text-success" : audit.overall >= 70 ? "text-warning" : "text-error"} />{audit.overall}</button>}
        <button onClick={() => { setBottom("share"); loadShare(); }} className="btn btn-outline btn-sm" title="Client portal & share"><Share2 size={13} /></button>
        {!isApp && <button onClick={runAudit} className="btn btn-outline btn-sm" title="Production audit"><AlertTriangle size={13} />Audit</button>}
        <button onClick={exportZip} className="btn btn-outline btn-sm" title="Export code"><Download size={13} /></button>
        {status === "PUBLISHED" && <a href={`/s/${p.project.slug}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm"><ExternalLink size={13} /></a>}
        <button onClick={() => { if (isApp) { setBottom("terminal"); term("deploy vercel"); } else publish(); }} disabled={publishing || termBusy || (isApp ? files.length === 0 : !html)} title={isApp ? "Deploy using your connected Vercel account" : "Publish this website"} className="btn btn-signal btn-sm"><Rocket size={13} />{publishing ? "Deploying…" : status === "PUBLISHED" ? "Redeploy" : "Deploy"}</button>
      </div>

      {error && <div role="alert" className="shrink-0 px-4 py-2 border-b border-error/30 bg-void text-error text-xs flex items-center justify-between gap-3">{error}<button aria-label="Dismiss error" onClick={() => setError(null)}><X size={14} /></button></div>}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Explorer */}
        {showFiles && <aside aria-label="Project files" className="w-56 shrink-0 border-r border-graphite overflow-y-auto p-3 text-xs">
          <div className="label px-2 py-1">Files</div>
          {isApp && <input aria-label="Search files" value={fileQuery} onChange={(e) => setFileQuery(e.target.value)} placeholder="Search files…" className="input my-2 text-xs" />}
          <div className="px-2 py-1 flex items-center gap-1.5 text-fog"><Folder size={12} className="text-ash" />{p.project.slug}</div>
          {isApp ? (
            <>
              <div className="px-2 py-1 pl-4 text-ash flex items-center gap-1.5"><Folder size={12} />src/</div>
              {fileTree.map((f) => (
                <button key={f.path} onClick={() => { setActiveFile(f.path); setView("code"); }} className={`w-full text-left px-2 py-1 pl-6 flex items-center gap-1.5 rounded ${view === "code" && activeFile === f.path ? "bg-graphite text-paper" : "text-fog hover:bg-ink"}`} title={f.path}><FileCode2 size={12} className="text-signal-soft shrink-0" /><span className="truncate">{f.path.slice(1)}</span></button>
              ))}
              {fileTree.length === 0 && <div className="px-2 pl-6 text-ash">No files yet: describe the app below.</div>}
              <button onClick={() => { const path = prompt("New file path (e.g. /components/Card.tsx)"); if (path && !path.split("/").includes("..") && /^\/[\w\-./]+$/.test(path) && !files.some((f) => f.path === path)) { setFiles((f) => [...f, { path, content: "" }]); setActiveFile(path); setView("code"); } }} className="w-full text-left px-2 py-1 pl-6 text-ash hover:text-paper">+ new file</button>
            </>
          ) : (
            <>
              <button onClick={() => { setView("code"); setExpandedPanel(false); setShowFiles(true); }} className={`w-full text-left px-2 py-1 pl-6 flex items-center gap-1.5 rounded ${view === "code" ? "bg-graphite text-paper" : "text-fog hover:bg-ink"}`}><FileCode2 size={12} className="text-signal-soft" />index.html{dirty && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-warning" />}</button>

            </>
          )}
          <div className="label px-2 py-1 mt-4 flex items-center gap-1"><History size={11} />Versions</div>
          {versions.length === 0 && <div className="px-2 text-ash">No versions yet.</div>}
          {versions.map((v) => (
            <div key={v.id} className="group px-2 py-1 rounded hover:bg-ink">
              <button onClick={() => previewVersion(v.number)} className="w-full text-left flex items-center gap-1.5"><ChevronRight size={10} className="text-ash" /><span className="font-mono text-signal-soft">v{String(v.number).padStart(2, "0")}</span><span className="truncate text-fog">{v.message}</span></button>
              <button onClick={() => restore(v.number)} className="hidden group-hover:flex items-center gap-1 pl-5 text-[10px] text-ash hover:text-paper"><RotateCcw size={9} />restore</button>
            </div>
          ))}
        </aside>}

        {/* Center */}
        <section className="min-w-0 min-h-0 flex-1 flex flex-col">
          <div className="flex-1 min-h-0 bg-[#050506] p-3 overflow-auto" hidden={expandedPanel}>
            {view === "preview" ? (
              runtimeUrl ? <div className="h-full flex flex-col">
                <div className="shrink-0 flex items-center gap-3 pb-2 text-xs text-ash"><span className="truncate">{runtimeUrl}</span><a href={runtimeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Open preview <ExternalLink size={12} /></a><button onClick={() => term("stop")} disabled={termBusy} className="btn btn-ghost btn-sm">Stop</button></div>
                <iframe title="Built project preview" src={runtimeUrl} className="w-full flex-1 min-h-0 rounded-lg border border-graphite bg-white" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin" />
              </div> : isApp ? (
                <div className="h-full rounded-lg overflow-hidden border border-graphite bg-white">
                  {files.length ? <AppSandbox files={files} /> : <div className="h-full grid place-items-center text-sm text-ash bg-void">Describe the app you want in the chat below: e.g. “Build an admin dashboard for a SaaS with sidebar, KPI cards, a revenue chart and a customers table.”</div>}
                </div>
              ) : (
                <div className="h-full mx-auto bg-white rounded-lg overflow-hidden border border-graphite transition-all" style={{ width, maxWidth: "100%" }}>
                  {/* No allow-same-origin: generated HTML runs in an opaque origin and cannot touch the app or its cookies. */}
                  <iframe title="preview" srcDoc={previewSrc} className="w-full h-full" sandbox="allow-scripts allow-forms allow-popups allow-modals" />
                </div>
              )
            ) : (
              <div className="h-full flex flex-col rounded-lg overflow-hidden border border-graphite">
                <div className="h-9 flex items-center gap-2 px-3 bg-ink border-b border-graphite text-xs">
                  <span className="font-mono text-fog">{isApp ? activeFile : "index.html"}</span>
                  {dirty && <span className="text-warning">● unsaved</span>}
                  <div className="ml-auto flex gap-1">
                    {isApp && <button onClick={() => { if (confirm(`Delete ${activeFile}?`)) { setFiles((f) => f.filter((x) => x.path !== activeFile)); setActiveFile(files.find((f) => f.path !== activeFile)?.path ?? "/App.tsx"); } }} className="btn btn-ghost btn-sm text-ash hover:text-error"><Trash2 size={12} /></button>}
                    <button onClick={() => saveCode(false)} disabled={!dirty} className="btn btn-ghost btn-sm"><Save size={12} />Save</button>
                    <button onClick={() => saveCode(true)} disabled={!dirty} className="btn btn-outline btn-sm">Save as version</button>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <MonacoEditor
                    height="100%"
                    path={isApp ? activeFile : "index.html"}
                    language={isApp ? (activeFile.endsWith(".css") ? "css" : activeFile.endsWith(".json") ? "json" : "typescript") : "html"}
                    theme="vs-dark"
                    value={isApp ? files.find((f) => f.path === activeFile)?.content ?? "" : html}
                    onChange={(v) => (isApp ? setFiles((fs) => fs.map((f) => (f.path === activeFile ? { ...f, content: v ?? "" } : f))) : setHtml(v ?? ""))}
                    options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on", fontFamily: "JetBrains Mono, monospace", scrollBeyondLastLine: false }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom panel */}
          <div className="shrink-0 min-h-0 border-t border-graphite flex flex-col" style={{ height: expandedPanel ? "100%" : "55%", minHeight: "min(440px, 70dvh)" }}>
            <div className="h-10 shrink-0 flex items-center gap-1 px-2 border-b border-graphite text-xs overflow-x-auto">
              {([["chat", "AI Chat", MessageSquare], ["changes", "Changes", History], ["terminal", "Terminal", TerminalSquare], ["logs", "Logs", Activity], ["problems", "Problems", AlertTriangle], ["share", "Share / Client portal", Share2]] as const).map(([id, label, I]) => (
                <button key={id} onClick={() => { setBottom(id); if (id === "terminal") setShellOpened(true); if (id === "share") loadShare(); }} className={`btn btn-sm ${bottom === id ? "bg-graphite text-paper" : "btn-ghost"}`}><I size={12} />{label}{id === "problems" && audit?.issues.length ? <span className="ml-1 text-[10px] text-warning">{audit.issues.length}</span> : null}</button>
              ))}
              <button onClick={() => setExpandedPanel(!expandedPanel)} aria-label={expandedPanel ? "Show preview and chat" : "Focus chat panel"} title={expandedPanel ? "Show preview and chat" : "Focus chat panel"} aria-expanded={expandedPanel} className="btn btn-ghost btn-sm ml-auto">{expandedPanel ? "↓" : "↑"}</button>
              {termBusy && <button onClick={() => terminalAbort.current?.abort()} className="btn btn-ghost btn-sm">Cancel command</button>}
              {busy && <span className="ml-auto flex items-center gap-2 text-signal-soft whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-signal pulse-dot" />{busy} working…<button onClick={() => abortRef.current?.abort()} className="text-ash hover:text-paper">stop</button></span>}
            </div>

            {bottom === "chat" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div onScroll={(e) => { const el = e.currentTarget; followChat.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="flex-1 min-h-0 overflow-y-auto px-5 py-6 space-y-6 text-sm leading-7">
                  {messages.length === 0 && !stream && <div className="text-ash text-xs">{isApp ? "Describe the app. Example: “Build a CRM dashboard with sidebar, KPI cards, revenue chart and a deals table.”" : "Describe what you want. Example: “Build a dark SaaS landing page for an AI CRM with pricing and FAQ.”"}</div>}
                  {messages.map((m) => (
                    <div key={m.id} className={`w-fit max-w-[90%] rounded-2xl px-5 py-3 ${m.role === "user" ? "ml-auto bg-graphite rounded-br-sm" : "border border-graphite rounded-bl-sm text-fog"}`}>
                      {m.role !== "user" && (() => { const a = allAgents.find((x) => x.id === m.agentId); return <div className="font-mono text-[10px] text-signal-soft mb-1">{a?.name ?? m.agentId ?? "IDÆVIA"}{a?.profession ? <span className="text-ash"> · {a.profession}</span> : null}{m.creditsUsed ? ` · ${m.creditsUsed} cr` : ""}</div>; })()}
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    </div>
                  ))}
                  {busy && <div className="rounded-2xl border border-graphite p-5 text-fog space-y-4">
                    <div role="status" className="flex items-center gap-2 text-sm text-signal-soft"><span className="w-2 h-2 rounded-full bg-signal pulse-dot" />{allAgents.find((x) => x.id === busy)?.name ?? busy} is working</div>
                    <div className="grid gap-2 text-xs text-ash">
                      <div className="flex items-center gap-2"><span className="text-signal-soft">✓</span> Understanding your request and planning the work</div>
                      <div className="flex items-center gap-2"><span className={stream ? "text-signal-soft" : "text-ash"}>{stream ? "✓" : "•"}</span>{isApp ? "Building and updating the app" : "Building and updating the website"}</div>
                      <div className="flex items-center gap-2"><span className="text-ash">•</span> Reviewing the result and preparing the preview</div>
                    </div>
                    <p className="text-xs text-ash">You’ll see a summary when the agent finishes. Technical commands and build logs appear in Terminal.</p>
                  </div>}
                  {error && <div className="text-error text-xs">{error}</div>}
                  <div ref={chatEnd} />
                </div>
                {images.length > 0 && (
                  <div className="px-2 pt-2 flex gap-2 flex-wrap">
                    {images.map((img, i) => <div key={i} className="relative"><img src={`data:${img.mediaType};base64,${img.data}`} alt={img.name} className="h-12 w-16 object-cover rounded border border-graphite" /><button onClick={() => setImages((x) => x.filter((_, k) => k !== i))} className="absolute -top-1 -right-1 bg-void border border-graphite rounded-full p-0.5"><X size={9} /></button></div>)}
                    <span className="text-[10px] text-ash self-end">{images.length} reference image(s) → Builder (vision)</span>
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); const r = input; if (!busyRef.current && r.trim()) { setInput(""); run(r); } }} className="workspace-composer shrink-0 p-3 border-t border-graphite grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div className="col-span-3 flex gap-2 flex-wrap">
                    <ComposerSelect label="Agent" value={agentId} onChange={setAgentId} options={[
                      { value: "auto", label: "Auto agent", description: "IDÆVIA picks the right specialist for your task." },
                      ...p.agents.map((a) => ({ value: a.id, label: a.name, description: isAllowed(a.id) ? a.short : `Available on ${p.minPlanByAgent[a.id]}`, group: "Agents", disabled: !isAllowed(a.id) })),
                      ...p.customAgents.map((c) => ({ value: `custom:${c.id}`, label: c.name, description: p.customAgentsAllowed ? c.description : "Available on Agency", group: "Custom agents", disabled: !p.customAgentsAllowed })),
                    ]} />
                    <ComposerSelect label="Model" value={tier === "auto" ? "auto" : `${tier}:${provider ?? "anthropic"}`} onChange={(value) => { const [t, pv] = value.split(":"); setTier(t as ModelTier | "auto"); setProvider(pv === "openai" ? "openai" : pv === "anthropic" ? "anthropic" : undefined); }} options={[
                      { value: "auto", label: "Auto routing", description: "Balances quality, speed and credits for your task." },
                      ...MODEL_CHOICES.map((c) => ({ value: c.value, label: c.label, group: "Choose a model", description: TIERS.indexOf(c.tier) > TIERS.indexOf(p.maxTier) ? "Upgrade your plan to use this model" : undefined, disabled: TIERS.indexOf(c.tier) > TIERS.indexOf(p.maxTier) })),
                    ]} />
                  </div>
                  <textarea aria-label="Project prompt" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); const r = input; if (!busyRef.current && r.trim()) { setInput(""); run(r); } } }} rows={2} className="input col-span-3 min-w-0 resize-none" placeholder={isAuto ? "Describe what to build or change. IDÆVIA picks the right agent." : agent.mode === "rewrite" ? "What should the AI build or change?" : `Ask ${agent.name} for a report…`} />
                  <span className="text-[11px] text-ash self-center">Enter to send · Shift + Enter for a new line</span>
                  <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => { attachImages(e.target.files); e.target.value = ""; }} />
                  <button type="button" onClick={() => (p.visionAllowed ? fileInput.current?.click() : setError("Screenshot → website (vision) is available from the Starter plan."))} title="Attach reference images (screenshot → website)" className={`btn btn-outline ${p.visionAllowed ? "" : "opacity-60"}`}><ImageIcon size={14} />{!p.visionAllowed && <Lock size={10} />}</button>
                  <button disabled={!!busy || !input.trim()} className="btn btn-primary"><Play size={14} />Run</button>
                </form>
              </div>
            )}

            {bottom === "changes" && (
              <div className="flex-1 overflow-y-auto p-3 text-xs">
                {runs.length === 0 && <div className="text-ash">No agent runs yet.</div>}
                <table className="w-full"><tbody>{runs.map((r) => (
                  <tr key={r.id} className="border-b border-graphite/60"><td className="py-1.5 pr-3 font-mono text-signal-soft">{r.agentId}</td><td className="py-1.5 pr-3 text-fog truncate max-w-[380px]">{r.task}</td><td className="py-1.5 pr-3 text-ash">{r.output?.startsWith("v") ? r.output : r.status}</td><td className="py-1.5 pr-3 text-ash">{r.creditsUsed} cr</td><td className="py-1.5 text-ash">{new Date(r.startedAt).toLocaleTimeString()}</td></tr>
                ))}</tbody></table>
              </div>
            )}

            {shellOpened && <div hidden={bottom !== "terminal"} className={bottom === "terminal" ? "flex-1 min-h-0 flex flex-col" : "hidden"}>
              <ShellTerminal projectId={p.project.id} active={bottom === "terminal"} command={shellCommand} onConsumed={(id) => setShellCommand((current) => current?.id === id ? null : current)} onPreview={(url) => { setRuntimePreview({ url, source: runtimeSource }); setView("preview"); setExpandedPanel(false); }} />
              <details className="shrink-0 border-t border-graphite text-xs">
                <summary className="cursor-pointer px-3 py-2 text-ash">Platform actions · publish, connected GitHub push, deploy</summary>
                <div className="max-h-32 overflow-y-auto px-3 font-mono whitespace-pre-wrap">{termLines.map((line, i) => <div key={i}>{line}</div>)}<div ref={terminalEnd} /></div>
                <form onSubmit={(e) => { e.preventDefault(); const c = termInput; setTermInput(""); term(`platform: ${c}`); }} className="flex gap-2 px-3 py-2"><input aria-label="Platform action" value={termInput} disabled={termBusy} onChange={(e) => setTermInput(e.target.value)} className="input flex-1" placeholder="publish · deploy vercel · integrations" /><button className="btn btn-outline btn-sm" disabled={termBusy}>Run</button></form>
              </details>
            </div>}

            {bottom === "logs" && <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5">{logs.map((l, i) => <div key={i} className={l.kind === "err" ? "text-error" : l.kind === "ok" ? "text-success" : "text-fog"}><span className="text-ash">{l.t}</span> {l.text}</div>)}</div>}

            {bottom === "problems" && (
              <div className="flex-1 overflow-y-auto p-3 text-xs">
                {!audit ? <div className="text-ash">Run an audit to see Performance, SEO, Accessibility, Security, Code and Mobile scores. <button onClick={runAudit} className="text-signal-soft underline">Run now</button></div> : (
                  <>
                    <div className="grid grid-cols-7 gap-2 mb-3">{([["Overall", audit.overall], ["Performance", audit.performance], ["SEO", audit.seo], ["A11y", audit.accessibility], ["Security", audit.security], ["Code", audit.codeQuality], ["Mobile", audit.mobile]] as const).map(([l, v]) => <div key={l} className="card p-2"><div className="text-[10px] text-ash">{l}</div><div className={`text-lg font-semibold ${v >= 90 ? "text-success" : v >= 70 ? "text-warning" : "text-error"}`}>{v}</div></div>)}</div>
                    {audit.issues.length === 0 ? <div className="text-success">No issues found. Production ready.</div> : (
                      <div className="space-y-1">{audit.issues.map((i, k) => <div key={k} className="flex gap-2"><span className={`pill text-[10px] ${i.severity === "high" ? "text-error border-error/40" : i.severity === "medium" ? "text-warning border-warning/40" : ""}`}>{i.area}</span><span className="text-fog">{i.message}</span></div>)}
                        <button disabled={!!busy} onClick={() => run(`Fix all of these audit issues without changing the design:\n- ${audit.issues.map((i) => i.message).join("\n- ")}`, "debugger")} className="btn btn-signal btn-sm mt-2">Fix all with Debugger</button></div>
                    )}
                  </>
                )}
              </div>
            )}

            {bottom === "share" && (
              <div className="flex-1 overflow-y-auto p-3 text-xs grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="font-medium text-sm flex items-center gap-2"><Link2 size={13} />Client portal links <span className={`pill text-[10px] ${clientStatus === "APPROVED" ? "text-success border-success/40" : clientStatus === "CHANGES_REQUESTED" ? "text-warning border-warning/40" : ""}`}>{clientStatus === "NONE" ? "no portal yet" : clientStatus.toLowerCase().replace("_", " ")}</span></div>
                  <p className="text-ash">Clients preview the site, comment, request changes and approve: no account needed. Attach the project to a team for white-label branding.</p>
                  <div className="flex gap-2"><input className="input py-1.5" placeholder="Label (e.g. Round 1)" value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} /><input className="input py-1.5 w-32" placeholder="Password" value={linkForm.password} onChange={(e) => setLinkForm({ ...linkForm, password: e.target.value })} /><button onClick={createLink} className="btn btn-primary btn-sm whitespace-nowrap">Create link</button></div>
                  {links.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 border border-graphite rounded-lg px-2 py-1.5">
                      <a href={`/portal/${l.token}`} target="_blank" rel="noopener" className="font-mono text-signal-soft truncate flex-1 hover:underline">/portal/{l.token}</a>
                      {l.label && <span className="pill text-[10px]">{l.label}</span>}{l.hasPassword && <Lock size={10} className="text-ash" />}
                      <button onClick={() => perform(async () => { await navigator.clipboard.writeText(`${location.origin}/portal/${l.token}`); log("Share link copied", "ok"); })} className="text-ash hover:text-paper">copy</button>
                      <button onClick={() => shareAction({ linkId: l.id })} className="text-ash hover:text-error"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="font-medium text-sm">Client feedback</div>
                  {comments.length === 0 && <div className="text-ash">No comments yet.</div>}
                  {comments.map((c) => (
                    <div key={c.id} className={`border rounded-lg p-2 ${c.kind === "APPROVAL" ? "border-success/40" : c.kind === "CHANGE_REQUEST" ? "border-warning/40" : "border-graphite"} ${c.resolved ? "opacity-50" : ""}`}>
                      <div className="flex items-center justify-between text-ash"><span className="text-fog">{c.authorName}</span><span>{new Date(c.createdAt).toLocaleString()}</span></div>
                      <div className="mt-1 text-fog whitespace-pre-wrap">{c.body}</div>
                      {!c.resolved && c.kind !== "APPROVAL" && <div className="mt-1 flex gap-2"><button onClick={() => run(`Client feedback to apply: ${c.body}`, "builder")} className="text-signal-soft hover:underline">apply with Builder</button><button onClick={() => shareAction({ commentId: c.id, resolve: true })} className="text-ash hover:text-paper flex items-center gap-1"><CheckCircle2 size={10} />resolve</button></div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* AI team */}
        {showTeam && <aside aria-label="AI team" className="w-60 shrink-0 border-l border-graphite overflow-y-auto p-3 text-xs">
          <div className="label px-2 py-1 flex items-center gap-1"><Users size={11} />AI team</div>
          {p.offline && <div className="mx-2 mb-2 rounded border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">Offline mode: add an API key for real agents.</div>}
          <div className="label px-2 py-1 mt-1">One-click</div>
          <div className="px-2 grid gap-1 mb-2">
            {[["Make it Premium", "make-premium"], ["Improve Project", "optimize-landing"], ["Production Ready", "production-ready"]].map(([l, id]) => {
              const team = p.teams.find((t) => t.id === id);
              if (!team) return null;
              const locked = team.agents.some((a) => !isAllowed(a));
              return <button key={id} disabled={!!busy || locked} onClick={() => run(`${l}: improve the project for this goal.`, team.agents[0], team.agents.slice(1))} className="btn btn-outline btn-sm justify-between" title={team.description}>{l}{locked && <Lock size={10} />}</button>;
            })}
            <button disabled={!!busy} onClick={() => run("Make the entire site work perfectly on mobile: fix overflow, spacing, typography, navigation, grids and touch targets.", "builder")} className="btn btn-outline btn-sm">Make it Mobile</button>
          </div>
          <div className="label px-2 py-1">Agent teams</div>
          <div className="px-2 grid gap-1 mb-2">
            {p.teams.map((t) => { const locked = t.agents.some((a) => !isAllowed(a)); return <button key={t.id} disabled={!!busy || locked} onClick={() => run(input || `Run the ${t.name} workflow on this project.`, t.agents[0], t.agents.slice(1))} className="text-left rounded-lg border border-graphite px-2 py-1.5 hover:border-ash disabled:opacity-50 min-w-0 overflow-hidden" title={t.description}><div className="font-medium flex items-center justify-between">{t.name}{locked && <Lock size={10} className="text-ash" />}</div><div className="text-[10px] text-ash truncate">{t.description}</div></button>; })}
          </div>
          <div className="label px-2 py-1">Agents</div>
          {allAgents.map((a) => {
            const allowed = isAllowed(a.id);
            const active = busy === a.id;
            return (
              <button key={a.id} disabled={!allowed} onClick={() => { setAgentId(a.id); setBottom("chat"); }} className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 ${agentId === a.id ? "bg-graphite" : "hover:bg-ink"} ${allowed ? "" : "opacity-50"}`} title={a.description}>
                <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-success pulse-dot" : allowed ? "bg-ash/50" : "bg-graphite"}`} />
                <span className="flex-1 min-w-0"><span className="block text-fog">{a.name}{a.id.startsWith("custom:") && <span className="ml-1 text-[9px] text-signal-soft">custom</span>}</span><span className="block text-[10px] text-ash truncate">{a.short}</span></span>
                {!allowed && <span className="text-[9px] text-ash flex items-center gap-0.5"><Lock size={9} />{a.id.startsWith("custom:") ? "AGENCY" : p.minPlanByAgent[a.id]}</span>}
              </button>
            );
          })}
        </aside>}
      </div>
    </div>
  );
}

function now() {
  return new Date().toLocaleTimeString([], { hour12: false });
}
