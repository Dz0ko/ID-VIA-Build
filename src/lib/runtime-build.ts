// Serves only build output, never the source tree, environment files or credentials.
export const SERVER = `const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const requestedPort = Number(process.env.PORT) || 3000;
const root = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server = http.createServer(async (req,res) => {
 try {
  const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target = path.resolve(root, '.' + name);
  if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  let file = target;
  try { if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html'); }
  catch { if (path.extname(name)) { res.writeHead(404).end(); return; } file = path.join(root,'index.html'); }
  const real = await fs.realpath(file);
  if (!real.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  const data = await fs.readFile(real);
  res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  res.end(data);
 } catch { res.writeHead(404).end(); }
});
function listen(port) {
 server.once('error', (error) => {
  if (error.code === 'EADDRINUSE' && port < requestedPort + 20) return listen(port + 1);
  throw error;
 });
 server.listen(port,'0.0.0.0',function(){console.log('Preview ready at http://localhost:' + this.address().port)});
}
listen(requestedPort);`;

/** Static multi-file projects retain their styles, scripts, pages, fonts and images. */
export function staticBuildScript(files: { path: string; content: string }[]) {
  const publicFiles = files.map(f => f.path.replace(/^\/+/, "")).filter(p => !p.split("/").some(s => s.startsWith(".") || s === "node_modules" || s === "dist") && /\.(?:html?|css|js|mjs|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp4|webm|mp3|wav|pdf|txt|webmanifest)$/i.test(p));
  return `const fs=require('node:fs/promises'),path=require('node:path');\n(async()=>{const root=process.cwd();await fs.mkdir('dist',{recursive:true});for(const name of ${JSON.stringify(publicFiles)}){const source=await fs.realpath(name);if(!source.startsWith(root+path.sep))throw Error('Unsafe static asset');const target=path.resolve('dist',name);if(!target.startsWith(path.resolve('dist')+path.sep))throw Error('Unsafe static path');await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target)}})().catch(e=>{console.error(e.message);process.exit(1)});`;
}

export interface LanguageBuildRuntime {
  command(command: string, timeoutMs: number): Promise<void>;
  start(command: string): Promise<void>;
}
/** A release is recorded by the caller only after this compilation/check succeeds. */
export async function executeLanguageBuild(runtime: LanguageBuildRuntime, profile: import("./runtime-profile").RuntimeProfile, emit: (line: string) => void, signal: AbortSignal) {
  signal.throwIfAborted();
  if (profile.issue) throw new Error(profile.issue);
  emit(`Building ${profile.label}…`);
  await runtime.command(profile.build, 210_000);
  signal.throwIfAborted();
  if (profile.previewPort === null) { emit("Build/check succeeded. This target runs in Terminal and has no automatic browser preview."); return; }
  emit(`Build/check succeeded. Starting ${profile.label} preview on port ${profile.previewPort}…`);
  await runtime.start(profile.preview);
  // A real HTTP check, not a success inferred from a URL printed to stdout.
  await runtime.command(`node -e 'let n=0;const check=()=>fetch("http://127.0.0.1:${profile.previewPort}",{redirect:"manual",signal:AbortSignal.timeout(3000)}).then(r=>{if(!((r.status>=200&&r.status<400)||r.status===401||r.status===404))throw Error();process.exit(0)}).catch(()=>++n<60?setTimeout(check,1000):process.exit(1));check()'`, 75_000);
  signal.throwIfAborted();
}
