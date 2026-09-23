import { Sandbox } from "e2b";
import { runtimeResources, runtimeMemoryEnvironment } from "../src/lib/runtime-resources";

async function main() {
  const resources = runtimeResources("app");
  const sandbox = await Sandbox.create(resources.template, { timeoutMs: 600_000, network: { allowPublicTraffic: true } });
  const envs = runtimeMemoryEnvironment(resources.memoryMB);
  const run = (cmd: string, cwd = "/home/user", timeoutMs = 120_000) => sandbox.commands.run(cmd, { cwd, envs, timeoutMs });
  const server = (cmd: string, cwd = "/home/user") => sandbox.commands.run(cmd, { cwd, envs, background: true, timeoutMs: 0 });
  const check = async (port: number, expected: string) => {
    for (let i = 0; i < 60; i++) {
      try { const res = await fetch(`https://${sandbox.getHost(port)}`, { signal: AbortSignal.timeout(3000) }); if (res.ok && (await res.text()).includes(expected)) { console.log(`PASS ${expected}: HTTPS preview`); return; } } catch { /* Booting */ }
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`${expected} preview failed`);
  };
  try {
    const info = await sandbox.getInfo();
    if (info.memoryMB < 4096) throw new Error("Insufficient RAM");
    console.log(`Runtime: ${info.memoryMB} MiB`);
    const versions = await run("node --version && python3 --version && javac -version && go version && rustc --version && php --version | head -1; dotnet --list-sdks; ruby --version; mvn --version | head -1; gradle --version | head -8");
    console.log(versions.stdout);
    await sandbox.files.write([
      { path: "/home/user/node.cjs", data: "require('http').createServer((q,s)=>s.end('Node preview')).listen(3000,'0.0.0.0')" },
      { path: "/home/user/python.py", data: "from http.server import BaseHTTPRequestHandler,HTTPServer\nclass Handler(BaseHTTPRequestHandler):\n def do_GET(self):\n  self.send_response(200);self.end_headers();self.wfile.write(b'Python preview')\nHTTPServer(('0.0.0.0',3001),Handler).serve_forever()" },
      { path: "/home/user/Main.java", data: 'import com.sun.net.httpserver.HttpServer; import java.net.InetSocketAddress; public class Main { public static void main(String[] args) throws Exception { var server=HttpServer.create(new InetSocketAddress("0.0.0.0",3002),0); server.createContext("/",ex->{var bytes="Java preview".getBytes();ex.sendResponseHeaders(200,bytes.length);ex.getResponseBody().write(bytes);ex.close();});server.start(); }}' },
      { path: "/home/user/main.go", data: 'package main\nimport("net/http";"fmt")\nfunc main(){http.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){fmt.Fprint(w,"Go preview")});http.ListenAndServe("0.0.0.0:3003",nil)}' },
      { path: "/home/user/main.rs", data: 'use std::io::{Read,Write};use std::net::TcpListener;fn main(){for stream in TcpListener::bind("0.0.0.0:3004").unwrap().incoming(){let mut s=stream.unwrap();let mut buf=[0;1024];let _=s.read(&mut buf);s.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 12\r\nConnection: close\r\n\r\nRust preview").unwrap();}}' },
      { path: "/home/user/php/index.php", data: "<?php echo 'PHP preview';" },
      { path: "/home/user/hello.c", data: '#include <stdio.h>\nint main(){puts("C compiled");}' },
      { path: "/home/user/hello.cpp", data: '#include <iostream>\nint main(){std::cout << "C++ compiled";}' },
    ]);
    await server("node node.cjs"); await check(3000,"Node preview");
    await server("python3 python.py"); await check(3001,"Python preview");
    await run("javac Main.java"); await server("java Main"); await check(3002,"Java preview");
    await run("go build -o /home/user/go-preview main.go"); await server("./go-preview"); await check(3003,"Go preview");
    await run("rustc main.rs -o /home/user/rust-preview"); await server("./rust-preview"); await check(3004,"Rust preview");
    await server("php -S 0.0.0.0:3005 -t php"); await check(3005,"PHP preview");
    await run("dotnet new web -o /home/user/dotnet-preview --no-https", "/home/user");
    await sandbox.files.write("/home/user/dotnet-preview/Program.cs", 'var app = WebApplication.CreateBuilder(args).Build(); app.MapGet("/", () => ".NET preview"); app.Run();');
    await run("dotnet build", "/home/user/dotnet-preview");
    await server("dotnet run --no-build --urls http://0.0.0.0:3006", "/home/user/dotnet-preview"); await check(3006,".NET preview");
    const native = await run("cc hello.c -o hello-c && ./hello-c && c++ hello.cpp -o hello-cpp && ./hello-cpp && ruby -e 'puts \"Ruby executed\"'");
    if (!native.stdout.includes("C compiled") || !native.stdout.includes("C++ compiled") || !native.stdout.includes("Ruby executed")) throw new Error("Native toolchain check failed");
    console.log("PASS C, C++, Ruby execution");
  } finally { await sandbox.kill(); console.log("Test sandbox removed"); }
}
main().catch(e => { console.error(e.message); if(e.stderr) console.error(e.stderr); process.exitCode=1; });
