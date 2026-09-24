/** Actionable summaries; raw project logs stay in its terminal. */
export function runtimeFailureHint(output: string): string | null {
  if (/heap out of memory|reached heap limit|\bENOMEM\b|out of memory|oom-kill/i.test(output)) return "The process ran out of memory. App runtimes provide 4 GB RAM; reduce build parallelism or split a larger build. Your saved source is intact.";
  if (/(?:^|[\r\n])(?:Required runtime tool is unavailable: [a-z][a-z0-9+-]*\.|No automatic runtime detected\.|Invalid \.idaevia\/runtime\.json:)|command not found/i.test(output)) return "This runtime needs a compatible toolchain or start command. Check the terminal details; custom projects can define build and start in .idaevia/runtime.json.";
  // A start command that runs build output (node dist/server.js) before any build is not a broken dependency.
  if (/Cannot find module '(?:\/home\/user\/project\/|\.\/)?(?:dist|build|out|\.next|target)\//i.test(output)) return "The start command needs build output that does not exist yet. Use “Build & preview” so the project is built first, or run the build command in Terminal before starting it.";
  if (/ModuleNotFoundError|Cannot find module|Could not resolve|error TS\d+|Failed to compile/i.test(output)) return "The project could not compile or load a dependency. Check the error in Terminal and fix the source or dependency before reopening Preview.";
  if (/Environment variable not found|Missing required environment variable|Authentication failed against database|Can't reach database server/i.test(output)) return "A required project setting or database connection is missing. Check the terminal and configure this project's environment variables.";
  return null;
}
