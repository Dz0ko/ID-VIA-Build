"use client";
import { LimitNotice, notifyLimit } from "@/lib/credit-notice";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, Rocket, Download, Monitor, Tablet, Smartphone, Code2, Eye, History, MessageSquare, TerminalSquare, AlertTriangle, Lock, Play, RotateCcw, Save, Activity, ExternalLink, Users, FileCode2, Folder, ChevronRight, Image as ImageIcon, X, Share2, Link2, Trash2, CheckCircle2,
} from "@/components/icons";
import { selectedComponents, componentImplementationPrompt, SELECTABLE_COMPONENTS, MAX_COMPONENT_SELECTION } from "@/lib/component-selection";
import { ProjectDownloadDialog } from "./ProjectDownload";
import { readImportHandoff, clearImportHandoff } from "@/lib/import-handoff";
import { shellIntent } from "@/lib/shell-intent";
import { editorLanguage, legacyReactSource, safeProjectPath } from "@/lib/project-source";
import { deploymentProfile } from "@/lib/deployment-profile";
import type { RuntimeReport } from "@/lib/runtime-report";
import { runtimeProfile, projectTaskCommand } from "@/lib/runtime-profile";
import { runtimeCommand } from "@/lib/runtime-command";
import { RuntimeDetails } from "./RuntimeDetails";
import { ComposerSelect } from "./ComposerSelect";
import { StackSuggestions } from "./StackSuggestions";
import { QualitySuggestions } from "./QualitySuggestions";
import { embedFixRequest } from "@/lib/preview-embedding";
import { WorkspaceMenuButton } from "./Shell";
import type { AgentDef } from "@/lib/agents";
import type { PlanId, ModelTier } from "@/lib/plans";
import { MODEL_TIERS } from "@/lib/plans";
import type { AuditResult } from "@/lib/audit";
import { protectProjectNavigation } from "@/lib/project-navigation";

const ComponentCatalog = dynamic(() => import("./ComponentCatalog").then(m => m.ComponentCatalog));
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
type AgentActivity = { id: string; label: string; detail: string; status: "running" | "done" };
type QualityChoice = { id: "high" | "xhigh"; label: string; credits: number; minutes: string; detail: string; recommended: boolean };
type DiffLine = { kind: "context" | "add" | "remove"; text: string };
type DiffFile = { path: string; lines: DiffLine[]; added: number; removed: number };

function makeDiff(before: string, after: string, path: string): DiffFile {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
  const changed: DiffLine[] = [
    ...oldLines.slice(Math.max(prefix, 0), oldLines.length - suffix).map((text) => ({ kind: "remove" as const, text })),
    ...newLines.slice(Math.max(prefix, 0), newLines.length - suffix).map((text) => ({ kind: "add" as const, text })),
  ];
  const contextBefore = oldLines.slice(Math.max(0, prefix - 3), prefix).map((text) => ({ kind: "context" as const, text }));
  const contextAfter = oldLines.slice(oldLines.length - suffix, Math.min(oldLines.length, oldLines.length - suffix + 3)).map((text) => ({ kind: "context" as const, text }));
  const lines = [...contextBefore, ...changed, ...contextAfter];
  return { path, lines: lines.length > 260 ? [...lines.slice(0, 260), { kind: "context", text: "… more changed lines hidden" }] : lines, added: changed.filter((line) => line.kind === "add").length, removed: changed.filter((line) => line.kind === "remove").length };
}

function makeDiffs(beforeFiles: ProjFile[], afterFiles: ProjFile[]): DiffFile[] {
  const before = new Map(beforeFiles.map((file) => [file.path, file.content]));
  return afterFiles.map((file) => makeDiff(before.get(file.path) ?? "", file.content, file.path)).filter((file) => file.added || file.removed);
}

