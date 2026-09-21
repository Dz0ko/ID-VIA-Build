import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LandingFx } from "@/components/LandingFx";
import { HeroBlob } from "@/components/HeroBlob";
import { getCurrentUser } from "@/lib/auth";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { AGENTS } from "@/lib/agents";
import { TEMPLATES } from "@/lib/templates";
import { EFFECTS, COMPONENTS } from "@/lib/library";

const STEPS = [
  { n: "01", title: "Describe it", text: "Name the project and write a prompt. A landing page, a SaaS site, a dashboard, an app. Or start from one of the templates." },
  { n: "02", title: "Build with your AI team", text: "The Builder streams the first version in seconds. Keep chatting: add sections, remove things, change copy, colours and layout. Every change is a saved version." },
  { n: "03", title: "Refine with agents", text: "Designer, Copywriter, Animation, SEO and 25 more specialists. One-click workflows like Make it Premium and Production Ready." },
  { n: "04", title: "Test and audit", text: "Run the production audit for performance, SEO, accessibility, security and mobile. Fix everything with the Debugger in one click." },
  { n: "05", title: "Share and approve", text: "Send a client portal link. Clients preview, comment and approve without an account. Feedback flows back into the Builder." },
  { n: "06", title: "Launch with a guide", text: "Export the code or publish a preview link. The Deploy agent writes a personalised launch guide for your project: which database and hosting to use, how to set up your domain and go live, step by step." },
];

const FEATURES = [
  ["Multi-model AI router", "Small edits go to fast models, architecture goes to premium reasoning. You spend credits, never tokens."],
  ["30 agents, one team", "Planner, Builder, Designer, Copywriter, SEO, Debugger, QA, 3D, Animation and more, orchestrated per task."],
  ["Templates, prompts, effects", "Production-ready templates, a prompt library, a component library and hover, scroll, cursor and 3D effects."],
  ["Screenshot and URL to site", "Attach reference images or point at a live page. IDÆVIA recreates the structure as original, editable code."],
  ["Live preview and real code", "Watch the site stream in, then edit in a real code editor. React apps run in a live in-browser sandbox."],
  ["Versions, portal, marketplace", "Rollback to any version, collect client approvals, and publish your own templates, prompts and agents."],
];

const words = "Build anything. Ship everything.".split(" ");

