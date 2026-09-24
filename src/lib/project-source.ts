import { isReactSandboxStack } from "./project-stack";
import type { RuntimeFile } from "./runtime-profile";
export function legacyReactSource(files: RuntimeFile[], stack = "react-ts") {
  const names = files.map(f => f.path.replace(/^\/+/, ""));
  return isReactSandboxStack(stack) && !names.some(p => /(?:^|\/)(?:package.json|pom.xml|go.mod|Cargo.toml|composer.json|manage.py|pyproject.toml|requirements.txt|Gemfile|runtime.json)$/.test(p)) && names.some(p => p === "App.tsx" || p === "App.jsx");
}
/** Monaco falls back to plain text for unregistered languages, never misleading TypeScript diagnostics. */
export function editorLanguage(path: string) {
  const name = path.split("/").pop() ?? "", ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (/^Dockerfile(?:\.|$)/i.test(name)) return "dockerfile";
  if (/^(?:Makefile|Gemfile|Procfile)$/.test(name)) return name === "Gemfile" ? "ruby" : "plaintext";
  const map: Record<string, string> = { ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", json: "json", css: "css", scss: "scss", less: "less", html: "html", htm: "html", vue: "html", svelte: "html", py: "python", java: "java", kt: "kotlin", kts: "kotlin", go: "go", rs: "rust", php: "php", rb: "ruby", cs: "csharp", fs: "fsharp", vb: "vb", csproj: "xml", fsproj: "xml", swift: "swift", dart: "dart", c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", sh: "shell", bash: "shell", ps1: "powershell", sql: "sql", xml: "xml", svg: "xml", yaml: "yaml", yml: "yaml", md: "markdown", lua: "lua", pl: "perl", r: "r", scala: "scala", clj: "clojure", ex: "elixir", exs: "elixir", graphql: "graphql", gql: "graphql", ini: "ini", toml: "ini" };
  return map[ext] ?? "plaintext";
}

/** Shared by import, generation and the file editor, including framework route names. */
export function safeProjectPath(path: string): string | null {
  const parts = path.replace(/\\/g, "/").split("/").filter(part => part && part !== ".");
  if (parts.some(part => part === ".." || !/^[\w\-.+@()[\]]+$/.test(part))) return null;
  const result = "/" + parts.join("/");
  return result.length > 1 && result.length <= 200 ? result : null;
}