export interface WorkspaceProps {
  releases?: { number: number; createdAt: string; deployedAt?: string; provider?: string; url?: string }[];
  project: {
    id: string; name: string; slug: string; status: string; kind: string; html: string; memory?: string; description: string | null; health: string | null; clientStatus: string;
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
  const projectStack = useMemo(() => { try { return (JSON.parse(p.project.memory || "{}").stack as string | undefined) ?? "React + TypeScript"; } catch { return "React + TypeScript"; } }, [p.project.memory]);
  const [html, setHtml] = useState(p.project.html);
  const [savedHtml, setSavedHtml] = useState(p.project.html);
  const [files, setFiles] = useState<ProjFile[]>(p.project.files);
  const isReactApp = isApp && legacyReactSource(files, projectStack);
  const runtime = useMemo(() => runtimeProfile(isApp ? files : [{ path: "index.html", content: html }, ...files], projectStack), [files, projectStack, isApp, html]);
  const deployment = useMemo(() => deploymentProfile(isApp ? files : [{ path: "index.html", content: html }, ...files]), [files, isApp, html]);
  const [buildReport, setBuildReport] = useState<RuntimeReport | null>(null);
  const [runtimeIssue, setRuntimeIssue] = useState<string | null>(null);
  const refreshRuntime = useCallback(async (): Promise<RuntimeReport | null> => { const res = await fetch(`/api/projects/${p.project.id}/runtime`, { cache: "no-store" }); if (!res.ok) return null; const report = (await res.json()).report as RuntimeReport | null; setBuildReport(report); return report; }, [p.project.id]);
  // A failed build is repaired by the Debugger and rebuilt by itself, at most twice per click, so a preview opens without the user reading compiler output.
  const repairRounds = useRef(0);
  const autoRebuild = useRef(false);
  // The repair loop continues while each round changes the failure; the same error twice in a row means the agent is stuck.
  const MAX_REPAIR_ROUNDS = 5;
  const lastFailure = useRef("");
  const failureSignature = (log: string) => log.slice(-1200).replace(/\d+/g, "").replace(/\s+/g, " ").trim();
  // The memoized run callback reaches the current terminal function through a ref (term is redefined every render).
  const termRef = useRef<(cmd: string) => Promise<void>>(async () => {});
  termRef.current = term;
  const [savedFiles, setSavedFiles] = useState<ProjFile[]>(p.project.files);
  const [activeFile, setActiveFile] = useState<string>(p.project.files[0]?.path ?? "/App.tsx");
  const [releases, setReleases] = useState(p.releases ?? []);
  const refreshReleases = async () => { const res = await fetch(`/api/projects/${p.project.id}/releases`); if (res.ok) { const rows = (await res.json()).releases; setReleases(rows); return rows as typeof releases; } return releases; };
  const [downloadOpen, setDownloadOpen] = useState(false);
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
  const [componentIds, setComponentIds] = useState<string[]>(() => selectedComponents(params.get("prompt") ?? ""));
  const [componentsOpen, setComponentsOpen] = useState(false);
  const componentsDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (componentsOpen) componentsDialog.current?.showModal(); else componentsDialog.current?.close(); }, [componentsOpen]);
  const [input, setInput] = useState((params.get("prompt") ?? "").replace(/\s*\[COMPONENT:[a-z0-9-]+\]/g, ""));
  const [images, setImages] = useState<RefImage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [stream, setStream] = useState("");
  const [responseMode, setResponseMode] = useState<"rewrite" | "report">("rewrite");
  const [activity, setActivity] = useState<AgentActivity[]>([]);
  // Seconds since the current run started; ticks locally so the panel moves even between server events.
  const [elapsed, setElapsed] = useState(0);
  const [diffs, setDiffs] = useState<DiffFile[]>([]);
  const [pendingStackRequest, setPendingStackRequest] = useState<string | null>(() => {
    try { const memory = JSON.parse(p.project.memory || "{}"); return typeof memory.pendingBuildRequest === "string" && !memory.pendingQuality && !(memory.stack && memory.quality) ? memory.pendingBuildRequest : null; } catch { return null; }
  });
  // Both questions are answered but the first build never finished: the brief is offered again as one click.
  const [savedBrief, setSavedBrief] = useState<string | null>(() => {
    try { const memory = JSON.parse(p.project.memory || "{}"); return typeof memory.pendingBuildRequest === "string" && !memory.pendingQuality && memory.stack && memory.quality ? memory.pendingBuildRequest : null; } catch { return null; }
  });
  // The quality-mode question (asked once per project after the technology) survives a reload via project memory.
  const [qualityChoices, setQualityChoices] = useState<QualityChoice[] | null>(() => {
    try { const pending = JSON.parse(p.project.memory || "{}").pendingQuality; return Array.isArray(pending) ? pending : null; } catch { return null; }
  });
  // A multi-file build the time limit split into parts: the saved part count survives a reload via project memory.
  const [buildContinuation, setBuildContinuation] = useState<{ round: number; filesDone: number } | null>(() => {
    try { const pending = JSON.parse(p.project.memory || "{}").pendingContinuation; return pending && typeof pending.round === "number" && Array.isArray(pending.done) ? { round: pending.round, filesDone: pending.done.length } : null; } catch { return null; }
  });
  const continuationRef = useRef<{ round: number; filesDone: number } | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([{ t: now(), text: "Workspace ready.", kind: "info" }]);
  const [runtimePreview, setRuntimePreview] = useState<{ url: string; source: string; kind?: "build" | "shell"; blocked?: string | null } | null>(null);
  const runtimeSource = isApp ? JSON.stringify(files) : html;
  const runtimeUrl = runtimePreview?.source === runtimeSource ? runtimePreview.url : null;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/projects/${p.project.id}/runtime`, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (controller.signal.aborted) return;
      setBuildReport(data.report);
      if (data.preview?.url) {
        const url = new URL(data.preview.url);
        if (url.protocol === "https:" && url.hostname.endsWith(".e2b.app")) setRuntimePreview(previous => previous ?? { url: url.href, source: isApp ? JSON.stringify(savedFiles) : savedHtml, kind: "build" });
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [p.project.id, isApp, savedFiles, savedHtml]);
  const terminalAction = useRef<((cmd: string) => Promise<void>) | null>(null);
  const terminalRunning = useRef(false);
  const terminalAbort = useRef<AbortController | null>(null);
  const [shellCommand, setShellCommand] = useState<{ id: number; text: string; previewPort?: number | null } | null>(null);
  const [shellOpened, setShellOpened] = useState(false);
  const [termBusy, setTermBusy] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(p.project.health ? JSON.parse(p.project.health) : null);
  const runtimeProblem = Boolean(runtimeIssue || buildReport?.status === "error");
  const problemCount = (audit?.issues.length ?? 0) + (runtimeProblem ? 1 : 0);
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
  const promptInput = useRef<HTMLTextAreaElement>(null);

  const dirty = isApp ? JSON.stringify(files) !== JSON.stringify(savedFiles) : html !== savedHtml;
  const allAgents = useMemo(() => [
    ...p.agents,
    ...p.customAgents.map((c): AgentDef => ({ id: `custom:${c.id}`, name: c.name, short: c.description.slice(0, 60) || "Custom agent", description: c.description, order: 999, tier: c.tier as ModelTier, multiplier: 2, mode: c.mode === "report" ? "report" : "rewrite", systemPrompt: "", tags: ["custom"] })),
  ], [p.agents, p.customAgents]);
  const agent = allAgents.find((a) => a.id === agentId) ?? allAgents[0];
  const isAuto = agentId === "auto";
  const isAllowed = useCallback((id: string) => (id === "auto" ? true : id.startsWith("custom:") ? p.customAgentsAllowed : p.allowedAgentIds.includes(id)), [p.allowedAgentIds, p.customAgentsAllowed]);
  const previewSrc = useMemo(() => protectProjectNavigation(html || `<!DOCTYPE html><html><body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0a0a0b;color:#8a8a93">Describe what to build in the chat below.</body></html>`), [html]);
  const log = useCallback((text: string, kind: LogLine["kind"] = "info") => setLogs((l) => [...l, { t: now(), text, kind }].slice(-600)), []);

  // Follow the conversation while the agent writes, reports steps or finishes; a reader who scrolled up stays put until they return near the bottom.
  useEffect(() => { const el = chatEnd.current?.parentElement; if (el && followChat.current) el.scrollTop = el.scrollHeight; }, [messages, stream, busy, bottom, activity, qualityChoices, pendingStackRequest, buildContinuation]);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
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
    setResponseMode("rewrite");
    setDiffs([]);
    setActivity([{ id: `activity-${Date.now()}`, label: "Start task", detail: "Preparing the agent workspace", status: "running" }]);
    setElapsed(0);
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
      if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); if (notifyLimit(d)) throw new LimitNotice(d.error); throw new Error(d.error ?? `Request failed (${res.status})`); }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      let usedCredits = 0;
      let completed = false;
      let clarified = false;
      let rewrote = false;
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
          if (ev.type === "picked") { const a = allAgents.find((x) => x.id === ev.agent); log(`Router → handing this to ${a?.name ?? ev.agent}${a?.profession ? ` (${a.profession})` : ""}`); setBusy(ev.agent); busyRef.current = ev.agent; setActivity((items) => [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}`, label: "Route request", detail: `Handing this to ${a?.name ?? ev.agent}`, status: "running" }]); }
          else if (ev.type === "clarification") {
            clarified = true;
            const qualityQuestion = ev.kind === "quality" && Array.isArray(ev.choices);
            const stackQuestion = !qualityQuestion && Boolean(ev.request);
            setPendingStackRequest(stackQuestion ? ev.request : null);
            setQualityChoices(qualityQuestion ? ev.choices : null);
            setMessages((m) => [...m, { id: `q-${Date.now()}`, role: "assistant", content: ev.message, agentId: busyRef.current ?? agentToRun, creditsUsed: 0, model: null, createdAt: new Date().toISOString() }]);
            const label = qualityQuestion ? "Choose quality mode" : stackQuestion ? "Choose project stack" : "Question for you";
            const detail = qualityQuestion ? "Waiting for your quality choice; no credits were charged" : stackQuestion ? "Waiting for your language or framework choice" : "Waiting for your answer; no credits were charged";
            setActivity((items) => [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}`, label, detail, status: "done" }]);
            log(detail);
          }
          else if (ev.type === "agent") { setMessages((m) => [...m, { id: `i-${Date.now()}`, role: "assistant", content: ev.text, agentId: ev.agent, creditsUsed: 0, model: null, createdAt: new Date().toISOString() }]); log(`${ev.name} (${ev.profession}) started`); setActivity((items) => [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}`, label: ev.name, detail: `${ev.profession} started`, status: "running" }]); }
          else if (ev.type === "meta") {
            setResponseMode(ev.mode ?? "rewrite");
            usedCredits = ev.credits; setCredits((c) => c - ev.credits);
            log(`Routed → ${ev.tier} tier · ${ev.provider}/${ev.model} · task=${ev.taskClass} · ${ev.credits} credits${ev.fallback ? " · template engine" : ""}`);
            setActivity((items) => [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}`, label: "Plan work", detail: `${ev.tier} model · ${ev.taskClass} task`, status: "running" }]);
          } else if (ev.type === "tool") {
            const label = ({ search: "Search project", read_file: "Read source", edit_file: "Edit file", write_file: "Write file", delete_file: "Delete file", check_project: "Check project", list_files: "List files" } as Record<string, string>)[ev.name] ?? "Agent step";
            log(ev.detail);
            setActivity((items) => [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}-${items.length}`, label, detail: String(ev.detail), status: "running" as const }].slice(-40));
          } else if (ev.type === "reading") {
            acc = ""; setStream("");
            const detail = `Reading ${ev.files.join(", ")}`; log(detail);
            setActivity((items) => [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}`, label: "Read source", detail, status: "running" }]);
          } else if (ev.type === "retry") {
            acc = ""; setStream(""); log(ev.message);
            setActivity((items) => [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}`, label: "Automatic retry", detail: ev.message, status: "running" }]);
          } else if (ev.type === "delta") {
            acc += ev.text;
            setStream(acc);
            const fileMatch = [...acc.matchAll(/<<<FILE\s+([^\s>]+)\s*>>>/g)].at(-1)?.[1];
            const detail = /^<<<ANSWER>>>/.test(acc) ? "Writing an answer" : fileMatch ? `Generating ${fileMatch}` : null;
            if (detail) setActivity((items) => {
              const current = items.find((item) => item.label === "Work in progress" && item.status === "running");
              if (current) return items.map((item) => item.id === current.id ? { ...item, detail } : item);
              return [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}`, label: "Work in progress", detail, status: "running" }];
            });
          } else if (ev.type === "progress") {
            // Server heartbeat every few seconds: thinking, writing, checking, saving, with elapsed time.
            const label = ev.phase === "checking" ? "Check result" : ev.phase === "saving" ? "Save change" : "Work in progress";
            setActivity((items) => {
              const current = items.find((item) => item.label === label && item.status === "running");
              if (current) return items.map((item) => item.id === current.id ? { ...item, detail: ev.message } : item);
              return [...items.map((item) => ({ ...item, status: "done" as const })), { id: `activity-${Date.now()}`, label, detail: ev.message, status: "running" }];
            });
          }
          else if (ev.type === "done") {
            completed = true;
            setCredits(c => c + usedCredits - ev.creditsUsed);
            setActivity([]); setStream("");
            if (ev.mode === "rewrite") {
              rewrote = true;
              if (ev.files) { setDiffs(makeDiffs(savedFiles, ev.files)); setFiles(ev.files); setSavedFiles(ev.files); setActiveFile((f) => (ev.files.some((x: ProjFile) => x.path === f) ? f : "/App.tsx")); }
              else { setDiffs([makeDiff(savedHtml, ev.html ?? "", "index.html")].filter((file) => file.added || file.removed)); setHtml(ev.html); setSavedHtml(ev.html); }
              setVersions((v) => [{ id: `v${ev.versionNumber}`, number: ev.versionNumber, message: `${agentToRun}: ${request.slice(0, 120)}`, createdAt: new Date().toISOString() }, ...v]);
              setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: ev.note ?? `Updated the ${isApp ? "app" : "project"}.`, agentId: busyRef.current ?? agentToRun, creditsUsed: ev.creditsUsed, model: null, createdAt: new Date().toISOString() }]);
              setView("preview");
              setSavedBrief(null);
              if (ev.continuation) { continuationRef.current = ev.continuation; setBuildContinuation(ev.continuation); log(`✓ Part saved (${ev.creditsUsed} credits) · ${ev.continuation.filesDone} files so far · continuing with part ${ev.continuation.round}`, "ok"); }
              else { setBuildContinuation(null); log(`✓ Change saved (${ev.creditsUsed} credits)`, "ok"); }
            } else {
              setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: ev.report, agentId: busyRef.current ?? agentToRun, creditsUsed: ev.creditsUsed, model: null, createdAt: new Date().toISOString() }]);
              log(`✓ ${agentToRun} report ready (${ev.creditsUsed} credits)`, "ok");
            }
            setRuns((r) => [{ id: `r-${Date.now()}`, agentId: agentToRun, status: "DONE", task: request, model: null, creditsUsed: ev.creditsUsed, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), output: ev.mode === "rewrite" ? `Change #${ev.versionNumber}` : "report" }, ...r]);
          } else if (ev.type === "error") { setCredits((c) => c + usedCredits); if (notifyLimit(ev)) throw new LimitNotice(ev.message); throw new Error(ev.message); }
        }
      }
      if (!completed && !clarified) throw new Error("The connection ended before the agent finished. Please try again.");
      if (rewrote) await runAuditRequest(false);
      setStream("");
      // A question from the agent ends this turn cleanly; the server keeps the pending request, so the
      // stack wrapper must not be restored or the next answer would arrive as a technology choice.
      return completed ? "done" : clarified ? "clarified" : false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      // A credit or plan limit already opened the upgrade dialog; it is an offer, not an error.
      if (e instanceof LimitNotice) log(`ℹ ${msg}`); else setError(msg);
      if (!(e instanceof LimitNotice)) log(`✗ ${msg}`, "err");
      setStream("");
      return false;
    } finally {
      // Reconcile the real balance after holds, refunds, concurrent runs or a dropped stream.
      try {
        const response = await fetch("/api/me", { cache: "no-store", signal: AbortSignal.timeout(5000) });
        const account = response.ok ? await response.json() : null;
        if (typeof account?.user?.credits === "number") setCredits(account.user.credits);
      } catch { /* The server refresh also supplies the balance when connectivity returns. */ }
      busyRef.current = null; setBusy(null); setActivity([]); abortRef.current = null; router.refresh();
    }
  }, [allAgents, isApp, log, p.project.id, provider, router, savedFiles, savedHtml, tier]);

  useEffect(() => { terminalAction.current = term; });

  const run = useCallback(async (request: string, agentToRun: string = agentId, chain: string[] = [], importImages?: RefImage[]): Promise<void> => {
    if ((!request.trim() && !componentIds.length) || busyRef.current || terminalRunning.current) return;
    // Sending a message means the reader wants to see the reply: follow the chat again even after scrolling up.
    followChat.current = true;
    const command = runtimeCommand(request) ?? shellIntent(request);
    if (command && !chain.length && !componentIds.length) { await terminalAction.current?.(command); return; }
    if (componentIds.length && allAgents.find(a => a.id === agentToRun)?.mode === "report") agentToRun = "builder";
    const composed = componentImplementationPrompt(request, componentIds);
    if (composed.length > 8000) { setError("The message is too long with these components. Shorten your instructions and try again."); setInput(request); return; }
    const effectiveRequest = pendingStackRequest ? `${pendingStackRequest}\n\nSTACK CHOICE: ${composed}` : composed;
    if (pendingStackRequest) setPendingStackRequest(null);
    setQualityChoices(null);
    const imgs = importImages ?? images; setImages([]);
    let saved = false;
    for (const [i, id] of [agentToRun, ...chain].entries()) {
      const outcome = await runOne(effectiveRequest, id, i === 0 ? imgs : []);
      if (outcome === "done") { saved = true; setComponentIds([]); if (params.get("from") === "import") void clearImportHandoff(p.project.id).catch(() => {}); }
      if (outcome === "clarified") { setComponentIds([]); break; }
      if (!outcome) { if (pendingStackRequest) setPendingStackRequest(pendingStackRequest); setInput((current) => current || request); if (i === 0) setImages(imgs); break; }
    }
    // The time limit split the build: the next part starts by itself from the saved files.
    if (continuationRef.current) { continuationRef.current = null; await run("CONTINUE BUILD", "builder"); }
    // An automatic repair is followed by a rebuild, which opens the preview or hands the next failure back to the Debugger.
    if (autoRebuild.current) { autoRebuild.current = false; if (saved) await termRef.current("npm run build"); }
  }, [agentId, images, pendingStackRequest, runOne, componentIds, allAgents, params, p.project.id]);

  useEffect(() => {
    if (params.get("auto") === "1" && !autoRan.current) {
      autoRan.current = true;
      if (params.get("from") === "import") {
        void readImportHandoff(p.project.id).then(handoff => {
          if (!handoff) { setError("The import reference is no longer available in this browser. Attach it again to continue."); return; }
          if (p.project.html || p.project.files.length) { void clearImportHandoff(p.project.id); return; }
          setInput(""); void run(handoff.prompt, "builder", [], handoff.images);
        }).catch(e => setError(e instanceof Error ? e.message : "Could not open import."));
        return;
      }
      let req = input;
      if (params.get("from") === "session") { try { req = sessionStorage.getItem(`idaevia:prompt:${p.project.id}`) ?? req; sessionStorage.removeItem(`idaevia:prompt:${p.project.id}`); } catch { /* ignore */ } }
      const hasContent = isApp ? p.project.files.length > 0 : Boolean(p.project.html);
      if (req && !hasContent) { queueMicrotask(() => { setInput(""); void run(req, "builder"); }); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attachImages(list: FileList | null) {
    if (!list) return;
    const next: RefImage[] = [];
    for (const f of Array.from(list).slice(0, 4 - images.length)) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type) || f.size > 4_500_000) { setError("Images must be PNG/JPEG/WebP/GIF under 4.5 MB."); continue; }
      try {
        const data = await new Promise<string>((res, reject) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => reject(new Error("Could not read image")); r.readAsDataURL(f); });
        const decoded = new Image(); decoded.src = `data:${f.type};base64,${data}`;
        await decoded.decode();
        next.push({ name: f.name, mediaType: f.type as RefImage["mediaType"], data });
      } catch { setError(`Could not open ${f.name}. Choose a valid PNG, JPEG, WebP or GIF image.`); }
    }
    setImages((i) => [...i, ...next].slice(0, 4));
    if (next.length && !input) setInput((isApp ? savedFiles.length > 0 : Boolean(savedHtml.trim())) ? "Use the attached image in this project. Ask me where to place it if the intended target is unclear, and preserve everything else." : "Recreate the attached reference design as a complete, original website with the same layout, typography, colours and spacing.");
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
      if (res.ok) { setSavedFiles(files); if (d.versionNumber) setVersions((v) => [{ id: `v${d.versionNumber}`, number: d.versionNumber, message: "Manual edit", createdAt: new Date().toISOString() }, ...v]); log(asVersion ? "✓ Change saved" : "✓ Saved", "ok"); } else throw new Error(d.error ?? "Request failed");
      return;
    }
    const res = await fetch(`/api/projects/${p.project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, saveVersion: asVersion }) });
    const d = await res.json();
    if (res.ok) { setSavedHtml(html); if (d.versionNumber) setVersions((v) => [{ id: `v${d.versionNumber}`, number: d.versionNumber, message: "Manual edit", createdAt: new Date().toISOString() }, ...v]); log(asVersion ? "✓ Change saved" : "✓ Saved", "ok"); } else throw new Error(d.error ?? "Request failed");
  }
  const restore = (n: number) => perform(() => restoreRequest(n));
  async function restoreRequest(n: number) {
    const res = await fetch(`/api/projects/${p.project.id}/versions/${n}`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    if (d.files) { setFiles(d.files); setSavedFiles(d.files); setActiveFile((current) => d.files.some((f: ProjFile) => f.path === current) ? current : d.files[0]?.path ?? "/App.tsx"); } else { setHtml(d.html); setSavedHtml(d.html); }
    setVersions((v) => [{ id: `v${d.versionNumber}`, number: d.versionNumber, message: `Restored change #${n}`, createdAt: new Date().toISOString() }, ...v]); log(`↺ Restored change #${n}`, "ok");
  }
  const previewVersion = (n: number) => perform(() => previewVersionRequest(n));
  async function previewVersionRequest(n: number) {
    const res = await fetch(`/api/projects/${p.project.id}/versions/${n}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    if (d.version.files) { setFiles(d.version.files); setActiveFile((current) => d.version.files.some((f: ProjFile) => f.path === current) ? current : d.version.files[0]?.path ?? "/App.tsx"); } else setHtml(d.version.html);
    setView("preview"); log(`Previewing change #${n} (unsaved: Save or Restore to keep)`);
  }
  const publish = () => perform(async () => { try { await publishRequest(); } finally { setPublishing(false); } });
  async function publishRequest() {
    setPublishing(true);
    if (dirty) await persistCode(false);
    const res = await fetch(`/api/projects/${p.project.id}/publish`, { method: "POST" });
    const d = await res.json(); setPublishing(false);
    if (res.ok) { await refreshReleases(); setStatus("PUBLISHED"); log(`🚀 Published → ${d.url}`, "ok"); setBottom("logs"); } else throw new Error(d.error ?? "Request failed");
  }
  const runAudit = () => perform(() => runAuditRequest());
  async function runAuditRequest(saveDraft = true) {
    if (saveDraft && dirty) await persistCode(false);
    const res = await fetch(`/api/projects/${p.project.id}/audit`, { method: "POST" });
    const d = await res.json();
    if (res.ok) { setAudit(d.audit); setBottom("problems"); log(`Audit: ${d.audit.scope === "source" ? "source checks" : `${d.audit.overall}/100`}, ${d.audit.issues.length} findings`); } else throw new Error(d.error ?? "Audit failed");
  }
  const exportZip = () => setDownloadOpen(true);

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
    if (execution === "npm run build") { await term("platform: npm run build"); return; }
    const shell = platformAction ? null : projectTaskCommand(cmd, files, runtime) ?? shellIntent(cmd);
    if (execution === "stop" && runtimePreview?.kind === "build") { await term("platform: stop"); setRuntimePreview(null); return; }
    if (shell || execution) {
      if (dirty) { try { await persistCode(false); } catch (e) { setError(e instanceof Error ? e.message : "Could not save source"); return; } }
      if (execution === "preview") {
        try {
          const response = await fetch(`/api/projects/${p.project.id}/shell`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status" }) });
          const ready = await response.json();
          if (response.ok && ready.ready && typeof ready.url === "string") {
            const url = new URL(ready.url);
            if (url.protocol === "https:" && url.hostname.endsWith(".e2b.app")) {
              setRuntimePreview({ url: url.href, source: runtimeSource, blocked: typeof ready.blocked === "string" ? ready.blocked : null }); setView("preview"); setExpandedPanel(false); return;
            }
          }
        } catch { /* Start a fresh preview below. */ }
      }
      const text = execution === "preview" ? (isApp ? runtime.preview : "npm run dev") : execution === "stop" ? "\x03" : execution === "npm run build" ? runtime.build : shell!;
      setShellCommand({ id: Date.now(), text, ...(execution === "preview" ? { previewPort: isApp ? runtime.previewPort : 3000 } : {}) }); setShellOpened(true); setBottom("terminal"); setExpandedPanel(true);
      return;
    }
    setBottom("terminal");
    setExpandedPanel(true);
    if (cmd === "clear") { setTermLines([]); return; }
    if (cmd === "npm run build") { setRuntimeIssue(null); setRuntimePreview(null); setBuildReport(null); setBottom("logs"); }
    if (cmd === "history" || cmd === "git log") { push(...out, ...versions.map((v) => `Change #${v.number}  ${new Date(v.createdAt).toLocaleString()}  ${v.message}`)); return; }
    if (cmd === "versions") { const latest = await refreshReleases(); push(...out, ...latest.map(r => `v${r.number} · ${r.deployedAt ? "Deployed" : "Built"} · ${r.createdAt}`)); return; }
    if (cmd.startsWith("restore change ")) { const n = Number(cmd.replace("restore change ", "")); restore(n); push(...out, `Restoring change #${n}…`); return; }
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
            try { const ev = JSON.parse(m[1]) as { kind: string; line: string }; if (ev.kind === "done") continue; if (ev.kind === "preview") { const url = new URL(ev.line); if (url.protocol === "https:" && url.hostname.endsWith(".e2b.app")) { setRuntimePreview({ url: url.href, source: runtimeSource, kind: "build" }); setView("preview"); setExpandedPanel(false); } } push(ev.line); log(ev.line, ev.kind === "err" ? "err" : ev.kind === "ok" ? "ok" : "info"); if (/^✓ Live at |^https:\/\//.test(ev.line) && cmd.startsWith("publish")) setStatus("PUBLISHED"); } catch { /* ignore */ }
          }
        }
      } catch (e) { push(`✗ ${e instanceof Error ? e.message : "terminal error"}`); }
      finally {
        const report = await refreshRuntime().catch(() => null); await refreshReleases().catch(() => {}); setTermBusy(false); terminalRunning.current = false; terminalAbort.current = null;
        if (cmd === "npm run build" && report?.status === "error" && report.origin === "platform") {
          log("✗ Platform problem (build environment, not your code). It has been reported to the platform team; try again in a minute.", "err");
        } else if (cmd === "npm run build" && report?.status === "error" && report.current && !busyRef.current && repairRounds.current > 0 && failureSignature(report.log) === lastFailure.current) {
          log("✗ The same error came back after the last fix, so automatic repair stopped. Open Problems to see it, or describe the fix in the chat.", "err");
        } else if (cmd === "npm run build" && report?.status === "error" && report.current && repairRounds.current < MAX_REPAIR_ROUNDS && !busyRef.current) {
          repairRounds.current += 1; autoRebuild.current = true; lastFailure.current = failureSignature(report.log);
          log(`Build failed in the project's code · the Debugger is fixing it automatically (round ${repairRounds.current} of up to ${MAX_REPAIR_ROUNDS})…`);
          setBottom("chat"); setExpandedPanel(true);
          // The server holds the build log and hands it to the agent; the chat message stays short.
          void run(`Fix the compilation/startup failure from the last build of this ${runtime.label} project. Preserve the requested stack and design.`, isAllowed("debugger") ? "debugger" : "builder");
        }
      }
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
        <div className="text-sm font-medium truncate">{p.project.name} {isApp && <span className="pill text-[10px] ml-1">{projectStack}</span>}</div>
          <div className="text-[11px] text-ash font-mono truncate">{status === "PUBLISHED" ? `live · /s/${p.project.slug}` : "draft"} · {credits.toLocaleString()} credits{clientStatus !== "NONE" && ` · client: ${clientStatus.toLowerCase().replace("_", " ")}`}</div>
        </div>
        <div className="mx-auto flex items-center gap-1 border border-graphite rounded-full p-0.5">
          <button onClick={() => { setBottom("chat"); setExpandedPanel(true); }} className={`btn btn-sm ${expandedPanel && bottom === "chat" ? "btn-primary" : "btn-ghost"}`}><MessageSquare size={13} />Chat</button>
          <button onClick={() => { if (isApp && !isReactApp && !runtimeUrl) { repairRounds.current = 0; lastFailure.current = ""; void term("npm run build"); } else { setView("preview"); setExpandedPanel(false); } }} className={`btn btn-sm ${!expandedPanel && view === "preview" ? "btn-primary" : "btn-ghost"}`}><Eye size={13} />Preview</button>
          <button onClick={() => { setView("code"); setExpandedPanel(false); setShowFiles(true); }} className={`btn btn-sm ${!expandedPanel && view === "code" ? "btn-primary" : "btn-ghost"}`}><Code2 size={13} />Code</button>
        </div>
        <button disabled={!!busy || termBusy} onClick={() => { repairRounds.current = 0; lastFailure.current = ""; void term("npm run build"); }} className="btn btn-outline btn-sm"><Play size={13} />{termBusy ? "Running…" : runtime.previewPort === null ? "Build / check" : "Build & preview"}</button>
        {!isApp && <div className="hidden lg:flex items-center gap-0.5 border border-graphite rounded-full p-0.5">
          {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, I]) => (
            <button key={d} onClick={() => setDevice(d)} className={`btn btn-sm ${device === d ? "bg-graphite" : "btn-ghost"}`} title={d}><I size={13} /></button>
          ))}
        </div>}
        <button onClick={() => setShowFiles(!showFiles)} aria-expanded={showFiles} className="btn btn-ghost btn-sm" title="Toggle project files"><Folder size={14} />Files</button>
        <button onClick={() => setShowTeam(!showTeam)} aria-expanded={showTeam} className="btn btn-ghost btn-sm" title="Toggle AI team"><Users size={14} />Agents</button>
        {(audit || runtimeProblem) && <button onClick={() => { setBottom("problems"); setExpandedPanel(true); }} className="pill text-xs gap-1.5" title="Project checks"><Activity size={11} className={problemCount ? "text-warning" : "text-success"} />{runtimeProblem || audit?.scope === "source" ? `${problemCount} findings` : audit?.overall}</button>}
        <button onClick={() => { setBottom("share"); setExpandedPanel(true); loadShare(); }} className="btn btn-outline btn-sm" title="Client portal & share"><Share2 size={13} /></button>
        {<button onClick={() => { setBottom("problems"); setExpandedPanel(true); runAudit(); }} className="btn btn-outline btn-sm" title="Production audit"><AlertTriangle size={13} />Audit</button>}
        <button onClick={exportZip} className="btn btn-outline btn-sm" title="Export code"><Download size={13} /></button>
        {status === "PUBLISHED" && <a href={`/s/${p.project.slug}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm"><ExternalLink size={13} /></a>}
        <button onClick={() => { setExpandedPanel(true); if (isApp) { if (!deployment.supported) { setError(deployment.reason ?? "Configure a compatible hosting runtime."); setBottom("logs"); log(deployment.reason ?? "Configure hosting."); } else { setBottom("terminal"); term("deploy vercel"); } } else publish(); }} disabled={publishing || termBusy || (isApp ? files.length === 0 : !html)} title={isApp ? (deployment.supported ? `Deploy ${deployment.label} to Vercel` : "View deployment requirements") : "Publish this website"} className="btn btn-signal btn-sm"><Rocket size={13} />{publishing ? "Deploying…" : status === "PUBLISHED" ? "Redeploy" : "Deploy"}</button>
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
                <button key={f.path} onClick={() => { setActiveFile(f.path); setView("code"); }} className={`w-full text-left px-2 py-1 pl-6 flex items-center gap-1.5 rounded ${view === "code" && activeFile === f.path ? "bg-graphite text-paper" : "text-fog hover:bg-ink"}`} title={f.path}><FileCode2 size={12} className="text-signal-soft shrink-0" /><span className="truncate">{f.path.replace(/^\/+/, "")}</span></button>
              ))}
              {fileTree.length === 0 && <div className="px-2 pl-6 text-ash">No files yet: describe the app below.</div>}
              <button onClick={() => { const input = prompt("New file path (e.g. /app/[id]/page.tsx or /src/main.py)"); const path = input ? safeProjectPath(input) : null; if (path && !files.some((f) => f.path === path)) { setFiles((f) => [...f, { path, content: "" }]); setActiveFile(path); setView("code"); } }} className="w-full text-left px-2 py-1 pl-6 text-ash hover:text-paper">+ new file</button>
            </>
          ) : (
            <>
              <button onClick={() => { setView("code"); setExpandedPanel(false); setShowFiles(true); }} className={`w-full text-left px-2 py-1 pl-6 flex items-center gap-1.5 rounded ${view === "code" ? "bg-graphite text-paper" : "text-fog hover:bg-ink"}`}><FileCode2 size={12} className="text-signal-soft" />index.html{dirty && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-warning" />}</button>

            </>
          )}
          <div className="label px-2 py-1 mt-4 flex items-center gap-1"><Rocket size={11} />Build versions</div>
          {!releases.length && <p className="px-2 py-1 text-ash text-xs">No successful tracked builds yet.</p>}
          {releases.map(r => <div key={r.number} className="px-2 py-2 text-xs"><span className="text-signal-soft font-mono">v{r.number}</span> <span className="text-fog">{r.deployedAt ? "Deployed" : "Built"}</span><div className="text-ash mt-1">{new Date(r.createdAt).toLocaleString()}</div>{r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-signal-soft underline">Open deployment ↗</a>}</div>)}
          <div className="label px-2 py-1 mt-4 flex items-center gap-1"><History size={11} />Change history</div>
          {versions.length === 0 && <div className="px-2 text-ash">No saved changes yet.</div>}
          {versions.map((v) => (
            <div key={v.id} className="group px-2 py-1 rounded hover:bg-ink">
              <button onClick={() => previewVersion(v.number)} className="w-full text-left flex items-center gap-1.5"><ChevronRight size={10} className="text-ash" /><span className="truncate text-fog">{v.message}</span></button>
              <button onClick={() => restore(v.number)} className="hidden group-hover:flex items-center gap-1 pl-5 text-[10px] text-ash hover:text-paper"><RotateCcw size={9} />restore</button>
            </div>
          ))}
        </aside>}

                <ProjectDownloadDialog projectId={p.project.id} name={p.project.name} open={downloadOpen} onClose={() => setDownloadOpen(false)} beforeDownload={async () => { if (dirty) await persistCode(false); }} />
        {/* Center */}
        <section className="min-w-0 min-h-0 flex-1 flex flex-col">
          <div className="flex-1 min-h-0 bg-[#050506] p-3 overflow-auto" hidden={expandedPanel}>
            {view === "preview" ? (
              runtimeUrl ? <div className="h-full flex flex-col">
                <div className="shrink-0 flex items-center gap-3 pb-2 text-xs text-ash"><span className="truncate">{runtimeUrl}</span><a href={runtimeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Open preview <ExternalLink size={12} /></a><button onClick={() => term("stop")} disabled={termBusy} className="btn btn-ghost btn-sm">Stop</button></div>
                {runtimePreview?.blocked && <div role="status" className="shrink-0 mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-xs text-fog">
                  <span className="min-w-0 flex-1">This app refuses to be embedded here ({runtimePreview.blocked}), so the frame below stays blank while “Open preview” works. The builder can allow the platform preview without weakening the other security headers.</span>
                  <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => { void run(embedFixRequest(runtimePreview.blocked!), "builder"); }}>Allow embedding</button>
                </div>}
                <iframe title="Built project preview" src={runtimeUrl} className="w-full flex-1 min-h-0 rounded-lg border border-graphite bg-white" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin" />
              </div> : isReactApp && !files.some(f => f.path === "/package.json") ? (
                <div className="h-full rounded-lg overflow-hidden border border-graphite bg-white">
                  {files.length ? <AppSandbox files={files} /> : <div className="h-full grid place-items-center text-sm text-ash bg-void">Describe the app you want in the chat below: e.g. “Build an admin dashboard for a SaaS with sidebar, KPI cards, a revenue chart and a customers table.”</div>}
                </div>
              ) : isApp ? (
                <div className="h-full grid place-items-center rounded-lg border border-graphite bg-void p-6 text-center text-sm text-ash"><div><div className="text-paper font-medium mb-2">{runtime.label} project</div><p>{runtime.issue ?? (runtime.previewPort === null ? "This target runs in Terminal. A browser preview requires an HTTP server; configure its command and port in .idaevia/runtime.json." : "Start the project in its isolated runtime.")}</p><p> Web servers open here when ready; command-line output appears in Terminal. Configure required environment variables in Integrations.</p><button onClick={() => { void term("preview"); }} className="btn btn-outline btn-sm mt-4"><Play size={13} />{runtime.previewPort === null ? "Run in Terminal" : "Start preview"}</button></div></div>
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
                    <button onClick={() => saveCode(true)} disabled={!dirty} className="btn btn-outline btn-sm">Save checkpoint</button>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <MonacoEditor
                    height="100%"
                    path={isApp ? activeFile : "index.html"}
                    language={editorLanguage(isApp ? activeFile : "index.html")}
                    theme="vs-dark"
                    value={isApp ? files.find((f) => f.path === activeFile)?.content ?? "" : html}
                    onChange={(v) => (isApp ? setFiles((fs) => fs.map((f) => (f.path === activeFile ? { ...f, content: v ?? "" } : f))) : setHtml(v ?? ""))}
                    options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on", fontFamily: "JetBrains Mono, monospace", scrollBeyondLastLine: false }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Chat and tools panel. Preview/Code mode gets the full center height. */}
          {expandedPanel && <div className="shrink-0 min-h-0 border-t border-graphite flex flex-col" style={{ height: "100%" }}>
            <div className="h-10 shrink-0 flex items-center gap-1 px-2 border-b border-graphite text-xs overflow-x-auto">
              {([["chat", "AI Chat", MessageSquare], ["changes", "Changes", History], ["terminal", "Terminal", TerminalSquare], ["logs", "Logs", Activity], ["problems", "Problems", AlertTriangle], ["share", "Share / Client portal", Share2]] as const).map(([id, label, I]) => (
                <button key={id} onClick={() => { setBottom(id); if (id === "problems") { runAudit(); void refreshRuntime(); } if (id === "terminal") setShellOpened(true); if (id === "logs") void refreshRuntime(); if (id === "share") loadShare(); }} className={`btn btn-sm ${bottom === id ? "bg-graphite text-paper" : "btn-ghost"}`}><I size={12} />{label}{id === "problems" && problemCount ? <span className="ml-1 text-[10px] text-warning">{problemCount}</span> : null}</button>
              ))}
              <button onClick={() => setExpandedPanel(!expandedPanel)} aria-label={expandedPanel ? "Show preview and chat" : "Focus chat panel"} title={expandedPanel ? "Show preview and chat" : "Focus chat panel"} aria-expanded={expandedPanel} className="btn btn-ghost btn-sm ml-auto">{expandedPanel ? "↓" : "↑"}</button>
              {termBusy && <button onClick={() => terminalAbort.current?.abort()} className="btn btn-ghost btn-sm">Cancel command</button>}
              {busy && <span className="ml-auto flex items-center gap-2 text-signal-soft whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-signal pulse-dot" />{busy} working…<button onClick={() => abortRef.current?.abort()} className="text-ash hover:text-paper">stop</button></span>}
            </div>

            {bottom === "chat" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div onScroll={(e) => { const el = e.currentTarget; followChat.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="flex-1 min-h-0 overflow-y-auto px-5 py-6 space-y-6 text-sm leading-7">
                  {(() => { try { const warnings = JSON.parse(p.project.memory || "{}").importWarnings; return Array.isArray(warnings) && warnings.length ? <details className="text-xs text-ash border border-graphite rounded-lg p-3"><summary className="cursor-pointer">Import notes ({warnings.length})</summary>{warnings.map((w: string, i: number) => <p key={i} className="mt-2">{w}</p>)}</details> : null; } catch { return null; } })()}
                  {messages.length === 0 && !stream && <div className="text-ash text-xs">{isApp ? "Describe the app. Example: “Build a CRM dashboard with sidebar, KPI cards, revenue chart and a deals table.”" : "Describe what you want. Example: “Build a dark SaaS landing page for an AI CRM with pricing and FAQ.”"}</div>}
                  {messages.map((m) => (
                    <div key={m.id} className={`w-fit max-w-[90%] rounded-2xl px-5 py-3 ${m.role === "user" ? "ml-auto bg-graphite rounded-br-sm" : "border border-graphite rounded-bl-sm text-fog"}`}>
                      {m.role !== "user" && (() => { const a = allAgents.find((x) => x.id === m.agentId); return <div className="font-mono text-[10px] text-signal-soft mb-1">{a?.name ?? m.agentId ?? "IDÆVIA"}{a?.profession ? <span className="text-ash"> · {a.profession}</span> : null}{m.creditsUsed ? ` · ${m.creditsUsed} cr` : ""}</div>; })()}
                      {m.role === "user" && selectedComponents(m.content).length > 0 && <div className="flex flex-wrap gap-2 mb-2">{selectedComponents(m.content).map(id => <span key={id} className="rounded-full border border-signal/40 px-2 py-0.5 text-xs text-signal-soft">{SELECTABLE_COMPONENTS.find(c => c.id === id)?.name}</span>)}</div>}
                      <div className="whitespace-pre-wrap break-words">{m.role === "user" ? m.content.replace(/\s*\[COMPONENT:[a-z0-9-]+\]/g, "") : m.content}</div>
                    </div>
                  ))}
                  {pendingStackRequest && <StackSuggestions request={pendingStackRequest} kind={p.project.kind} disabled={!!busy} onChoose={choice => { void run(choice); }} onCustom={() => promptInput.current?.focus()} />}
                  {qualityChoices && !busy && <QualitySuggestions choices={qualityChoices} disabled={!!busy} onChoose={id => { void run(`QUALITY CHOICE: ${id}`); }} />}
                  {savedBrief && !busy && !isApp && !html.trim() && <section aria-label="Saved brief" className="rounded-2xl border border-signal/40 bg-signal/10 p-4 text-sm text-fog">
                    <p>Your brief, technology and quality mode are saved, but the first build did not finish. Start it again with one click; nothing was charged for the unfinished run.</p>
                    <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => { void run(savedBrief, "builder"); }}>Build the project now</button>
                  </section>}
                  {buildContinuation && !busy && <section aria-label="Build saved in parts" className="rounded-2xl border border-signal/40 bg-signal/10 p-4 text-sm text-fog">
                    <p>The generation time limit split this build into parts. {buildContinuation.filesDone} file{buildContinuation.filesDone === 1 ? "" : "s"} are saved; the remaining files are written in part {buildContinuation.round}.</p>
                    <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => { void run("CONTINUE BUILD", "builder"); }}>Continue the build (part {buildContinuation.round})</button>
                  </section>}
                  {busy && activity.length > 0 && <div className="rounded-2xl border border-graphite p-4 text-fog">
                    <div role="status" className="mb-3 flex items-center gap-2 text-sm text-signal-soft"><span className={`w-2 h-2 rounded-full ${busy ? "bg-signal pulse-dot" : "bg-signal-soft"}`} />{busy ? `${allAgents.find((x) => x.id === busy)?.name ?? busy} is working` : "Agent activity"}{busy && <span className="ml-auto font-mono text-xs text-ash" aria-label="Elapsed time">{`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`}</span>}</div>
                    <div className="divide-y divide-graphite/60">
                      {activity.map((item) => <div key={item.id} className="flex items-center gap-3 py-2 text-xs"><span className={`shrink-0 text-sm ${item.status === "done" ? "text-signal-soft" : "text-ash"}`}>{item.status === "done" ? "✓" : "◌"}</span><span className="min-w-0 flex-1 truncate text-fog">{item.label}</span><span className="max-w-[52%] truncate text-ash">{item.detail}</span></div>)}
                    </div>
                    {busy && <p className="mt-3 text-xs text-ash">The agent summary appears here when finished. Technical commands and build logs are available in Terminal.</p>}
                  </div>}
                  {busy && stream && (responseMode === "report" || stream.startsWith("<<<ANSWER>>>")) && <div className="rounded-2xl border border-graphite px-5 py-3 whitespace-pre-wrap break-words text-fog" aria-live="polite">{stream.replace(/^<<<ANSWER>>>\s*/, "").replace(/<<<END_ANSWER>>>\s*$/, "")}</div>}
                  {error && <div className="text-error text-xs">{error}</div>}
                  <div ref={chatEnd} />
                </div>
                {images.length > 0 && (
                  <div className="px-2 pt-2 flex gap-2 flex-wrap">
                    {images.map((img, i) => <div key={i} className="relative"><img src={`data:${img.mediaType};base64,${img.data}`} alt={img.name} className="h-12 w-16 object-cover rounded border border-graphite" /><button onClick={() => setImages((x) => x.filter((_, k) => k !== i))} className="absolute -top-1 -right-1 bg-void border border-graphite rounded-full p-0.5"><X size={9} /></button></div>)}
                    <span className="text-[10px] text-ash self-end">{images.length} reference image(s) → Builder (vision)</span>
                  </div>
                )}
                {componentIds.length > 0 && <div className="px-3 pt-3 flex flex-wrap items-center gap-2" aria-label="Selected components">
                  {componentIds.map(id => <span key={id} className="inline-flex items-center gap-2 rounded-full border border-signal/40 bg-signal/10 px-3 py-1 text-xs text-signal-soft" data-selected-component={id}>{SELECTABLE_COMPONENTS.find(c => c.id === id)?.name}<button type="button" disabled={!!busy} aria-label={`Remove ${SELECTABLE_COMPONENTS.find(c => c.id === id)?.name}`} onClick={() => setComponentIds(ids => ids.filter(x => x !== id))}><X size={12} /></button></span>)}
                  <details className="w-full text-xs text-ash"><summary className="cursor-pointer">Implementation prompt · {p.project.name}</summary><p className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap">{componentImplementationPrompt(input, componentIds)}</p></details>
                </div>}
                <form onSubmit={(e) => { e.preventDefault(); const r = input; if (!busyRef.current && (r.trim() || componentIds.length)) { setInput(""); run(r); } }} className="workspace-composer shrink-0 p-3 border-t border-graphite grid grid-cols-[1fr_auto_auto] gap-2 items-end">
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
                  <textarea ref={promptInput} aria-label="Project prompt" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); const r = input; if (!busyRef.current && (r.trim() || componentIds.length)) { setInput(""); run(r); } } }} rows={2} className="input col-span-3 min-w-0 resize-none" placeholder={isAuto ? "Ask a question, or describe what to build or change." : agent.mode === "rewrite" ? "Ask a question, or describe what to build or change?" : `Ask ${agent.name} for a report…`} />
                  <span className="text-[11px] text-ash self-center">Enter to send · Shift + Enter for a new line</span>
                  <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => { attachImages(e.target.files); e.target.value = ""; }} />
                  <div className="flex items-center gap-2">
                  <button type="button" disabled={!!busy} onClick={() => setComponentsOpen(true)} className="btn btn-outline"><Code2 size={14} />Add components</button>
                  <button type="button" onClick={() => (p.visionAllowed ? fileInput.current?.click() : setError("Screenshot → website (vision) is available from the Starter plan."))} title="Attach reference images (screenshot → website)" className={`btn btn-outline ${p.visionAllowed ? "" : "opacity-60"}`}><ImageIcon size={14} />{!p.visionAllowed && <Lock size={10} />}</button>
                  </div>
                  <button disabled={!!busy || (!input.trim() && !componentIds.length)} className="btn btn-primary"><Play size={14} />Run</button>
                </form>
                <dialog ref={componentsDialog} aria-label="Add components to project" onClose={() => setComponentsOpen(false)} className="m-auto w-[calc(100%-2rem)] max-w-5xl max-h-[85vh] rounded-2xl border border-graphite bg-void text-paper p-0 backdrop:bg-black/75">
                  <div className="sticky top-0 z-10 bg-void border-b border-graphite px-5 py-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Add components</h2><p className="text-xs text-ash mt-1">{p.project.name} · {componentIds.length}/{MAX_COMPONENT_SELECTION} selected · review and send from chat</p></div><button type="button" className="btn btn-primary btn-sm" onClick={() => setComponentsOpen(false)}>Done</button></div>
                  {componentsOpen && <ComponentCatalog selected={componentIds} onToggle={id => setComponentIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : ids.length < MAX_COMPONENT_SELECTION ? [...ids, id] : ids)} />}
                </dialog>
              </div>
            )}

            {bottom === "changes" && (
              <div className="flex-1 overflow-y-auto p-3 text-xs space-y-4">
                {busy && <div className="rounded-lg border border-signal/30 bg-signal/5 px-3 py-2 text-signal-soft"><span className="inline-block mr-2 w-1.5 h-1.5 rounded-full bg-signal pulse-dot" />Live changes are being prepared while the agent works.</div>}
                {diffs.length > 0 && <div className="space-y-3">
                  <div className="flex items-center justify-between"><div className="font-medium text-fog">Live code changes</div><div className="flex gap-3 font-mono text-[10px]"><span className="text-error">− {diffs.reduce((n, file) => n + file.removed, 0)}</span><span className="text-success">+ {diffs.reduce((n, file) => n + file.added, 0)}</span></div></div>
                  {diffs.map((file) => <div key={file.path} className="overflow-hidden rounded-lg border border-graphite bg-void">
                    <div className="flex items-center justify-between border-b border-graphite px-3 py-2 font-mono text-[11px] text-fog"><span className="flex items-center gap-2"><FileCode2 size={12} className="text-signal-soft" />{file.path}</span><span><span className="text-error">−{file.removed}</span> <span className="text-success">+{file.added}</span></span></div>
                    <pre className="max-h-72 overflow-auto py-1 font-mono text-[10px] leading-5">{file.lines.map((line, i) => <div key={`${file.path}-${i}`} className={`whitespace-pre-wrap px-3 ${line.kind === "remove" ? "bg-error/10 text-error" : line.kind === "add" ? "bg-success/10 text-success" : "text-ash"}`}><span className="mr-2 inline-block w-3 select-none text-right opacity-70">{line.kind === "remove" ? "−" : line.kind === "add" ? "+" : " "}</span>{line.text || " "}</div>)}</pre>
                  </div>)}
                </div>}
                {runs.length === 0 && diffs.length === 0 && <div className="text-ash">No agent runs yet.</div>}
                <table className="w-full"><tbody>{runs.map((r) => (
                  <tr key={r.id} className="border-b border-graphite/60"><td className="py-1.5 pr-3 font-mono text-signal-soft">{r.agentId}</td><td className="py-1.5 pr-3 text-fog truncate max-w-[380px]">{r.task}</td><td className="py-1.5 pr-3 text-ash">{r.output?.match(/^v\d+$/) ? "Change saved" : r.status}</td><td className="py-1.5 pr-3 text-ash">{r.creditsUsed} cr</td><td className="py-1.5 text-ash">{new Date(r.startedAt).toLocaleTimeString()}</td></tr>
                ))}</tbody></table>
              </div>
            )}

            {(shellOpened || bottom === "terminal") && <div hidden={bottom !== "terminal"} className={bottom === "terminal" ? "flex-1 min-h-0 flex flex-col" : "hidden"}>
              {shellOpened && <ShellTerminal onLog={(text) => log(text)} onIssue={setRuntimeIssue} projectId={p.project.id} active={bottom === "terminal"} command={shellCommand} onConsumed={(id) => setShellCommand((current) => current?.id === id ? null : current)} onPreview={(url, blocked) => { setRuntimePreview({ url, source: runtimeSource, blocked: blocked ?? null }); setView("preview"); setExpandedPanel(false); }} />}
              <details open={termBusy || termLines.length > 2} className="shrink-0 border-t border-graphite text-xs">
                <summary className="cursor-pointer px-3 py-2 text-ash">Platform actions · publish, connected GitHub push, deploy</summary>
                <div className="max-h-32 overflow-y-auto px-3 font-mono whitespace-pre-wrap">{termLines.map((line, i) => <div key={i}>{line}</div>)}<div ref={terminalEnd} /></div>
                <form onSubmit={(e) => { e.preventDefault(); const c = termInput; setTermInput(""); term(`platform: ${c}`); }} className="flex gap-2 px-3 py-2"><input aria-label="Platform action" value={termInput} disabled={termBusy} onChange={(e) => setTermInput(e.target.value)} className="input flex-1" placeholder="publish · deploy vercel · integrations" /><button className="btn btn-outline btn-sm" disabled={termBusy}>Run</button></form>
              </details>
            </div>}

            {bottom === "logs" && <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5"><RuntimeDetails profile={runtime} deployment={deployment} />{isApp && !deployment.supported && <div className="flex gap-2 py-3"><button className="btn btn-outline btn-sm" onClick={exportZip}>Download project</button><button className="btn btn-outline btn-sm" disabled={termBusy} onClick={() => term("platform: git push")}>Push to connected GitHub</button></div>}{buildReport && <details open className="mb-4 border-b border-graphite pb-3"><summary>Last build · {buildReport.label} · {buildReport.status}{!buildReport.current && " · earlier saved source"}</summary><pre className="whitespace-pre-wrap mt-2 text-fog">{buildReport.log}</pre></details>}{logs.map((l, i) => <div key={i} className={l.kind === "err" ? "text-error" : l.kind === "ok" ? "text-success" : "text-fog"}><span className="text-ash">{l.t}</span> {l.text}</div>)}</div>}

            {bottom === "problems" && (
              <div className="flex-1 overflow-y-auto p-3 text-xs">
                {(runtimeIssue || buildReport?.status === "error") && <div className="border border-error/30 rounded-lg p-3 mb-4 space-y-2"><p className="text-error">{runtimeIssue ?? `Last ${buildReport?.label} build failed${buildReport?.origin === "platform" ? " because of the platform build environment, not your code (reported to the platform team)" : buildReport?.origin === "project" ? " in the project's code or configuration" : ""}${!buildReport?.current ? " (earlier source — rebuild to recheck)" : ""}.`}</p><button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => { repairRounds.current = 0; autoRebuild.current = true; void run(`Fix the compilation/startup failure from the last build of this ${runtime.label} project. Preserve the requested stack and design.${buildReport?.current ? "" : " The saved build output is from earlier source; read the project and rebuild after your changes."}`, isAllowed("debugger") ? "debugger" : "builder"); }}>Fix runtime error with Debugger</button><button className="btn btn-ghost btn-sm" disabled={termBusy} onClick={() => term("npm run build")}>Rebuild to verify</button><button className="btn btn-ghost btn-sm" onClick={() => setBottom("logs")}>View build log</button></div>}
                {!audit ? <div className="text-ash">Run source checks and Build to inspect this project’s code and runtime. <button onClick={runAudit} className="text-signal-soft underline">Run now</button></div> : (
                  <>
                    {audit.scope !== "source" && <div className="grid grid-cols-7 gap-2 mb-3">{([["Overall", audit.overall], ["Performance", audit.performance], ["SEO", audit.seo], ["A11y", audit.accessibility], ["Security", audit.security], ["Code", audit.codeQuality], ["Mobile", audit.mobile]] as const).map(([l, v]) => <div key={l} className="card p-2"><div className="text-[10px] text-ash">{l}</div><div className={`text-lg font-semibold ${v >= 90 ? "text-success" : v >= 70 ? "text-warning" : "text-error"}`}>{v}</div></div>)}</div>}
                    {audit.scope === "source" && <p className="text-ash mb-3">Source checks only. Run Build and Preview to check compilation and runtime behavior. SEO and performance require the rendered pages.</p>}
                    {audit.issues.length === 0 ? <div className="text-success">No findings in these checks. Build and runtime validation are still required.</div> : (
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
          </div>}
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
