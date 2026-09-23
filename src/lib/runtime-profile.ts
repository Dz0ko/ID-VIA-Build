/** Commands execute only inside the project's isolated terminal. Prefer files over stale stack labels. */
export function runtimeProfile(files: { path: string; content: string }[], stack: string) {
  const entries = new Map(files.map(f => [f.path.replace(/^\/+/, ""), f.content]));
  const has = (name: string) => entries.has(name);
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  let pkg: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try { pkg = JSON.parse(entries.get("package.json") || "{}"); } catch { /* show package errors in the terminal */ }
  const scripts = pkg.scripts ?? {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const result = (build: string, preview: string, label: string) => ({ build, preview, label });
  if (has("package.json")) {
    const install = has("pnpm-lock.yaml") ? "corepack pnpm install" : has("yarn.lock") ? "corepack yarn install" : "npm install --no-audit --no-fund";
    const script = scripts.dev ? "dev" : scripts.start ? "start" : scripts.preview ? "preview" : null;
    const flags = script && /\bnext\b/.test(scripts[script]) ? " -- --hostname 0.0.0.0 --port 3000" : script && /\bvite\b/.test(scripts[script]) ? " -- --host 0.0.0.0 --port 3000" : "";
    const start = script ? `PORT=3000 HOST=0.0.0.0 npm run ${script}${flags}` : "printf '%s\\n' 'No dev/start/preview script. Add one in package.json, or run your entry point in Terminal.'";
    return result(`${install} && ${scripts.build ? "npm run build" : "printf '%s\\n' 'Dependencies installed; no build script is defined.'"}`, `${install} && ${start}`, deps.next ? "Next.js" : "JavaScript / TypeScript");
  }
  const requirements = has("requirements.txt") ? "python3 -m pip install -r requirements.txt && " : has("pyproject.toml") ? "python3 -m pip install -e . && " : "";
  if (has("manage.py")) return result(`${requirements}python3 manage.py check`, `${requirements}python3 manage.py runserver 0.0.0.0:3000`, "Django");
  const pythonApp = [...entries].find(([path, code]) => path.endsWith(".py") && /\bFastAPI\s*\(/.test(code));
  if (pythonApp) {
    const moduleName = pythonApp[0].replace(/\.py$/, "").replaceAll("/", ".");
    const variable = pythonApp[1].match(/(\w+)\s*=\s*FastAPI\s*\(/)?.[1] ?? "app";
    return result(`${requirements}python3 -m compileall -q .`, `${requirements}python3 -m uvicorn ${quote(`${moduleName}:${variable}`)} --host 0.0.0.0 --port 3000`, "FastAPI");
  }
  const flask = [...entries].find(([path, code]) => path.endsWith(".py") && /\bFlask\s*\(/.test(code));
  if (flask) return result(`${requirements}python3 -m compileall -q .`, `${requirements}python3 -m flask --app ${quote(flask[0])} run --host=0.0.0.0 --port=3000`, "Flask");
  if (has("pom.xml")) {
    const mvn = has("mvnw") ? "sh ./mvnw" : "mvn";
    return result(`${mvn} package -DskipTests`, `${mvn} spring-boot:run -Dspring-boot.run.arguments=--server.port=3000`, "Java / Maven");
  }
  if (has("build.gradle") || has("build.gradle.kts")) {
    const gradle = has("gradlew") ? "sh ./gradlew" : "gradle";
    return result(`${gradle} build -x test`, `${gradle} ${[...entries.values()].some(code => code.includes("org.springframework.boot")) ? "bootRun --args=--server.port=3000" : "run"}`, "JVM / Gradle");
  }
  if (has("go.mod")) return result("go build ./...", "PORT=3000 go run .", "Go");
  if (has("Cargo.toml")) return result("cargo build", "PORT=3000 cargo run", "Rust");
  if (has("composer.json")) return result("composer install", has("artisan") ? "composer install && php artisan serve --host=0.0.0.0 --port=3000" : "composer install && php -S 0.0.0.0:3000 -t public", "PHP");
  if ([...entries.keys()].some(p => p.endsWith(".csproj"))) return result("dotnet build", "dotnet run --urls http://0.0.0.0:3000", ".NET");
  if (has("Gemfile")) return result("bundle install", "bundle install && bundle exec rails server -b 0.0.0.0 -p 3000", "Ruby");
  if (has("Package.swift")) return result("swift build", "swift run", "Swift (Linux)");
  if (has("Makefile")) return result("make", "make run", "Make");
  const py = [...entries.keys()].find(p => /^(main|app)\.py$/.test(p));
  if (py) return result(`${requirements}python3 -m compileall -q .`, `${requirements}python3 ${quote(py)}`, "Python");
  if (has("main.c")) return result("cc main.c -o /tmp/idaevia-program", "cc main.c -o /tmp/idaevia-program && /tmp/idaevia-program", "C");
  if (has("main.cpp")) return result("c++ main.cpp -o /tmp/idaevia-program", "c++ main.cpp -o /tmp/idaevia-program && /tmp/idaevia-program", "C++");
  if (/react/i.test(stack)) return result("npm install && npm run build", "npm install && npm run dev -- --host 0.0.0.0 --port 3000", "React");
  const help = "printf '%s\\n' 'No automatic runtime detected. Use Terminal to install the required toolchain and run your build/start command. Web servers must listen on 0.0.0.0; use Open preview with their port. Native apps and command-line programs run in Terminal.'";
  return result(help, help, stack);
}
