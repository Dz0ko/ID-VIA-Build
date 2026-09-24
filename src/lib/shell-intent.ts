/** Explicit shell syntax is forwarded verbatim; prose editing requests stay with the AI. */
export function shellIntent(input: string): string | null {
  const text = input.trim();
  const aliases: Record<string, string> = {
    "install dependencies": "npm install", "instaliraj dependencies": "npm install",
    "run tests": "npm test", "run lint": "npm run lint", "run typecheck": "npm run typecheck",
    "push": "git push", "push it": "git push", "push to github": "git push", "pusti na github": "git push",
    "deploy": "deploy vercel", "deploy to vercel": "deploy vercel", "deploy on vercel": "deploy vercel",
    "publish": "publish", "publish the site": "publish",
  };
  if (aliases[text.toLowerCase()]) return aliases[text.toLowerCase()];
  if (/^go (?:build|test|run|mod|fmt|vet|version|env|list)(?:\s|$)/.test(text)) return text;
  const explicit = text.match(/^(?:terminal:|shell:|execute:|во терминал:|vo terminal:)\s*([\s\S]+)$/i);
  if (explicit) return explicit[1];
  const run = text.match(/^(?:please\s+|te molam\s+|те молам\s+)?(?:run|execute|izvrsi|изврши|пушти|pusti)\s+((?:npm|npx|pnpm|yarn|bun|git|node|python3?|pip3?|pytest|cargo|go|make|mvn|gradle|dotnet|php|ruby|bundle|rails|mix|elixir|java|javac|swift|dart|flutter|zig|nim|cmake|deno)\b[\s\S]*)$/i);
  if (run) return run[1];
  if (/^(?:npm|npx|pnpm|yarn|bun|git|node|python3?|pip3?|pytest|cargo|mvn|gradle|dotnet|php|ruby|bundle|rails|mix|elixir|java|javac|swift|dart|flutter|zig|nim|cmake|deno|gcc|g\+\+|cc|c\+\+|perl|lua|ls|pwd|cd|cat|mkdir|touch|head|tail|grep|rg|curl|wget|echo|printf|sed|awk|bash|sh|chmod|cp|mv|rm|ps|kill|clear|env)(?:\s|$)/.test(text)) return text;
  if (/^export [A-Za-z_][A-Za-z0-9_]*=/.test(text)) return text;
  return null;
}
