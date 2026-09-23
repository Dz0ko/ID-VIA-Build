import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { rateLimit } from "@/lib/security";
import { getIntegration } from "@/lib/integrations";
import { buildProjectFiles, readProjectEnv, writeProjectEnv } from "@/lib/project-files";
import { pushToGitHub } from "@/lib/github";
import { deployToVercel } from "@/lib/vercel";
import { auditHtml } from "@/lib/audit";

import { runProjectBuild, stopProjectRuntime } from "@/lib/project-runtime";
import { runtimeCommand } from "@/lib/runtime-command";

export const maxDuration = 300;

const schema = z.object({ cmd: z.string().min(1).max(500) });

const HELP = [
  "IDÆVIA terminal · real commands run on the server with full logs",
  "",
  "  status                      project, files, last push and deploys",
  "  ls / cat <file>             list or print project files",
  "  npm run build | preview     build in an isolated runtime and open the built site",
  "  npm run dev | npm start     build and serve a temporary preview (not HMR)",
  "  stop                        stop the temporary preview",
  "  audit                       production audit (performance, SEO, a11y, security)",
  "  publish | unpublish         idaevia.app hosting for websites (/s/<slug>)",
  "  git push [owner/repo] [--public]   push all files to GitHub (creates the repo if needed)",
  "  git status                  last pushed commit",
  "  deploy vercel [name]        deploy to Vercel (static site or Vite app), streams the build",
  "  env list | env set KEY=VALUE | env unset KEY   per-project environment for deploys",
  "  supabase link               inject the connected Supabase project into env",
  "  integrations                what is connected (GitHub, Vercel, Supabase, Higgsfield…)",
  "  export                      download the project as a ZIP",
  "  versions | git log · agents · run <agent> <task> · clear   (run locally in the workspace)",
];

