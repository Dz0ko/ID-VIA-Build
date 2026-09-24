import type { ModelConfig } from "../settings";
import { applyExactEdits } from "./html-edits";
import { estimateUsd } from "./cost";
import { safeProjectPath } from "../project-source";
import { BINARY_PREFIX } from "../file-content";
import { auditProject } from "../audit";
import type { ToolInput, ToolResult, ToolSpec, ToolTurn } from "./provider";

/**
 * An agentic edit: the model works inside the project with tools, the way an engineer works at a
 * terminal: search, read the exact source, edit with verification, check, finish. Every tool result
 * goes back to the model, so a wrong guess is corrected in the next step instead of failing the run.
 */
export const EDIT_TOOLS: ToolSpec[] = [
  { name: "list_files", description: "List every file in the project with its size. Call this first when you do not know the layout.", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { name: "search", description: "Find every place a text occurs across the project (case-insensitive literal by default). Returns path:line: text for up to 80 matches plus per-file counts. Use it before editing so nothing is missed.", parameters: { type: "object", properties: { query: { type: "string", description: "Text or, with regex true, a JavaScript regular expression" }, regex: { type: "boolean" }, path_prefix: { type: "string", description: "Only search paths starting with this prefix, e.g. /src/views" } }, required: ["query"], additionalProperties: false } },
  { name: "read_file", description: "Read a file's exact current content (up to 60k characters; use start_line/end_line for larger files). Always read before editing.", parameters: { type: "object", properties: { path: { type: "string" }, start_line: { type: "integer", minimum: 1 }, end_line: { type: "integer", minimum: 1 } }, required: ["path"], additionalProperties: false } },
  { name: "edit_file", description: "Replace exact text in a file. `search` must be copied verbatim from the current content and match once; set `all` true to replace every occurrence (renames, brand or name changes). Returns the number of replacements or an error you must fix.", parameters: { type: "object", properties: { path: { type: "string" }, search: { type: "string" }, replace: { type: "string" }, all: { type: "boolean" } }, required: ["path", "search", "replace"], additionalProperties: false } },
  { name: "write_file", description: "Create a new file, or replace a whole file with complete content. Prefer edit_file for changes inside an existing file.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"], additionalProperties: false } },
  { name: "delete_file", description: "Delete a file. Allowed only when the user explicitly asked for that file to be removed.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false } },
  { name: "check_project", description: "Run the platform's static checks on the current state of the project and get the findings.", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { name: "finish", description: "End the work. With changes made: give a short first-person note of what changed and why (no code). Without changes: give `answer` for a question or a focused clarification when the request is genuinely ambiguous.", parameters: { type: "object", properties: { note: { type: "string" }, answer: { type: "string" } }, additionalProperties: false } },
];

export const EDIT_AGENT_SYSTEM = `WORKING METHOD (tools): You are working inside the user's project with tools, like an engineer at a terminal.
1. Find every place the request touches: search (and list_files when the layout is unknown). A rename, a brand change or a wording change usually occurs in several files; handle all of them.
2. Read the exact current source of a file before editing it.
3. Change it with edit_file: copy \`search\` verbatim from what you read; use \`all\` true when every occurrence must change. Use write_file only for new files or a complete rewrite of a small file. Keep every unrelated line, style, content and feature exactly as it is.
4. When the edits are done, call check_project and fix any new finding, then call finish with a short first-person note of what changed.
If the request is a question, or genuinely ambiguous, call finish with \`answer\` instead of guessing. Never claim that tests, builds or deployments ran: you have not executed them. Do not stop after a failed tool call: read the error, correct the input and try again.`;

export type EditAgentEvent = { type: "tool"; name: string; detail: string };
export interface EditAgentOptions {
  /** One model turn; the caller handles provider fallback and outage reporting. */
  call: (input: ToolInput) => Promise<ToolResult>;
  system: string;
  /** The first user turn: project index, memory, recent conversation and the request. */
  task: string;
  files: { path: string; content: string }[];
  kind: "app" | "website";
  request: string;
  effort?: ModelConfig["effort"];
  signal?: AbortSignal;
  /** Absolute time after which no new model turn starts. */
  deadline: number;
  maxSteps?: number;
  onEvent?: (event: EditAgentEvent) => void;
}
export interface EditAgentResult {
  files: { path: string; content: string }[];
  changed: string[];
  note: string | null;
  answer: string | null;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string | null;
  outOfTime: boolean;
}

const MAX_TOOL_OUTPUT = 60_000;
const TRANSCRIPT_LIMIT = 400_000;
/** No new turn starts with less than this left; a turn needs time to think and answer. */
const TURN_RESERVE_MS = 45_000;
const line = (text: string) => (text.length > 200 ? `${text.slice(0, 197)}…` : text);

export async function runEditAgent(opts: EditAgentOptions): Promise<EditAgentResult> {
  const workspace = new Map(opts.files.map((f) => [f.path, f.content]));
  const original = new Map(workspace);
  const changed = new Set<string>();
  const deletable = new Set(opts.files.filter((f) => /\b(?:delete|remove)\b[\s\S]*\bfiles?\b/i.test(opts.request) && opts.request.includes(f.path.slice(1))).map((f) => f.path));
  const snapshot = () => Array.from(workspace, ([path, content]) => ({ path, content }));
  const audit = () => auditProject({ kind: opts.kind, html: opts.kind === "website" ? workspace.get("/index.html") ?? "" : "", files: opts.kind === "app" ? snapshot() : [] });
  const baseline = audit().issues.length;
  let checkedAfterEdits = false;
  const turns: ToolTurn[] = [{ role: "user", content: opts.task }];
  let steps = 0, inputTokens = 0, outputTokens = 0, costUsd = 0, model: string | null = null, outOfTime = false;
  let note: string | null = null, answer: string | null = null, finished = false, lastText = "";

  const resolvePath = (raw: unknown) => {
    const path = typeof raw === "string" ? safeProjectPath(raw) : null;
    if (!path) throw new Error(`Invalid project path ${JSON.stringify(raw)}. Paths start with / and stay inside the project.`);
    return path;
  };
  const run = (name: string, input: Record<string, unknown>): string => {
    switch (name) {
      case "list_files":
        return Array.from(workspace, ([path, content]) => `${path} (${content.startsWith(BINARY_PREFIX) ? "binary asset" : `${content.length} chars`})`).slice(0, 400).join("\n") || "(no files)";
      case "search": {
        if (typeof input.query !== "string" || !input.query.length) throw new Error("query must be a non-empty string.");
        let pattern: RegExp;
        try { pattern = input.regex === true ? new RegExp(input.query, "gi") : new RegExp(input.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); } catch (cause) { throw new Error(`Invalid regular expression: ${cause instanceof Error ? cause.message : cause}`); }
        const prefix = typeof input.path_prefix === "string" ? input.path_prefix : "";
        const hits: string[] = []; const counts: string[] = []; let total = 0;
        for (const [path, content] of workspace) {
          if (!path.startsWith(prefix) || content.startsWith(BINARY_PREFIX)) continue;
          const lines = content.split("\n"); let inFile = 0;
          // Occurrences, not lines: a rename must know how many times the text appears in each file.
          lines.forEach((text, i) => { const found = text.match(pattern)?.length ?? 0; if (found) { inFile += found; total += found; if (hits.length < 80) hits.push(`${path}:${i + 1}: ${line(text.trim())}`); } });
          if (inFile) counts.push(`${path}: ${inFile}`);
        }
        opts.onEvent?.({ type: "tool", name, detail: `Searching “${line(input.query)}” · ${total} match${total === 1 ? "" : "es"} in ${counts.length} file${counts.length === 1 ? "" : "s"}` });
        return total ? `${total} matches in ${counts.length} files.\n${hits.join("\n")}${total > hits.length ? `\n… ${total - hits.length} more.` : ""}\n\nPer file:\n${counts.join("\n")}` : "No matches.";
      }
      case "read_file": {
        const path = resolvePath(input.path);
        const content = workspace.get(path);
        if (content === undefined) throw new Error(`${path} does not exist. Use list_files or search to find the right path.`);
        if (content.startsWith(BINARY_PREFIX)) return `${path} is a binary asset; reference its path, do not edit its bytes.`;
        const lines = content.split("\n");
        const start = typeof input.start_line === "number" ? Math.max(1, Math.floor(input.start_line)) : 1;
        const end = typeof input.end_line === "number" ? Math.min(lines.length, Math.floor(input.end_line)) : lines.length;
        let slice = lines.slice(start - 1, end).join("\n");
        let truncated = false;
        if (slice.length > MAX_TOOL_OUTPUT) { slice = slice.slice(0, MAX_TOOL_OUTPUT); truncated = true; }
        opts.onEvent?.({ type: "tool", name, detail: `Reading ${path}${start > 1 || end < lines.length ? ` (lines ${start}-${end})` : ""}` });
        return `${path} · lines ${start}-${end} of ${lines.length}${truncated ? " (cut at 60k characters; read the rest by line range)" : ""}\n${slice}`;
      }
      case "edit_file": {
        const path = resolvePath(input.path);
        const content = workspace.get(path);
        if (content === undefined) throw new Error(`${path} does not exist; use write_file to create a new file.`);
        if (content.startsWith(BINARY_PREFIX)) throw new Error(`${path} is a binary asset and cannot be edited as text.`);
        if (typeof input.search !== "string" || typeof input.replace !== "string") throw new Error("search and replace must be strings.");
        const updated = applyExactEdits([{ search: input.search, replace: input.replace, all: input.all === true }], content);
        let count = 0; for (let at = content.indexOf(input.search); at !== -1; at = content.indexOf(input.search, at + input.search.length)) count++;
        const replacements = input.all === true ? count : 1;
        workspace.set(path, updated);
        if (updated === original.get(path)) changed.delete(path); else changed.add(path);
        opts.onEvent?.({ type: "tool", name, detail: `Editing ${path} · ${replacements} replacement${replacements === 1 ? "" : "s"}` });
        return `ok: ${replacements} replacement${replacements === 1 ? "" : "s"} in ${path}.`;
      }
      case "write_file": {
        const path = resolvePath(input.path);
        if (typeof input.content !== "string" || !input.content.trim()) throw new Error("content must be a non-empty string.");
        if (input.content.startsWith(BINARY_PREFIX)) throw new Error("Binary assets cannot be written as text.");
        if (opts.kind === "website" && path !== "/index.html") throw new Error("This project is a single HTML document: edit /index.html; other files are not served.");
        if (workspace.get(path)?.startsWith(BINARY_PREFIX)) throw new Error(`${path} is a binary asset and cannot be replaced with text.`);
        if (workspace.size >= 500 && !workspace.has(path)) throw new Error("The project already has the maximum number of files.");
        const existed = workspace.has(path);
        workspace.set(path, input.content);
        if (input.content === original.get(path)) changed.delete(path); else changed.add(path);
        opts.onEvent?.({ type: "tool", name, detail: `${existed ? "Rewriting" : "Creating"} ${path} · ${input.content.length} chars` });
        return `ok: ${existed ? "replaced" : "created"} ${path}.`;
      }
      case "delete_file": {
        const path = resolvePath(input.path);
        if (!workspace.has(path)) throw new Error(`${path} does not exist.`);
        if (!deletable.has(path)) throw new Error(`Deleting ${path} is not authorized: the user did not ask for this file to be removed. Edit its contents instead.`);
        workspace.delete(path); changed.add(path);
        opts.onEvent?.({ type: "tool", name, detail: `Deleting ${path}` });
        return `ok: deleted ${path}.`;
      }
      case "check_project": {
        const result = audit();
        checkedAfterEdits = true;
        opts.onEvent?.({ type: "tool", name, detail: `Checking the project · ${result.issues.length} finding${result.issues.length === 1 ? "" : "s"}` });
        return result.issues.length ? `${result.issues.length} finding(s):\n${result.issues.map((i) => `- ${i.message}`).join("\n")}` : "No findings in the platform checks. Build, runtime behaviour and visual quality still need real validation.";
      }
      case "finish": {
        const text = typeof input.note === "string" ? input.note.trim() : "";
        const reply = typeof input.answer === "string" ? input.answer.trim() : "";
        if (!changed.size) {
          if (!reply && !text) throw new Error("Nothing was changed. Make the requested change with edit_file or write_file, or give the user an answer in `answer`.");
          answer = reply || text; finished = true;
          return "ok";
        }
        const result = audit();
        if (result.issues.length > baseline && !checkedAfterEdits) {
          checkedAfterEdits = true;
          throw new Error(`Your edits introduced ${result.issues.length - baseline} new finding(s):\n${result.issues.map((i) => `- ${i.message}`).join("\n")}\nFix them (or confirm they are intended) and call finish again.`);
        }
        note = text || reply || null; finished = true;
        return "ok";
      }
      default:
        throw new Error(`Unknown tool ${name}.`);
    }
  };

  const transcriptChars = () => turns.reduce((n, t) => n + (t.role === "tool" ? t.results.reduce((m, r) => m + r.output.length, 0) : t.role === "user" ? t.content.length : t.content.length + JSON.stringify(t.toolCalls).length), 0);
  const trim = () => {
    if (transcriptChars() <= TRANSCRIPT_LIMIT) return;
    for (const turn of turns.slice(0, -4)) if (turn.role === "tool") for (const r of turn.results) if (r.output.length > 2000) r.output = "[earlier output elided to save context; read the file again if needed]";
  };

  const maxSteps = opts.maxSteps ?? 30;
  while (!finished && steps < maxSteps) {
    if (opts.deadline - Date.now() < TURN_RESERVE_MS) { outOfTime = true; break; }
    opts.signal?.throwIfAborted();
    const response = await opts.call({ system: `${opts.system}\n\n${EDIT_AGENT_SYSTEM}`, turns, tools: EDIT_TOOLS, effort: opts.effort, maxOutput: 16000, signal: opts.signal });
    steps++;
    inputTokens += response.inputTokens; outputTokens += response.outputTokens; model = response.model;
    costUsd += response.provider === "mock" ? 0 : estimateUsd(response.model, response);
    turns.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls, raw: response.raw });
    lastText = response.text.trim();
    if (!response.toolCalls.length) {
      // The model ended its turn in prose: with changes made that prose is the note, otherwise it is the answer.
      if (changed.size) note = lastText || null; else answer = lastText || null;
      finished = true;
      break;
    }
    const truncated = ["max_tokens", "length"].includes(response.stopReason ?? "");
    const results: { id: string; name: string; output: string; isError?: boolean }[] = [];
    for (const call of response.toolCalls) {
      if (finished) { results.push({ id: call.id, name: call.name, output: "skipped: the work was already finished.", isError: true }); continue; }
      const input = call.input && typeof call.input === "object" ? call.input as Record<string, unknown> : {};
      try {
        if (truncated) throw new Error("Your tool input was cut off by the output limit. Make smaller changes: several edit_file calls instead of one large write.");
        if ("__invalid_json" in input) throw new Error("The tool arguments were not valid JSON. Send the call again with valid JSON.");
        results.push({ id: call.id, name: call.name, output: run(call.name, input).slice(0, MAX_TOOL_OUTPUT) });
      } catch (cause) {
        results.push({ id: call.id, name: call.name, output: `error: ${cause instanceof Error ? cause.message : String(cause)}`, isError: true });
      }
    }
    turns.push({ role: "tool", results });
    trim();
  }
  if (!finished && changed.size && !note) note = outOfTime ? `I applied the changes to ${[...changed].join(", ")} but ran out of time before finishing everything${lastText ? `; last status: ${line(lastText)}` : ""}. Ask me to continue for the rest.` : `Changes applied to ${[...changed].join(", ")}.`;
  if (!finished && !changed.size && !answer) answer = outOfTime ? "I ran out of time before making the change. Please try again, or narrow the request to the exact part to change." : lastText || null;
  return { files: snapshot(), changed: [...changed], note, answer, steps, inputTokens, outputTokens, costUsd, model, outOfTime };
}
