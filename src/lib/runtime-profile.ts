export type RuntimeFile = { path: string; content: string };
export type RuntimeProfile = {
  id: string; label: string; build: string; preview: string; previewPort: number | null;
  tools: string[]; root: string; issue?: string; vite?: { configFile?: string; root?: string };
};
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
const fail = (message: string) => `printf '%s\\n' ${quote(message)}; false`;

/** Used by every workspace, build and admin preview. Files take precedence over labels. */
export function runtimeProfile(files: RuntimeFile[], stack = ""): RuntimeProfile {
  const entries = new Map(files.map(f => [f.path.replace(/^\/+/, ""), f.content]));
  const has = (name: string) => entries.has(name);
  const code = [...entries.values()].join("\n");
  const result = (id: string, label: string, build: string, preview: string, tools: string[] = [], previewPort: number | null = 3000, issue?: string): RuntimeProfile => {
    const wrap = (command: string) => tools.length ? `(for tool in ${tools.map(quote).join(" ")}; do command -v "$tool" >/dev/null 2>&1 || { printf 'Required runtime tool is unavailable: %s. Configure setup in .idaevia/runtime.json or use a compatible toolchain.\\n' "$tool"; exit 127; }; done; ${command})` : command;
    return { id, label, build: wrap(build), preview: wrap(preview), tools, previewPort, root: ".", ...(issue ? { issue } : {}) };
  };
  if (has(".idaevia/runtime.json")) {
    try {
      const custom = JSON.parse(entries.get(".idaevia/runtime.json")!);
      for (const key of ["build", "start"]) if (typeof custom[key] !== "string" || !custom[key].trim() || custom[key].length > 6000 || custom[key].includes("\0")) throw Error();
      if (custom.setup !== undefined && (typeof custom.setup !== "string" || custom.setup.length > 6000 || custom.setup.includes("\0"))) throw Error();
      if (custom.port !== undefined && custom.port !== null && (!Number.isInteger(custom.port) || custom.port < 1024 || custom.port > 65535)) throw Error();
      // Dependencies are installed by the platform, as for every other profile, unless the commands do it themselves:
      // a generated runtime.json often says "npm run build" and would otherwise fail with "prisma: not found".
      const installsItself = /\b(?:npm|pnpm|yarn|bun)\s+(?:install|ci|i)\b|\bpip3?\s+install\b|\bcomposer\s+install\b|\bbundle\s+install\b/i.test(`${custom.setup ?? ""}\n${custom.build}\n${custom.start}`);
      const runner = has("pnpm-lock.yaml") ? "corepack pnpm" : has("yarn.lock") ? "corepack yarn" : has("bun.lock") || has("bun.lockb") ? "bun" : "npm";
      const install = installsItself ? "" : [
        has("package.json") ? (runner === "npm" ? "npm install --no-audit --no-fund" : `${runner} install`) : "",
        has("requirements.txt") ? "python3 -m venv .venv && . .venv/bin/activate && pip install -q -r requirements.txt" : "",
        has("composer.json") ? "composer install --no-interaction" : "",
      ].filter(Boolean).map(step => `${step} && `).join("");
      const setup = install + (custom.setup?.trim() ? `(\n${custom.setup}\n) && ` : "");
      // The start command usually runs build output (node dist/server.js); a preview therefore builds first,
      // exactly like the package.json profile does, so "Open preview" never fails on a missing dist.
      return result("custom", typeof custom.label === "string" ? custom.label.slice(0, 80) : "Custom runtime", setup + `(\n${custom.build}\n)`, setup + `(\n${custom.build}\n) && (\n${custom.start}\n)`, has("package.json") ? (runner === "npm" ? ["node", "npm"] : runner === "bun" ? ["bun"] : ["node", "corepack"]) : [], custom.port === null ? null : custom.port ?? 3000);
    } catch {
      const issue = "Invalid .idaevia/runtime.json: provide build and start commands, optional setup, and port 1024–65535 (or null for terminal apps).";
      return result("invalid", "Runtime configuration", fail(issue), fail(issue), [], null, issue);
    }
  }
  // These backends commonly also carry a package.json for CSS/assets.
  const php = () => result("php", has("artisan") ? "Laravel" : "PHP", `composer install --no-interaction && find . -path ./vendor -prune -o -name '*.php' -type f -print0 | xargs -0 -r -n 1 php -l`, has("artisan") ? "composer install --no-interaction && php artisan serve --host=0.0.0.0 --port=3000" : `composer install --no-interaction && php -S 0.0.0.0:3000 -t ${has("public/index.php") ? "public" : "."}`, ["php", "composer"]);
  if (has("artisan")) return php();
  if (has("Gemfile") && has("config/application.rb")) return result("rails", "Ruby on Rails", "bundle install && bundle exec rails zeitwerk:check", "bundle install && bundle exec rails server -b 0.0.0.0 -p 3000", ["ruby", "bundle"]);
  if (has("package.json")) {
    let pkg: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; main?: string };
    try { pkg = JSON.parse(entries.get("package.json")!); if (!pkg || Array.isArray(pkg)) throw Error(); }
    catch { const issue = "Invalid package.json. Fix its JSON before building."; return result("invalid", "JavaScript / TypeScript", fail(issue), fail(issue), [], null, issue); }
    const scripts = pkg.scripts ?? {}, deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const runner = has("pnpm-lock.yaml") ? "corepack pnpm" : has("yarn.lock") ? "corepack yarn" : has("bun.lock") || has("bun.lockb") ? "bun" : "npm";
    const install = runner === "npm" ? "npm install --no-audit --no-fund" : `${runner} install`;
    const id = deps.next ? "nextjs" : deps.nuxt ? "nuxtjs" : deps["@sveltejs/kit"] ? "sveltekit" : deps.astro ? "astro" : deps["@angular/core"] ? "angular" : deps["react-scripts"] ? "create-react-app" : deps["@remix-run/dev"] ? "remix" : deps.vite ? "vite" : deps.express ? "express" : deps.fastify ? "fastify" : deps["@nestjs/core"] ? "nestjs" : "node";
    const label = ({ nextjs: "Next.js", nuxtjs: "Nuxt", sveltekit: "SvelteKit", astro: "Astro", angular: "Angular", "create-react-app": "React", remix: "Remix", vite: deps.vue ? "Vue / Vite" : deps.svelte ? "Svelte / Vite" : deps.react ? "React / Vite" : "Vite", express: "Express", fastify: "Fastify", nestjs: "NestJS", node: "Node.js / TypeScript" })[id];
    const script = scripts.dev ? "dev" : scripts.start ? "start" : scripts.preview ? "preview" : null;
    const command = script ? String(scripts[script]) : "";
    let flags = /\bnext\b/.test(command) ? " --hostname 0.0.0.0 --port 3000" : /\b(?:vite|astro|nuxt|nuxi|ng serve)\b/.test(command) ? " --host 0.0.0.0 --port 3000" : "";
    const directVite = /^vite(?:\s|$)/.test(command) && !/[;&|]/.test(command);
    if (directVite) flags += " --config .idaevia-vite-preview.config.mjs";
    const configMatch = command.match(/--config(?:=|\s+)(?:"([^"]+)"|'([^']+)'|(\S+))/);
    const viteRoot = command.match(/^vite(?:\s+(?:dev|serve|preview))?\s+([^\s-][^\s]*)/)?.[1];
    const prisma = has("prisma/schema.prisma") ? "npx --no-install prisma generate && if [ \"$IDAEVIA_LOCAL_DATABASE\" = 1 ]; then npx --no-install prisma db push --skip-generate; fi && " : "";
    const js = [...entries.keys()].filter(p => /\.(?:mjs|cjs|js)$/.test(p));
    const check = has("tsconfig.json") ? `${runner} exec tsc --noEmit` : js.length ? js.map(p => `node --check ${quote(p)}`).join(" && ") : fail("No build script or checkable entrypoint. Add scripts.build to package.json.");
    const build = `${install} && ${prisma}${scripts.build ? `${runner} run build` : check}`;
    const entry = [pkg.main, "server.js", "server.cjs", "index.js", "index.mjs"].find(p => typeof p === "string" && has(p));
    const start = script ? `PORT=3000 HOST=0.0.0.0 ${runner} run ${script}${flags ? (runner === "npm" ? " --" : "") + flags : ""}` : entry ? `PORT=3000 HOST=0.0.0.0 node ${quote(entry)}` : fail("No dev/start/preview script. Add a start script or configure .idaevia/runtime.json.");
    return { ...result(id, label, build, `${install} && ${prisma}${script === "start" && scripts.build ? `${runner} run build && ` : ""}${start}`, runner === "npm" ? ["node", "npm"] : runner === "bun" ? ["bun"] : ["node", "corepack"], script || entry ? 3000 : null), ...(directVite ? { vite: { configFile: configMatch?.[1] ?? configMatch?.[2] ?? configMatch?.[3], root: viteRoot && !["dev", "serve", "preview"].includes(viteRoot) ? viteRoot : undefined } } : {}) };
  }
  const pythonFiles = [...entries.keys()].filter(p => p.endsWith(".py"));
  const venv = "(test -d .venv || python3 -m venv .venv) && . .venv/bin/activate && ";
  const requirements = venv + (has("requirements.txt") ? "python3 -m pip install -r requirements.txt && " : has("pyproject.toml") ? "python3 -m pip install -e . && " : "");
  const compile = "python3 -m compileall -q " + pythonFiles.map(quote).join(" ");
  if (has("manage.py")) return result("django", "Django", `${requirements}python3 manage.py check`, `${requirements}python3 manage.py runserver 0.0.0.0:3000`, ["python3"]);
  const pythonApp = [...entries].find(([path, content]) => path.endsWith(".py") && /\bFastAPI\s*\(/.test(content));
  if (pythonApp) {
    const moduleName = pythonApp[0].replace(/\.py$/, "").replaceAll("/", "."), variable = pythonApp[1].match(/(\w+)\s*=\s*FastAPI\s*\(/)?.[1] ?? "app";
    return result("fastapi", "FastAPI", `${requirements}${compile}`, `${requirements}python3 -m uvicorn ${quote(`${moduleName}:${variable}`)} --host 0.0.0.0 --port 3000`, ["python3"]);
  }
  const flask = [...entries].find(([path, content]) => path.endsWith(".py") && /\bFlask\s*\(/.test(content));
  if (flask) return result("flask", "Flask", `${requirements}${compile}`, `${requirements}python3 -m flask --app ${quote(flask[0])} run --host=0.0.0.0 --port=3000`, ["python3"]);
  if (has("pom.xml")) {
    const mvn = has("mvnw") ? "sh ./mvnw" : "mvn", web = /spring-boot/.test(entries.get("pom.xml")!);
    return result("maven", web ? "Java / Spring Boot" : "Java / Maven", `${mvn} package -DskipTests`, web ? `${mvn} spring-boot:run -Dspring-boot.run.arguments=--server.port=3000` : `${mvn} compile exec:java`, ["java", ...(has("mvnw") ? [] : ["mvn"])], web ? 3000 : null);
  }
  if (has("build.gradle") || has("build.gradle.kts")) {
    const gradle = has("gradlew") ? "sh ./gradlew" : "gradle", web = /org.springframework.boot/.test(code);
    return result("gradle", "JVM / Gradle", `${gradle} build -x test`, `${gradle} ${web ? "bootRun --args=--server.port=3000" : "run"}`, ["java", ...(has("gradlew") ? [] : ["gradle"])], web ? 3000 : null);
  }
  if (has("go.mod")) return result("go", "Go", "go build ./...", "PORT=3000 go run .", ["go"], /net\/http|gin-gonic|gofiber|labstack/.test(code) ? 3000 : null);
  if (has("Cargo.toml")) return result("rust", "Rust", "cargo build", "PORT=3000 cargo run", ["cargo"], /axum|actix-web|rocket|warp|tiny_http/.test(code) ? 3000 : null);
  if (has("composer.json")) return php();
  const csproj = [...entries].find(([p]) => /\.(cs|fs|vb)proj$/.test(p));
  if (csproj) { const web = /Microsoft.NET.Sdk.Web/.test(csproj[1]); return result("dotnet", ".NET", `dotnet build ${quote(csproj[0])}`, `dotnet run --project ${quote(csproj[0])}${web ? " --urls http://0.0.0.0:3000" : ""}`, ["dotnet"], web ? 3000 : null); }
  if (has("Gemfile")) return result("ruby", "Ruby / Rack", "bundle install && find . -path ./vendor -prune -o -name '*.rb' -type f -print0 | xargs -0 -r -n 1 ruby -c", has("config.ru") ? "bundle install && bundle exec rackup -o 0.0.0.0 -p 3000" : "bundle install && bundle exec ruby main.rb", ["ruby", "bundle"], has("config.ru") ? 3000 : null);
  if (has("mix.exs")) return result("elixir", "Elixir", "mix deps.get && mix compile", /phoenix/.test(code) ? "mix deps.get && PORT=3000 mix phx.server" : "mix run", ["mix"], /phoenix/.test(code) ? 3000 : null);
  if (has("pubspec.yaml")) return result("dart", "Dart / Flutter", /flutter:/.test(code) ? "flutter pub get && flutter build web" : "dart pub get && dart analyze", /flutter:/.test(code) ? "flutter run -d web-server --web-hostname 0.0.0.0 --web-port 3000" : "dart run", [/flutter:/.test(code) ? "flutter" : "dart"], /flutter:/.test(code) ? 3000 : null);
  if (has("Package.swift")) return result("swift", "Swift (Linux)", "swift build", "swift run", ["swift"], null);
  if (has("CMakeLists.txt")) return result("cmake", "C / C++ / CMake", "cmake -S . -B build && cmake --build build -j2", fail("Set start in .idaevia/runtime.json to run the compiled target."), ["cmake"], null);
  if (has("Makefile")) return result("make", "Make", "make", "make run", ["make"], null);
  const py = pythonFiles.find(p => /^(main|app)\.py$/.test(p)) ?? pythonFiles[0];
  if (py) return result("python", "Python", `${requirements}${compile}`, `${requirements}python3 ${quote(py)}`, ["python3"], null);
  for (const [file, id, tool, build, start] of [
    ["main.c", "C", "cc", "cc main.c -o /tmp/idaevia-program", "/tmp/idaevia-program"],
    ["main.cpp", "C++", "c++", "c++ main.cpp -o /tmp/idaevia-program", "/tmp/idaevia-program"],
    ["main.rb", "Ruby", "ruby", "ruby -c main.rb", "ruby main.rb"],
    ["main.lua", "Lua", "luac", "luac -p main.lua", "lua main.lua"],
    ["main.pl", "Perl", "perl", "perl -c main.pl", "perl main.pl"],
    ["main.sh", "Shell", "bash", "bash -n main.sh", "bash main.sh"],
  ]) if (has(file)) return result(id.toLowerCase(), id, build, `${build} && ${start}`, [tool], null);
  if (has("index.php")) return result("php", "PHP", "php -l index.php", "php -S 0.0.0.0:3000", ["php"]);
  const standaloneNode = [...entries].find(([path, source]) => /^(?:server|index|main|app)\.(?:cjs|mjs|js)$/.test(path) && /node:http|require\(["']http|from ["']http|\.listen\(/.test(source));
  if (standaloneNode) return result("node", "Node.js", `node --check ${quote(standaloneNode[0])}`, `PORT=3000 HOST=0.0.0.0 node ${quote(standaloneNode[0])}`, ["node"]);
  if (has("index.html")) return result("static", "HTML / CSS / JavaScript", "node .idaevia-static-build.cjs", "node .idaevia-static-build.cjs && node .preview.cjs", ["node"]);
  // Legacy browser-sandbox React files receive a complete Vite repository on upload.
  if (has("App.tsx") || has("App.jsx")) return result("react-sandbox", "React / Vite", "npm install --no-audit --no-fund && npm run build", "npm install --no-audit --no-fund && npm run dev -- --host 0.0.0.0 --port 3000", ["node", "npm"]);
  const manifests = /(?:^|\/)(?:package.json|pyproject.toml|requirements.txt|pom.xml|Cargo.toml|go.mod|composer.json|Gemfile|mix.exs)$/;
  const roots = [...new Set([...entries.keys()].filter(p => manifests.test(p) && p.includes("/")).map(p => p.slice(0, p.lastIndexOf("/"))))];
  if (roots.length === 1) {
    const root = roots[0], nested = runtimeProfile(files.filter(f => f.path.replace(/^\/+/, "").startsWith(root + "/")).map(f => ({ ...f, path: f.path.replace(/^\/+/, "").slice(root.length + 1) })), stack);
    return { ...nested, root, build: `cd ${quote(root)} && ${nested.build}`, preview: `cd ${quote(root)} && ${nested.preview}` };
  }
  const issue = roots.length > 1 ? "Multiple application roots found. Add .idaevia/runtime.json with build/start commands for all services and the frontend port." : "No automatic runtime detected. Add .idaevia/runtime.json with setup, build, start and port; commands run only in the isolated Linux terminal.";
  return result("custom-required", stack || "Custom runtime", fail(issue), fail(issue), [], null, issue);
}

/** Natural terminal actions select the project's toolchain instead of assuming npm. */
export function projectTaskCommand(request: string, files: RuntimeFile[], profile: RuntimeProfile): string | null {
  const action = request.trim().toLowerCase();
  if (!["install dependencies", "instaliraj dependencies", "run tests", "run lint", "run typecheck"].includes(action)) return null;
  const entry = files.find(f => f.path.replace(/^\/+/, "") === (profile.root === "." ? "" : profile.root + "/") + "package.json");
  const prefix = profile.root === "." ? "" : `cd ${quote(profile.root)} && `;
  const paths = files.map(f => f.path.replace(/^\/+/, ""));
  const runner = paths.some(p => p.endsWith("pnpm-lock.yaml")) ? "corepack pnpm" : paths.some(p => p.endsWith("yarn.lock")) ? "corepack yarn" : paths.some(p => /bun.lockb?$/.test(p)) ? "bun" : "npm";
  if (entry || profile.id === "react-sandbox") {
    if (action.includes("dependencies")) return prefix + `${runner} install`;
    const key = action === "run tests" ? "test" : action === "run lint" ? "lint" : "typecheck";
    try { if (entry && JSON.parse(entry.content).scripts?.[key]) return prefix + `${runner} run ${key}`; } catch { /* The build reports invalid JSON. */ }
    return fail(`No ${key} script is configured in package.json. Add the project's check command first.`);
  }
  const tests: Record<string, string> = { go: "go test ./...", rust: "cargo test", maven: "mvn test", gradle: "gradle test", dotnet: "dotnet test", django: "python3 manage.py test", python: "python3 -m pytest", fastapi: "python3 -m pytest", flask: "python3 -m pytest", rails: "bundle exec rails test", ruby: "bundle exec rake test", elixir: "mix test", swift: "swift test", dart: "dart test", php: "vendor/bin/phpunit" };
  let command: string | undefined;
  if (action === "run tests") command = tests[profile.id];
  else if (action === "run lint") command = ({ go: "go vet ./...", rust: "cargo clippy" } as Record<string, string>)[profile.id];
  else if (action.includes("dependencies")) command = ({ go: "go mod download", rust: "cargo fetch", maven: "mvn dependency:resolve", php: "composer install", rails: "bundle install", ruby: "bundle install", dotnet: "dotnet restore", elixir: "mix deps.get", swift: "swift package resolve", python: "python3 -m pip install -r requirements.txt", fastapi: "python3 -m pip install -r requirements.txt", flask: "python3 -m pip install -r requirements.txt", django: "python3 -m pip install -r requirements.txt" } as Record<string, string>)[profile.id];
  if (!command) return fail(`No automatic command for "${action}" in ${profile.label}. Run the project's documented tool or ask the agent to add its check configuration.`);
  if (["python", "fastapi", "flask", "django"].includes(profile.id)) command = `(test -d .venv || python3 -m venv .venv) && . .venv/bin/activate && ${command}`;
  return prefix + command;
}