/** Server-side terminal: streams log lines as SSE while running one command. */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/terminal">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid input." }, { status: 400 });
  const limited = await rateLimit(`terminal:user:${user.id}`, 60, 600);
  if (limited) return limited;
  const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { files: true } });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const execution = runtimeCommand(body.data.cmd);
  if (execution && execution !== "stop") {
    const limit = await rateLimit(`runtime:user:${user.id}`, 12, 3600);
    if (limit) return limit;
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: string, kind: "line" | "ok" | "err" | "done" | "preview" = "line") => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ kind, line })}\n\n`)); } catch { /* Disconnected client. */ } };
      const cmd = body.data.cmd.trim();
      const [name, ...args] = cmd.split(/\s+/);
      const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
      const env = readProjectEnv(project);
      try {
        if (execution === "stop") { await stopProjectRuntime(id); send("Preview stopped.", "ok"); }
        else if (execution) {
          const result = await runProjectBuild(project, (line) => send(line), req.signal);
          send(result.url, "preview");
        }
        else if (name === "help") HELP.forEach((l) => send(l));
        else if (name === "status") {
          const deploys = await db.deployment.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 5 });
          send(`Project   ${project.name} (${project.kind}) · ${project.status}`);
          send(`Files     ${project.kind === "app" ? `${project.files.length} source files` : `${(project.html.length / 1024).toFixed(1)} KB HTML`}`);
          send(`Preview   ${project.status === "PUBLISHED" ? `${appUrl}/s/${project.slug}` : "not published"}`);
          send(`GitHub    ${project.gitRemote ?? "never pushed"}`);
          send(`Env       ${Object.keys(env).length ? Object.keys(env).join(", ") : "none"}`);
          if (deploys.length) { send("Deploys"); deploys.forEach((d) => send(`  ${d.createdAt.toISOString().slice(0, 16).replace("T", " ")}  ${d.provider.padEnd(8)} ${d.status.padEnd(7)} ${d.url ?? ""}`)); }
        } else if (name === "ls") {
          const files = buildProjectFiles(project, env);
          files.forEach((f) => send(`${String(f.content.length).padStart(8)}  ${f.path}`));
          send(`${files.length} files`, "ok");
        } else if (name === "cat") {
          const files = buildProjectFiles(project, env);
          const f = files.find((x) => x.path === args[0] || x.path === `/${args[0]}` || x.path === `src${args[0]}`);
          if (!f) send(`No such file: ${args[0] ?? ""}`, "err");
          else f.content.split("\n").slice(0, 400).forEach((l) => send(l));
        } else if (name === "audit") {
          if (project.kind === "app") send("Audit is available for website projects.", "err");
          else {
            const a = auditHtml(project.html);
            send(`Overall ${a.overall}/100 · performance ${a.performance} · SEO ${a.seo} · accessibility ${a.accessibility} · security ${a.security} · mobile ${a.mobile}`);
            if (!a.issues.length) send("✓ No issues found", "ok");
            for (const c of a.issues) send(`${c.severity === "high" ? "✗" : "!"} [${c.area}] ${c.message}`, c.severity === "high" ? "err" : "line");
          }
        } else if (name === "publish") {
          if (project.kind === "app") send("React apps are deployed with `deploy vercel` (or export the ZIP).", "err");
          else if (!project.html.trim()) send("Nothing to publish yet.", "err");
          else {
            let html = project.html;
            if (user.plan === "FREE") html = html.replace("</body>", `<a href="${appUrl}" target="_blank" rel="noopener" style="position:fixed;bottom:12px;right:12px;z-index:9999;font:500 11px/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;background:#0a0a0b;color:#f5f5f7;border:1px solid #1c1c1f;border-radius:999px;padding:8px 12px;text-decoration:none">Made with IDÆVIA</a></body>`);
            await db.project.update({ where: { id }, data: { status: "PUBLISHED", publishedHtml: html, publishedAt: new Date() } });
            await db.deployment.create({ data: { projectId: id, provider: "idaevia", status: "READY", url: `${appUrl}/s/${project.slug}`, log: "Published to IDÆVIA hosting", finishedAt: new Date() } });
            send(`✓ Live at ${appUrl}/s/${project.slug}`, "ok");
          }
        } else if (name === "unpublish") {
          await db.project.update({ where: { id }, data: { status: "DRAFT", publishedHtml: null } });
          send("✓ Preview link disabled.", "ok");
        } else if (name === "export") {
          if (user.plan === "FREE") send(`Code export is available from the ${PLANS.STARTER.name} plan.`, "err");
          else send(`Download: ${appUrl}/api/projects/${id}/export`, "ok");
        } else if (name === "integrations") {
          const rows = await db.integration.findMany({ where: { userId: user.id } });
          if (!rows.length) send("Nothing connected. Open Integrations to connect GitHub, Vercel, Supabase or Higgsfield.");
          rows.forEach((r) => send(`✓ ${r.provider.padEnd(11)} ${r.label ?? ""}`));
        } else if (name === "env") {
          const sub = args[0];
          if (sub === "list" || !sub) { const keys = Object.keys(env); keys.length ? keys.forEach((k) => send(`${k}=${env[k].length > 6 ? env[k].slice(0, 3) + "…" + env[k].slice(-2) : "***"}`)) : send("No variables set."); }
          else if (sub === "set") {
            const m = args.slice(1).join(" ").match(/^([A-Z][A-Z0-9_]{1,63})=(.*)$/);
            if (!m) send("Usage: env set KEY=VALUE (KEY in UPPER_SNAKE_CASE)", "err");
            else if (Object.keys(env).length >= 40) send("Maximum 40 variables per project.", "err");
            else { env[m[1]] = m[2].slice(0, 2000); await writeProjectEnv(id, env); send(`✓ ${m[1]} saved (encrypted). VITE_* variables are baked into Vite builds.`, "ok"); }
          } else if (sub === "unset") { delete env[args[1]]; await writeProjectEnv(id, env); send(`✓ ${args[1]} removed`, "ok"); }
          else send("Usage: env list | env set KEY=VALUE | env unset KEY", "err");
        } else if (name === "supabase") {
          const sb = await getIntegration<{ url: string; anonKey: string; serviceKey?: string }>(user.id, "supabase");
          if (!sb) send("Connect Supabase in Integrations first.", "err");
          else {
            env.VITE_SUPABASE_URL = sb.secret.url; env.VITE_SUPABASE_ANON_KEY = sb.secret.anonKey;
            if (sb.secret.serviceKey) env.SUPABASE_SERVICE_ROLE_KEY = sb.secret.serviceKey;
            await writeProjectEnv(id, env);
            send(`✓ Linked Supabase project ${sb.label}: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set for this project.`, "ok");
            send("In the app: import { createClient } from \"@supabase/supabase-js\"; createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)");
          }
        } else if (name === "git" && args[0] === "status") {
          send(project.gitRemote ? `Last push: ${project.gitRemote}` : "Never pushed. Run `git push` to create a repository.");
        } else if (name === "git" && args[0] === "push") {
          if (user.plan === "FREE") { send(`GitHub push is available from the ${PLANS.STARTER.name} plan.`, "err"); }
          else {
            const gh = await getIntegration<{ token: string }>(user.id, "github");
            if (!gh) send("Connect GitHub in Integrations first (one click, or a token with Contents: write).", "err");
            else {
              const repoArg = args.slice(1).find((a) => !a.startsWith("--"));
              const isPublic = args.includes("--public");
              const dep = await db.deployment.create({ data: { projectId: id, provider: "github", status: "PENDING" } });
              const lines: string[] = [];
              const log = (l: string) => { lines.push(l); send(l); };
              try {
                const r = await pushToGitHub({ token: gh.secret.token, repo: repoArg ?? project.gitRemote?.split("@")[0], name: project.slug, description: project.description ?? undefined, isPrivate: !isPublic, message: `IDÆVIA Build: ${project.name} (${new Date().toISOString().slice(0, 16).replace("T", " ")})`, files: buildProjectFiles(project, env), log });
                await db.project.update({ where: { id }, data: { gitRemote: `${r.owner}/${r.repo}@${r.sha.slice(0, 7)}` } });
                await db.deployment.update({ where: { id: dep.id }, data: { status: "READY", url: r.url, log: lines.join("\n"), finishedAt: new Date() } });
                send(`${r.created ? "Created " : ""}${r.url} · commit ${r.commitUrl}`, "ok");
              } catch (e) {
                const msg = e instanceof Error ? e.message : "push failed";
                await db.deployment.update({ where: { id: dep.id }, data: { status: "ERROR", log: [...lines, msg].join("\n"), finishedAt: new Date() } });
                send(`✗ ${msg}`, "err");
              }
            }
          }
        } else if (name === "deploy") {
          const target = args[0] ?? "idaevia";
          if (target === "idaevia" || target === "preview") { send("Use `publish` for idaevia.app hosting, or `deploy vercel`.", "line"); }
          else if (target === "vercel") {
            if (user.plan === "FREE") send(`Vercel deploys are available from the ${PLANS.STARTER.name} plan.`, "err");
            else {
              const vc = await getIntegration<{ token: string; teamId?: string }>(user.id, "vercel");
              if (!vc) send("Connect Vercel in Integrations first (paste a token from vercel.com/account/tokens).", "err");
              else {
                const dep = await db.deployment.create({ data: { projectId: id, provider: "vercel", status: "PENDING" } });
                const lines: string[] = [];
                const log = (l: string) => { lines.push(l); send(l); };
                try {
                  const files = buildProjectFiles(project, env).filter((f) => f.path !== ".env.production");
                  const r = await deployToVercel({ token: vc.secret.token, teamId: vc.secret.teamId || undefined, name: args[1] ?? project.slug, files, framework: project.kind === "app" ? "vite" : null, env, log });
                  await db.deployment.update({ where: { id: dep.id }, data: { status: r.state === "READY" ? "READY" : "PENDING", url: r.url, log: lines.join("\n"), finishedAt: new Date() } });
                  send(r.url, "ok");
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "deploy failed";
                  await db.deployment.update({ where: { id: dep.id }, data: { status: "ERROR", log: [...lines, msg].join("\n"), finishedAt: new Date() } });
                  send(`✗ ${msg}`, "err");
                }
              }
            }
          } else send(`Unknown deploy target "${target}". Try: deploy vercel`, "err");
        } else {
          send(`Unknown command: ${name}. Type \`help\`.`, "err");
        }
      } catch (e) {
        send(`✗ ${execution ? (e instanceof Error && /runtime is not configured|already running|no \/App|no website|previous runtime/.test(e.message) ? e.message : "Build or preview failed. Check the command output above; the platform owner can check runtime configuration and quota.") : e instanceof Error ? e.message : "command failed"}`, "err");
      } finally {
        send("", "done");
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