export default async function Home() {
  const user = await getCurrentUser();
  const marqueeItems = [...TEMPLATES.slice(0, 10).map((t) => t.name), ...EFFECTS.slice(0, 8).map((e) => e.name), ...COMPONENTS.slice(0, 6).map((c) => c.name)];
  return (
    <div className="min-h-screen bg-void text-paper overflow-x-hidden">
      <LandingFx />
      <header className="sticky top-0 z-40 border-b border-graphite/80 bg-void/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-fog">
            <a href="#how" className="hover:text-paper transition">How it works</a>
            <a href="#product" className="hover:text-paper transition">Product</a>
            <a href="#agents" className="hover:text-paper transition">Agents</a>
            <a href="#templates" className="hover:text-paper transition">Templates</a>
            <a href="#pricing" className="hover:text-paper transition">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/app" className="btn btn-primary btn-sm" data-magnetic>Open workspace</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
                <Link href="/signup" className="btn btn-primary btn-sm" data-magnetic>Start building</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative min-h-[92vh] flex items-center overflow-hidden" data-spotlight>
          <HeroBlob className="absolute inset-0 -z-0 [&>canvas]:w-full [&>canvas]:h-full" />
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_100%,rgba(245,185,66,0.10),transparent_60%),radial-gradient(60%_50%_at_50%_0%,rgba(91,92,255,0.14),transparent_70%)] pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-28 text-center w-full">
            <span className="pill font-mono text-[11px] tracking-[0.18em] uppercase bg-void/60 backdrop-blur">AI Software Creation Platform</span>
            <h1 className="display mt-8 max-w-4xl mx-auto" aria-label="Build anything. Ship everything.">
              {words.map((w, i) => (
                <span key={i} className="word mr-[0.22em]" style={{ animationDelay: `${120 + i * 110}ms` }}>
                  {i === 3 ? <span className="text-shimmer">{w}</span> : w}
                </span>
              ))}
            </h1>
            <p className="reveal in mt-8 text-lg text-fog max-w-2xl mx-auto" style={{ transitionDelay: "500ms" }}>
              Describe it. IDÆVIA plans, designs and builds your website, SaaS or app with a team of AI agents, then tests, optimises and guides you to launch.
            </p>
            <div className="reveal in mt-10 flex flex-wrap items-center justify-center gap-3" style={{ transitionDelay: "650ms" }}>
              <Link href={user ? "/app" : "/signup"} className="btn btn-signal btn-glow px-7 py-3.5 text-base" data-magnetic>Start building free</Link>
              <a href="#how" className="btn btn-outline px-7 py-3.5 text-base bg-void/50 backdrop-blur" data-magnetic>See how it works</a>
            </div>

            {/* Floating glass cards */}
            <div className="relative mt-24 h-56 max-w-5xl mx-auto hidden md:block pointer-events-none">
              <div className="glass rounded-2xl p-4 text-left w-64 absolute left-0 top-0 float pointer-events-auto card-shine" data-tilt="10">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-ash"><span>Agent team</span><span className="w-5 h-5 rounded-full bg-paper text-void grid place-items-center">↗</span></div>
                <div className="mt-3 text-sm font-medium">Planner → Builder → Designer → SEO</div>
                <div className="mt-2 flex gap-1.5">{["Builder", "Designer", "SEO"].map((a, i) => <span key={a} className="pill text-[10px]"><span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${i < 2 ? "bg-success pulse-dot" : "bg-ash"}`} />{a}</span>)}</div>
              </div>
              <div className="glass rounded-2xl p-4 text-left w-56 absolute right-0 top-10 float-delay pointer-events-auto card-shine" data-tilt="10">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-ash"><span>Project health</span><span className="w-5 h-5 rounded-full bg-paper text-void grid place-items-center">↗</span></div>
                <div className="mt-2 text-4xl font-semibold tracking-tight">96<span className="text-lg text-ash">/100</span></div>
                <div className="mt-2 h-1 rounded-full bg-graphite overflow-hidden"><div className="h-full w-[96%] bg-gradient-to-r from-signal to-[#f5c04a]" /></div>
              </div>
              <div className="glass rounded-2xl p-4 text-left w-72 absolute left-1/2 -translate-x-1/2 bottom-0 float pointer-events-auto card-shine" data-tilt="10" style={{ animationDelay: "0.7s" }}>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Prompt</div>
                <div className="mt-2 text-sm text-fog">“Build a premium SaaS landing page for an AI CRM. Dark, gold accents, pricing and FAQ.”</div>
                <div className="mt-3 text-[11px] text-success">✓ v03 built · 7 sections · 24 credits</div>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee */}
        <div className="border-y border-graphite bg-ink/40 py-4 overflow-hidden">
          <div className="marquee gap-10 text-sm text-ash">
            {[...marqueeItems, ...marqueeItems].map((m, i) => <span key={i} className="whitespace-nowrap flex items-center gap-3"><span className="w-1 h-1 rounded-full bg-signal" />{m}</span>)}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section id="how" className="py-28">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">How it works</p>
            <h2 className="heading mt-3 max-w-2xl reveal">From an idea to a live product, step by step.</h2>
            <div className="mt-14 grid md:grid-cols-2 gap-x-10 gap-y-8">
              {STEPS.map((s) => (
                <div key={s.n} className="reveal flex gap-5">
                  <div className="flex flex-col items-center"><span className="font-mono text-signal-soft text-sm">{s.n}</span><span className="w-px flex-1 mt-2 step-line opacity-60" /></div>
                  <div className="pb-4"><h3 className="text-lg font-medium">{s.title}</h3><p className="mt-2 text-sm text-ash leading-relaxed">{s.text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRODUCT */}
        <section id="product" className="py-28 border-t border-graphite" data-spotlight>
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">The whole workflow</p>
            <h2 className="heading mt-3 max-w-2xl reveal">Not just prompt to code. Idea to production.</h2>
            <div className="mt-14 grid md:grid-cols-3 gap-5">
              {FEATURES.map(([t, d]) => (
                <div key={t} className="card card-shine p-6 reveal" data-tilt="7">
                  <div className="w-9 h-9 rounded-xl bg-signal/15 text-signal-soft grid place-items-center mb-4"><span className="w-2 h-2 rounded-full bg-signal" /></div>
                  <h3 className="font-medium">{t}</h3>
                  <p className="mt-2 text-sm text-ash leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AGENTS */}
        <section id="agents" className="py-28 border-t border-graphite bg-ink/40">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">AI agent catalog</p>
            <h2 className="heading mt-3 reveal">{AGENTS.length} specialised agents. One team.</h2>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...AGENTS].sort((a, b) => a.order - b.order).map((a) => (
                <div key={a.id} className="card card-shine px-4 py-3 flex items-center gap-3 reveal" data-tilt="5">
                  <span className="font-mono text-[11px] text-ash w-6">{String(a.order).padStart(2, "0")}</span>
                  <div className="min-w-0"><div className="text-sm font-medium">{a.name}</div><div className="text-xs text-ash truncate">{a.short}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TEMPLATES */}
        <section id="templates" className="py-28 border-t border-graphite">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">Templates</p>
            <h2 className="heading mt-3 reveal">{TEMPLATES.length} production-ready templates, remixable with one sentence.</h2>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {TEMPLATES.slice(0, 8).map((t) => (
                <div key={t.id} className="card card-shine overflow-hidden reveal group" data-tilt="8">
                  <div className="h-32 grid place-items-center relative overflow-hidden" style={{ background: t.palette.bg, color: t.palette.text }}>
                    <div className="absolute inset-0 opacity-60 transition-transform duration-700 group-hover:scale-125" style={{ background: `radial-gradient(60% 60% at 50% 0%, ${t.palette.accent}55, transparent 70%)` }} />
                    <span className="relative rounded-full px-3 py-1 text-xs font-medium" style={{ background: t.palette.accent, color: t.palette.accentText }}>{t.brand}</span>
                  </div>
                  <div className="p-4"><div className="text-sm font-medium">{t.name}</div><div className="text-xs text-ash mt-1">{t.category}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-28 border-t border-graphite" data-spotlight>
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">Plans</p>
            <h2 className="heading mt-3 reveal">Capability, models, agents and credits per plan.</h2>
            <div className="mt-12 grid md:grid-cols-2 xl:grid-cols-5 gap-4">
              {PLAN_ORDER.map((id) => {
                const p = PLANS[id];
                const featured = id === "PRO";
                return (
                  <div key={id} className={`card card-shine p-5 flex flex-col reveal ${featured ? "border-signal" : ""}`} data-tilt="4">
                    {featured && <span className="pill self-start border-signal text-signal-soft mb-3 text-[10px]">Most popular</span>}
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">${p.price}<span className="text-sm text-ash font-normal">/mo</span></div>
                    <div className="mt-1 text-xs text-ash">{p.tagline}</div>
                    <ul className="mt-4 space-y-1.5 text-xs text-fog flex-1">
                      {p.features.map((f) => <li key={f} className="flex gap-2"><span className="text-signal-soft shrink-0">✓</span><span>{f}</span></li>)}
                    </ul>
                    <Link href={id === "FREE" ? (user ? "/app" : "/signup") : `/api/billing/checkout?plan=${id}`} className={`btn btn-sm mt-5 ${featured ? "btn-signal" : "btn-outline"}`}>{id === "FREE" ? "Start free" : `Choose ${p.name}`}</Link>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-xs text-ash reveal">Credits measure AI usage: renaming a button costs about 1 credit, a full page 8 to 40, a full-stack feature 75 or more. Extra credit packs are available on every paid plan.</p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-28 border-t border-graphite relative overflow-hidden" data-spotlight>
          <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(91,92,255,0.18),transparent_70%)] pointer-events-none" />
          <div className="relative max-w-3xl mx-auto px-6 text-center reveal">
            <h2 className="display text-[44px] md:text-[64px]">Describe what you want to build.</h2>
            <p className="mt-6 text-lg text-fog">IDÆVIA builds it with you.</p>
            <div className="mt-10"><Link href={user ? "/app" : "/signup"} className="btn btn-signal btn-glow px-8 py-4 text-base" data-magnetic>Start building free</Link></div>
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
