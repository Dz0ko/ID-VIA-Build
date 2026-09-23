export type ProjectStack =
  | "html-css-js"
  | "react-ts"
  | "next-ts"
  | "vue-ts"
  | "svelte-ts"
  | "node-ts"
  | "python-fastapi"
  | "python-django"
  | "java-spring"
  | "kotlin"
  | "go"
  | "rust"
  | "php-laravel"
  | "dotnet"
  | "ruby-rails"
  | "swift";

export type StackChoice = { id: ProjectStack; label: string; description: string };

export const STACK_CHOICES: StackChoice[] = [
  { id: "html-css-js", label: "HTML + CSS + JavaScript", description: "Fast websites and landing pages" },
  { id: "react-ts", label: "React + TypeScript", description: "Interactive web apps and dashboards" },
  { id: "next-ts", label: "Next.js + TypeScript", description: "Full-stack web products with routes and server features" },
  { id: "vue-ts", label: "Vue + TypeScript", description: "Interactive websites and web applications" },
  { id: "svelte-ts", label: "Svelte + TypeScript", description: "Lightweight interactive web applications" },
  { id: "node-ts", label: "Node.js + TypeScript", description: "APIs, realtime services and backend products" },
  { id: "python-fastapi", label: "Python + FastAPI", description: "APIs, AI services and data products" },
  { id: "python-django", label: "Python + Django", description: "Database-heavy web platforms and admin systems" },
  { id: "java-spring", label: "Java + Spring Boot", description: "Enterprise APIs and large business systems" },
  { id: "kotlin", label: "Kotlin", description: "Android and JVM applications" },
  { id: "go", label: "Go", description: "Fast APIs, services and infrastructure" },
  { id: "rust", label: "Rust", description: "High-performance services and desktop tooling" },
  { id: "php-laravel", label: "PHP + Laravel", description: "Server-rendered business websites and platforms" },
  { id: "dotnet", label: ".NET + C#", description: "Microsoft ecosystem APIs and enterprise apps" },
  { id: "ruby-rails", label: "Ruby on Rails", description: "Product MVPs and database-backed web apps" },
  { id: "swift", label: "Swift", description: "Apple platform applications" },
];

const DETECTORS: Array<[RegExp, ProjectStack]> = [
  [/\b(next\.?js|nextjs)\b/i, "next-ts"],
  [/\b(react|tsx)\b/i, "react-ts"],
  [/\b(vue)\b/i, "vue-ts"],
  [/\b(svelte)\b/i, "svelte-ts"],
  [/\b(node\.?js|express|nestjs|nest\.?js)\b/i, "node-ts"],
  [/\b(fastapi)\b/i, "python-fastapi"],
  [/\b(django)\b/i, "python-django"],
  [/\b(python)\b/i, "python-fastapi"],
  [/\b(java|spring\s*boot)\b/i, "java-spring"],
  [/\b(kotlin|android)\b/i, "kotlin"],
  [/\b(golang|go language|go backend|go api)\b|\b(?:in|using|with) Go\b|^Go$/i, "go"],
  [/\b(rust|cargo)\b/i, "rust"],
  [/\b(php|laravel)\b/i, "php-laravel"],
  [/(?<!\w)(c#|csharp|\.net|dotnet|asp\.?net)(?!\w)/i, "dotnet"],
  [/\b(ruby|rails)\b/i, "ruby-rails"],
  [/\b(swift|ios|swiftui)\b/i, "swift"],
  [/\b(html|css|vanilla\s*js|javascript)\b/i, "html-css-js"],
];

export function detectProjectStack(text: string): ProjectStack | null {
  for (const [pattern, stack] of DETECTORS) if (pattern.test(text)) return stack;
  return null;
}

/** Explicit answers take precedence and are open-ended, including mixed stacks. */
export function requestedStackName(text: string): string | null {
  const marker = text.match(/(?:STACK CHOICE|TECH STACK|LANGUAGE):\s*([^\n]+)/i)?.[1]?.trim();
  if (marker) return marker;
  const matches = DETECTORS.filter(([pattern]) => pattern.test(text));
  const labels = matches
    .filter(([, stack]) => !(stack === "react-ts" && matches.some(([, id]) => id === "next-ts")))
    .filter(([, stack]) => !(stack === "python-fastapi" && matches.some(([, id]) => id === "python-django") && !/fastapi/i.test(text)))
    .map(([, stack]) => STACK_CHOICES.find((choice) => choice.id === stack)!.label);
  const others = text.match(/(?<!\w)(C\+\+|Scala|Elixir|Haskell|Perl|Lua|Dart|Flutter|MATLAB|Bash|Shell|Assembly|Clojure|Erlang|Julia|Zig|Nim|Fortran|COBOL|OCaml|Racket|Solidity)(?!\w)/gi) ?? [];
  const databases = text.match(/\b(PostgreSQL|Postgres|MySQL|SQLite|MongoDB|Redis|Supabase|Firebase)\b/gi) ?? [];
  // A database by itself is not a complete implementation stack.
  if (!labels.length && !others.length) return null;
  return [...new Set([...labels, ...others, ...databases])].join(" + ");
}

export function isStaticStack(stack: string): boolean {
  return /^(?:javascript|vanilla js|html-css-js|html(?:\s*\+\s*css)?(?:\s*\+\s*(?:javascript|js))?)$/i.test(stack.trim());
}

export function isReactSandboxStack(stack: string): boolean {
  return /^(?:react-ts|react(?:\s*\+\s*(?:typescript|javascript))?)$/i.test(stack.trim());
}

/** Used by both billing access checks and generation so their decisions agree. */
export function resolveRequestedStack(request: string, kind: string): string | null {
  const answer = request.match(/STACK CHOICE:\s*([^\n]+)/i)?.[1]?.trim();
  if (answer && /^(?:(?:use|choose|pick)\s+)?(?:the\s+)?(?:recommended(?: stack| option)?|recommendation|auto|best|you choose)[.!]?$/i.test(answer)) {
    return recommendedProjectStack(request.split(/STACK CHOICE:/i)[0], kind).label;
  }
  return requestedStackName(request);
}

export function recommendedProjectStack(request: string, kind: string): StackChoice {
  const p = request.toLowerCase();
  if (/\b(ios|iphone|ipad|apple app)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "swift")!;
  if (/\b(android|mobile app|mobile application)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "kotlin")!;
  if (/\b(saas|platform|marketplace|crm|portal|full.stack|subscription)\b/.test(p)) return { ...STACK_CHOICES.find((x) => x.id === "next-ts")!, label: "Next.js + TypeScript + PostgreSQL", description: "A full-stack web application with server routes, authentication and persistent data" };
  if (/\b(ai|machine learning|data pipeline|data product)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "python-fastapi")!;
  if (/\b(api|backend|microservice|realtime|websocket)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "node-ts")!;
  if (/\b(enterprise|erp|bank|large business|corporate)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "java-spring")!;
  if (kind === "app" || /\b(app|dashboard|saas|platform|marketplace|crm|portal)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "react-ts")!;
  return STACK_CHOICES.find((x) => x.id === "html-css-js")!;
}

export function stackQuestion(request: string, kind: string) {
  const recommendation = recommendedProjectStack(request, kind);
  return `Before I build this, which stack should I use? I recommend ${recommendation.label} — ${recommendation.description}. Choose the recommended stack below, browse the other options, or type your own language/framework combination. Source generation accepts custom stacks; live preview and deployment depend on the available runtime.`;
}
