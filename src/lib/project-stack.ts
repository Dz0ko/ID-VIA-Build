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
  [/\b(golang|\bgo\b)\b/i, "go"],
  [/\b(rust|cargo)\b/i, "rust"],
  [/\b(php|laravel)\b/i, "php-laravel"],
  [/\b(c#|csharp|\.net|dotnet|asp\.?net)\b/i, "dotnet"],
  [/\b(ruby|rails)\b/i, "ruby-rails"],
  [/\b(swift|ios|swiftui)\b/i, "swift"],
  [/\b(html|css|vanilla\s*js|javascript)\b/i, "html-css-js"],
];

export function detectProjectStack(text: string): ProjectStack | null {
  for (const [pattern, stack] of DETECTORS) if (pattern.test(text)) return stack;
  return null;
}

/** Returns a human-readable stack, including languages outside the built-in presets. */
export function requestedStackName(text: string): string | null {
  const detected = detectProjectStack(text);
  if (detected) return STACK_CHOICES.find((choice) => choice.id === detected)?.label ?? detected;
  const marker = text.match(/STACK CHOICE:\s*([^\n]+)/i)?.[1]?.trim();
  if (marker) return marker;
  const other = text.match(/(?<!\w)(C\+\+|Scala|Elixir|Haskell|Perl|Lua|Dart|Flutter|MATLAB|SQL|Bash|Shell|Assembly)(?!\w)/i)?.[1];
  return other ?? null;
}

export function recommendedProjectStack(request: string, kind: string): StackChoice {
  const p = request.toLowerCase();
  if (/\b(android|mobile app|mobile application)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "kotlin")!;
  if (/\b(ios|iphone|ipad|apple app)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "swift")!;
  if (/\b(ai|machine learning|data pipeline|data product)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "python-fastapi")!;
  if (/\b(api|backend|microservice|realtime|websocket)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "node-ts")!;
  if (/\b(enterprise|erp|bank|large business|corporate)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "java-spring")!;
  if (kind === "app" || /\b(app|dashboard|saas|platform|marketplace|crm|portal)\b/.test(p)) return STACK_CHOICES.find((x) => x.id === "react-ts")!;
  return STACK_CHOICES.find((x) => x.id === "html-css-js")!;
}

export function stackQuestion(request: string, kind: string) {
  const recommendation = recommendedProjectStack(request, kind);
  return `Before I build this, which stack should I use? For this project I recommend **${recommendation.label}** — ${recommendation.description}. You can choose another: ${STACK_CHOICES.slice(0, 8).map((x) => x.label).join(", ")}, or tell me any other language/framework you need.`;
}
