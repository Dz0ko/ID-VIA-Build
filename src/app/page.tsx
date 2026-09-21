import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { AGENTS } from "@/lib/agents";
import { TEMPLATES } from "@/lib/templates";

const flow = ["Idea", "Plan", "Design", "Build", "Agents", "Test", "Optimize", "Deploy", "Monitor"];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-void text-paper">
      <header className="sticky top-0 z-40 border-b border-graphite bg-void/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-fog">
            <a href="#product" className="hover:text-paper">Product</a>
            <a href="#agents" className="hover:text-paper">Agents</a>
            <a href="#templates" className="hover:text-paper">Templates</a>
            <Link href="/pricing" className="hover:text-paper">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/app" className="btn btn-primary btn-sm">Open workspace</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
                <Link href="/signup" className="btn btn-primary btn-sm">Start building</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden grid-bg">
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(91,92,255,0.18),transparent_70%)]" />
          <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-24 text-center">
            <span className="pill font-mono text-[11px] tracking-[0.18em] uppercase">AI Software Creation Platform</span>
            <h1 className="display mt-8 max-w-4xl mx-auto">
              Build anything.
              <br />
              Ship everything.
            </h1>
            <p className="mt-8 text-lg text-fog max-w-2xl mx-auto">
              Describe it. IDÆVIA plans, designs and builds your website, SaaS or app with a team of AI agents — then
              tests, optimises and deploys it to your domain.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href={user ? "/app" : "/signup"} className="btn btn-primary">Start building free</Link>
              <Link href="/pricing" className="btn btn-outline">See plans</Link>
            </div>
            <div className="mt-16 card p-2 max-w-4xl mx-auto text-left">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-graphite">
                <span className="w-2.5 h-2.5 rounded-full bg-error/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
                <span className="ml-3 font-mono text-[11px] text-ash">idaevia.app / workspace</span>
              </div>
              <div className="grid md:grid-cols-[180px_1fr_200px] gap-0 h-[300px]">
                <div className="hidden md:block border-r border-graphite p-3 font-mono text-xs text-ash space-y-1">
                  <div className="text-fog">app/</div>
                  <div className="pl-3">index.html</div>
                  <div className="pl-3">components/</div>
                  <div className="pl-3">public/</div>
                  <div className="mt-4 text-fog">versions/</div>
                  <div className="pl-3">v01 · initial</div>
                  <div className="pl-3">v02 · pricing</div>
                  <div className="pl-3 text-signal-soft">v03 · animations</div>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <div className="self-end max-w-[80%] rounded-2xl rounded-br-sm bg-graphite px-4 py-2 text-sm">
                    Build a premium SaaS landing page for an AI CRM. Dark, purple accent, pricing + FAQ.
                  </div>
                  <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm border border-graphite px-4 py-2 text-sm text-fog">
                    <span className="font-mono text-[11px] text-signal-soft">Planner → Builder → Designer → SEO</span>
                    <br />
                    Built 7 sections, 3 pricing tiers, FAQ with schema. Health 96/100. Ready to deploy.
                  </div>
                  <div className="mt-auto flex gap-2">
                    <div className="input flex-1 text-ash">Make the hero headline bolder…</div>
                    <span className="btn btn-signal btn-sm">Run</span>
                  </div>
                </div>
                <div className="hidden md:block border-l border-graphite p-3 text-xs space-y-2">
                  <div className="label">AI team</div>
                  {["Builder", "Designer", "Copywriter", "SEO", "Debugger", "Performance"].map((a, i) => (
                    <div key={a} className="flex items-center justify-between">
                      <span className="text-fog">{a}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${i < 2 ? "bg-success pulse-dot" : "bg-graphite"}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="py-24 border-t border-graphite">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label">The whole workflow</p>
            <h2 className="heading mt-3 max-w-2xl">Not just prompt → code. Idea → production.</h2>
            <div className="mt-10 flex flex-wrap gap-2">
              {flow.map((s, i) => (
                <span key={s} className="flex items-center gap-2 text-sm">
                  <span className="pill">{s}</span>
                  {i < flow.length - 1 && <span className="text-ash">→</span>}
                </span>
              ))}
            </div>
            <div className="mt-14 grid md:grid-cols-3 gap-5">
              {[
                ["Multi-model AI router", "Simple edits go to fast models; architecture goes to premium reasoning. You pay in credits, never in tokens."],
                ["Agent teams", "Planner, Builder, Designer, Copywriter, SEO, Debugger, QA and 20+ more, orchestrated per task."],
                ["Templates & prompts", "Launch with production-ready templates and a prompt library. Remix any template with one sentence."],
                ["Live preview & visual editing", "Watch the site stream in, edit code with a real editor, or click to change text and colours."],
                ["Version history & rollback", "Every AI action is a checkpoint. Restore any version with one click."],
                ["Deploy & domains", "Publish to your idaevia.app subdomain instantly, export the code, or connect your own domain."],
              ].map(([t, d]) => (
                <div key={t} className="card p-6">
                  <h3 className="font-medium">{t}</h3>
                  <p className="mt-2 text-sm text-ash">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="agents" className="py-24 border-t border-graphite bg-ink/40">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label">AI agent catalog</p>
            <h2 className="heading mt-3">{AGENTS.length} specialised agents. One team.</h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {AGENTS.sort((a, b) => a.order - b.order).map((a) => (
                <div key={a.id} className="card px-4 py-3 flex items-center gap-3">
                  <span className="font-mono text-[11px] text-ash w-6">{String(a.order).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-ash truncate">{a.short}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="templates" className="py-24 border-t border-graphite">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label">Templates</p>
            <h2 className="heading mt-3">{TEMPLATES.length} production-ready templates at launch</h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {TEMPLATES.slice(0, 8).map((t) => (
                <div key={t.id} className="card overflow-hidden">
                  <div className="h-28 grid place-items-center text-sm font-medium" style={{ background: t.palette.bg, color: t.palette.text }}>
                    <span className="rounded-full px-3 py-1 text-xs" style={{ background: t.palette.accent, color: t.palette.accentText }}>{t.brand}</span>
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-ash mt-1">{t.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 border-t border-graphite">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label">Plans</p>
            <h2 className="heading mt-3">Capability, models, agents and credits — per plan.</h2>
            <div className="mt-10 grid md:grid-cols-5 gap-3">
              {PLAN_ORDER.map((id) => {
                const p = PLANS[id];
                return (
                  <div key={id} className={`card p-5 ${id === "PRO" ? "border-signal" : ""}`}>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">${p.price}<span className="text-sm text-ash font-normal">/mo</span></div>
                    <div className="mt-3 text-xs text-ash">{p.credits.toLocaleString()} credits · {p.agentLimit === "all" ? "all" : p.agentLimit} agents</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8"><Link href="/pricing" className="btn btn-outline">Compare plans</Link></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-graphite py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ash">
          <Logo size={22} />
          <div>Build anything. Ship everything. © {new Date().getFullYear()} IDÆVIA</div>
        </div>
      </footer>
    </div>
  );
}
