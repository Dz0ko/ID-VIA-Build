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

export interface BuildRuntime {
  command(command: string, timeoutMs: number): Promise<void>;
  writeServer(source: string): Promise<void>;
  startServer(): Promise<void>;
}

/** The adapter only executes inside the provisioned sandbox, never the app host. */
export async function executeProjectBuild(runtime: BuildRuntime, isApp: boolean, emit: (line: string) => void, signal: AbortSignal) {
  signal.throwIfAborted();
  if (isApp) {
    emit("$ npm install --no-audit --no-fund");
    await runtime.command("npm install --no-audit --no-fund", 120_000);
    signal.throwIfAborted();
    emit("$ npm run build");
    await runtime.command("npm run build", 120_000);
  } else {
    emit("Static HTML project: preparing dist/index.html (no npm compilation needed).");
    await runtime.command("mkdir -p dist && cp index.html dist/index.html", 10_000);
  }
  signal.throwIfAborted();
  await runtime.writeServer(SERVER);
  emit("Starting the built site on port 3000…");
  await runtime.startServer();
  await runtime.command("node -e 'let n=0;const check=()=>fetch(\"http://127.0.0.1:3000\").then(r=>{if(!r.ok)throw Error();process.exit(0)}).catch(()=>++n<30?setTimeout(check,500):process.exit(1));check()'", 20_000);
  signal.throwIfAborted();
}
