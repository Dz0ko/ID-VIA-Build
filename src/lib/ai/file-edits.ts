import { safeProjectPath } from "../project-source";
import { BINARY_PREFIX } from "../file-content";
import { applyExactEdits } from "./html-edits";

export type SourceFile = { path: string; content: string };
export const FILE_EDITS_SYSTEM = `OUTPUT FORMAT OVERRIDE FOR AN EXISTING APPLICATION:
Locate the requested target in the supplied file contents and change ONLY what the latest request asks for. Preserve all unrelated files, code, styles, dependencies, content and working features. For a text change, find the owning page/component/translation file and change that text. For a logo or image, find its existing source/import/reference and change only the asset and necessary references. Never redesign the whole application unless explicitly requested. These scope rules override broader specialist instructions.
Return <<<FILE_EDITS>>> then a JSON array of operations then <<<END FILE_EDITS>>>:
{"op":"edit","path":"/src/Header.tsx","edits":[{"search":"exact unique original source","replace":"replacement source"}]}
{"op":"create","path":"/src/NewComponent.tsx","content":"complete new file content"}
{"op":"delete","path":"/obsolete-file.ts"}
Use edit for existing text files; never replace an existing file with create. Each search must match exactly once in the original file, unless the edit sets "all": true, which replaces every occurrence in that file (use it for renames and brand or name changes, e.g. {"search":"Willow","replace":"Dr Kiko","all":true}). Edits within a file must not overlap. Use one operation per path. Delete is allowed only when the user explicitly requests deleting a file; removing a UI element normally requires editing its component, not deleting files. Do not modify binary files. Unmentioned files are preserved automatically, including binary assets. Never emit KEEP markers or a full file manifest for this mode.
Only edit files whose complete contents are supplied. If needed, request exact project paths using <<<READ_FILES>>>["/src/Header.tsx"]<<<END READ_FILES>>> as the entire response. Up to 3 read rounds are available. Read files before guessing the owning file or an import. New components need their real imports/rendering integrated in the existing app.
JSON-escape newlines/quotes. After edits add <<<NOTE>>> what actually changed <<<END NOTE>>>. If the replacement or target is ambiguous, ask one focused question using <<<ANSWER>>>...<<<END_ANSWER>>> instead of guessing.`;

export function parseReadFiles(text: string): string[] | null {
  const m = text.trim().match(/^<<<READ_FILES>>>\s*([\s\S]*?)\s*<<<END READ_FILES>>>$/);
  if (!m) return null;
  let value: unknown; try { value = JSON.parse(m[1]); } catch { throw new Error("Model did not return valid file-read paths."); }
  if (!Array.isArray(value) || !value.length || value.length > 8 || value.some(p => typeof p !== "string" || !safeProjectPath(p))) throw new Error("Model did not return valid project file-read paths.");
  return [...new Set(value.map(p => safeProjectPath(p)!))];
}

export function applyFileEdits(text: string, existing: SourceFile[], readable: Set<string>, deletable = new Set<string>()): SourceFile[] {
  const m = text.trim().match(/^<<<FILE_EDITS>>>\s*([\s\S]*?)\s*<<<END FILE_EDITS>>>(?:\s*<<<NOTE>>>[\s\S]*?<<<END NOTE>>>)?\s*$/);
  if (!m) throw new Error("Model did not return complete file edits.");
  let operations: unknown; try { operations = JSON.parse(m[1]); } catch { throw new Error("Model did not return valid file edits."); }
  if (!Array.isArray(operations) || !operations.length || operations.length > 80) throw new Error("Model did not return a bounded set of file edits.");
  const files = new Map(existing.map(f => [f.path, f.content]));
  const seen = new Set<string>();
  for (const op of operations) {
    if (!op || typeof op !== "object" || typeof op.path !== "string") throw new Error("Model did not return valid file edit fields.");
    const path = safeProjectPath(op.path);
    if (!path || seen.has(path)) throw new Error("Model did not return unique safe file paths.");
    seen.add(path);
    const original = files.get(path);
    if (op.op === "create") {
      if (original !== undefined || typeof op.content !== "string" || !op.content.trim() || op.content.startsWith(BINARY_PREFIX)) throw new Error("Model did not return a valid new source file.");
      files.set(path, op.content);
    } else {
      if (original === undefined || original.startsWith(BINARY_PREFIX) || !readable.has(path)) throw new Error("Model did not read the file before editing it.");
      if (op.op === "edit") files.set(path, applyExactEdits(op.edits, original));
      else if (op.op === "delete" && deletable.has(path)) files.delete(path);
      else throw new Error("Model did not return an authorized file operation.");
    }
  }
  if (!files.size || files.size > 500 || [...files.values()].filter(c => !c.startsWith(BINARY_PREFIX)).reduce((n,c) => n+c.length,0) > 2_000_000) throw new Error("Model did not return a bounded usable project.");
  return [...files].map(([path,content]) => ({path,content}));
}

/** Show the file index and relevant complete files. The model can request others. */
export function editFileContext(files: SourceFile[], request: string, requested?: string[]) {
  const terms = [...new Set(request.toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) ?? [])].slice(0,80);
  const score = (file: SourceFile) => { const path=file.path.toLowerCase(),content=file.content.toLowerCase(); return terms.reduce((n,t) => n + (path.includes(t) ? 12 : 0) + (content.includes(t) ? 1 : 0), /(?:page|app|layout|header|index)\./i.test(file.path) ? 2 : 0); };
  const candidates = requested ? requested.map(path => { const f=files.find(f=>f.path===path); if(!f || f.content.startsWith(BINARY_PREFIX)) throw new Error("Model did not request an available source file."); return f; }) : files.filter(f=>!f.content.startsWith(BINARY_PREFIX)).map(file=>({file,score:score(file)})).sort((a,b)=>b.score-a.score).map(row=>row.file);
  const selected: SourceFile[]=[]; let size=0;
  for (const file of candidates) {
    if (size+file.content.length>180000) { if(requested)throw new Error("Requested source files exceed the edit context limit. Narrow the request."); continue; }
    selected.push(file);size+=file.content.length;
  }
  return { selected, text: `PROJECT FILE INDEX (only paths, not permission to invent contents):\n${files.map(f=>`${f.path}${f.content.startsWith(BINARY_PREFIX)?" [binary asset]":""}`).join("\n")}\n\nREAD FILE CONTENTS:\n${selected.map(f=>`<<<FILE ${f.path}>>>\n${f.content}\n<<<END>>>`).join("\n")}\n\nLATEST REQUEST:\n${request}` };
}
