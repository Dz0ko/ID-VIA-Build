import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LandingFx } from "@/components/LandingFx";
import { HeroBlob } from "@/components/HeroBlob";
import { MobileNav } from "@/components/MobileNav";
import { BrandIcon, agentIcon, type BrandIconName } from "@/components/BrandIcon";
import { getCurrentUser } from "@/lib/auth";
import { CREDIT_GUIDE, PLANS, PLAN_ORDER, TIER_LABELS } from "@/lib/plans";
import { AGENTS } from "@/lib/agents";
import { TEMPLATES } from "@/lib/templates";

const STEPS: { n: string; icon: BrandIconName; title: string; text: string }[] = [
  { n: "01", icon: "describe", title: "Describe it", text: "Name the project and write a prompt. A landing page, a SaaS site, a dashboard, an app. Or start from one of the templates." },
  { n: "02", icon: "build", title: "Build with your AI team", text: "The Builder streams the first version in seconds. Keep chatting: add sections, remove things, change copy, colours and layout. Every change is a saved version." },
  { n: "03", icon: "router", title: "The right agent, automatically", text: "You just describe what you want. IDÆVIA reads the request and switches on the specialist that fits: Designer for looks, Copywriter for text, SEO, Animation, Debugger and 25 more. One-click workflows like Make it Premium and Production Ready run whole teams." },
  { n: "04", icon: "audit", title: "Test and audit", text: "Run the production audit for performance, SEO, accessibility, security and mobile. Fix everything with the Debugger in one click." },
  { n: "05", icon: "share", title: "Share and approve", text: "Send a client portal link. Clients preview, comment and approve without an account. Feedback flows back into the Builder." },
  { n: "06", icon: "launch", title: "Launch with a guide", text: "Export the code or publish a preview link. The Deploy agent writes a personalised launch guide for your project: which database and hosting to use, how to set up your domain and go live, step by step." },
];

const FEATURES: [string, string, BrandIconName][] = [
  ["Multi-model AI router", "Small edits go to fast models, architecture goes to Claude Opus 5, and the frontier tier puts Claude Fable 5.1 and GPT-6 Astra one click away. You spend credits, never tokens.", "router"],
  ["30 agents, one team", "Planner, Builder, Designer, Copywriter, SEO, Debugger, QA, 3D, Animation and more, orchestrated per task.", "agents"],
  ["Templates, prompts, effects", "Production-ready templates, a prompt library, a component library and hover, scroll, cursor and 3D effects.", "library"],
  ["Screenshot and URL to site", "Attach reference images or point at a live page. IDÆVIA recreates the structure as original, editable code.", "screenshot"],
  ["Live preview and real code", "Watch the site stream in, then edit in a real code editor. React apps run in a live in-browser sandbox.", "code"],
  ["Versions, portal, marketplace", "Rollback to any version, collect client approvals, and publish your own templates, prompts and agents.", "versions"],
];

const AGENT_GROUPS: [string, string[]][] = [
  ["Core", ["builder", "planner", "designer", "copywriter", "debugger", "seo"]],
  ["Design and content", ["ui", "ux", "animation", "3d", "asset", "localization", "asset-ref", "clone"]],
  ["Quality", ["performance", "accessibility", "security", "qa", "refactoring", "dependency"]],
  ["Full-stack and launch", ["database", "api", "auth", "payments", "git", "deploy", "analytics", "conversion", "documentation", "pm"]],
];

const words = "Build anything. Ship everything.".split(" ");



export default async function Home() {
  const user = await getCurrentUser();
  const agentById = new Map(AGENTS.map((a) => [a.id, a]));
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
          <div className="flex items-center gap-2 md:gap-3">
            {user ? (
              <Link href="/app" className="btn btn-primary btn-sm hidden md:inline-flex" data-magnetic>Open workspace</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm hidden md:inline-flex">Log in</Link>
                <Link href="/signup" className="btn btn-primary btn-sm hidden md:inline-flex" data-magnetic>Start building</Link>
              </>
            )}
            <MobileNav loggedIn={Boolean(user)} />
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden" data-spotlight>
          <div className="hidden md:block absolute inset-0 -z-0"><HeroBlob className="absolute inset-0 [&>canvas]:w-full [&>canvas]:h-full" /></div>
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_100%,rgba(245,185,66,0.10),transparent_60%),radial-gradient(60%_50%_at_50%_0%,rgba(91,92,255,0.14),transparent_70%)] pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-16 sm:pt-24 md:pt-32 pb-14 md:pb-24 text-center w-full">
            <h1 className="display max-w-4xl mx-auto" aria-label="Build anything. Ship everything.">
              {words.map((w, i) => (
                <span key={i} className="word mr-[0.22em]" style={{ animationDelay: `${120 + i * 110}ms` }}>
                  {i === 3 ? <span className="text-shimmer">{w}</span> : w}
                </span>
              ))}
            </h1>
            <p className="reveal in mt-6 md:mt-8 text-base sm:text-lg md:text-xl text-fog max-w-2xl mx-auto" style={{ transitionDelay: "500ms" }}>
              <span className="md:hidden">Describe it in one sentence. 30 AI agents design, build and launch your website or app.</span>
              <span className="hidden md:inline">Type one sentence. A team of 30 AI agents plans, designs and builds your website, SaaS or app, then tests it, optimises it and walks you to launch. Your first version is live in under a minute.</span>
            </p>
            <div className="reveal in mt-8 md:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto" style={{ transitionDelay: "650ms" }}>
              <Link href={user ? "/app" : "/signup"} className="btn btn-signal btn-glow px-8 py-4 text-base" data-magnetic>
                {user ? "Open your workspace" : "Build your first project free"}
              </Link>
              <a href="#how" className="hidden sm:inline-flex btn btn-outline px-7 py-4 text-base bg-void/50 backdrop-blur" data-magnetic>See how it works</a>
              <a href="#how" className="sm:hidden text-sm text-fog underline underline-offset-4 py-2">See how it works ↓</a>
            </div>

            {/* Floating glass cards */}
            <div className="hidden md:grid mt-24 md:grid-cols-3 gap-5 max-w-5xl mx-auto text-left items-start">
              <div className="glass rounded-2xl p-5 float card-shine" data-tilt="10">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-ash"><span>Agent team</span><span className="w-6 h-6 rounded-full bg-paper text-void grid place-items-center">↗</span></div>
                <div className="mt-3 text-sm font-medium">Planner → Builder → Designer → SEO</div>
                <div className="mt-3 flex flex-wrap gap-1.5">{["Builder", "Designer", "SEO"].map((a, i) => <span key={a} className="pill text-[10px]"><span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${i < 2 ? "bg-success pulse-dot" : "bg-ash"}`} />{a}</span>)}</div>
              </div>
              <div className="glass rounded-2xl p-5 float card-shine md:mt-10" data-tilt="10" style={{ animationDelay: "0.7s" }}>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Prompt</div>
                <div className="mt-2 text-sm text-fog">“Build a premium SaaS landing page for an AI CRM. Dark, gold accents, pricing and FAQ.”</div>
                <div className="mt-3 text-[11px] text-success">✓ Full page · about 10 credits on Standard</div>
              </div>
              <div className="glass rounded-2xl p-5 float-delay card-shine md:mt-4" data-tilt="10">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-ash"><span>Publish</span><span className="w-6 h-6 rounded-full bg-paper text-void grid place-items-center">↗</span></div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-signal to-[#f5c04a] grid place-items-center text-[10px] font-medium text-void">v3</span>
                  <div className="min-w-0"><div className="text-sm font-medium">Live on your domain</div><div className="text-[11px] text-ash">Versions, rollback, client portal</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="text-fog">Export code any time</span>
                  <span className="pill text-[10px] border-success/40 text-success">Ready to launch</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="py-16 md:py-28 border-t border-graphite">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">How it works</p>
            <h2 className="heading mt-3 max-w-2xl reveal">From an idea to a live product, step by step.</h2>
            <div className="mt-14 grid md:grid-cols-2 gap-5">
              {STEPS.map((s, i) => (
                <div key={s.n} className={`glass-card rounded-3xl p-7 ${i % 2 ? "reveal-right" : "reveal-left"}`} data-tilt="7">
                  <div className="card-grid" />
                  <span className="card-arrow">↗</span>
                  <div className="card-body flex gap-5">
                    <div className="step-num"><BrandIcon name={s.icon} size={22} strokeWidth={1.6} /></div>
                    <div><h3 className="card-title text-lg font-medium">{s.title}</h3><p className="mt-3 text-sm text-fog/90 leading-relaxed">{s.text}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRODUCT */}
        <section id="product" className="py-16 md:py-28 border-t border-graphite" data-spotlight>
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">The whole workflow</p>
            <h2 className="heading mt-3 max-w-2xl reveal">Not just prompt to code. Idea to production.</h2>
            <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5" style={{ perspective: "1200px" }}>
              {FEATURES.map(([t, d, icon], i) => (
                <div key={t} className="glass-card rounded-3xl p-7 reveal-up" style={{ transitionDelay: `${i * 80}ms` }} data-tilt="12">
                  <div className="card-grid" />
                  <div className="card-body">
                    <div className="icon-orb"><BrandIcon name={icon} size={22} strokeWidth={1.6} /></div>
                    <h3 className="card-title mt-6 font-medium text-lg">{t}</h3>
                    <p className="mt-3 text-sm text-fog/90 leading-relaxed">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AGENTS */}
        <section id="agents" className="py-16 md:py-28 border-t border-graphite">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">AI agent catalog</p>
            <h2 className="heading mt-3 reveal">{AGENTS.length} specialised agents. One team.</h2>
            <p className="mt-4 text-fog max-w-2xl reveal">You never have to pick. Describe the change and IDÆVIA routes it to the right specialist, or pick one yourself.</p>
            <div className="mt-12 space-y-10">
              {AGENT_GROUPS.map(([group, ids]) => (
                <div key={group}>
                  <div className="label mb-4 reveal">{group}</div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {ids.map((id, i) => { const a = agentById.get(id); if (!a) return null; return (
                      <div key={id} className="agent-card glass-card rounded-2xl p-4 reveal-up" style={{ transitionDelay: `${i * 50}ms` }} data-tilt="8">
                        <div className="card-grid" />
                        <div className="card-body flex items-center gap-3">
                          <span className="agent-num w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-signal/40 to-[#f5c04a]/20 text-paper border border-paper/10 shadow-[inset_0_1px_0_rgba(255,255,255,.2)]"><BrandIcon name={agentIcon(id)} size={17} strokeWidth={1.7} /></span>
                          <div className="min-w-0"><div className="text-sm font-medium">{a.name}</div><div className="text-[11px] text-ash truncate">{a.short}</div></div>
                        </div>
                        <div className="mt-3 flex gap-1.5"><span className="pill text-[10px]">{a.tier} tier</span><span className="pill text-[10px]">{a.mode === "rewrite" ? "edits" : "report"}</span></div>
                      </div>
                    ); })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TEMPLATES */}
        <section id="templates" className="py-16 md:py-28 border-t border-graphite">
          <div className="max-w-6xl mx-auto px-6">
            <p className="label reveal">Templates</p>
            <h2 className="heading mt-3 reveal">{TEMPLATES.length} production-ready templates, remixable with one sentence.</h2>
            <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {TEMPLATES.slice(0, 8).map((t, i) => (
                <div key={t.id} className="glass-card rounded-2xl overflow-hidden reveal-up group" style={{ transitionDelay: `${i * 60}ms` }} data-tilt="8">
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
        <section id="pricing" className="py-16 md:py-28 border-t border-graphite" data-spotlight>
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="label reveal">Plans</p>
                <h2 className="heading mt-3 max-w-2xl reveal">Simple plans. Credits for everything the agents do.</h2>
              </div>
              <Link href="/pricing" className="btn btn-ghost btn-sm reveal self-start md:self-auto">Compare every feature →</Link>
            </div>

            <div className="mt-10 md:mt-12 grid md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 items-stretch">
              {PLAN_ORDER.filter((id) => id !== "FREE").map((id, i) => {
                const p = PLANS[id];
                const featured = id === "PRO";
                const pages = Math.round(p.credits / CREDIT_GUIDE.page);
                return (
                  <div key={id} className={`glass-card rounded-3xl p-8 flex flex-col reveal-up ${featured ? "ring-1 ring-signal" : ""}`} style={{ transitionDelay: `${i * 80}ms` }} data-tilt="4">
                    <div className="card-grid" />
                    <div className="card-body flex flex-col flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-medium">{p.name}</div>
                      {featured && <span className="pill border-signal text-signal-soft text-[10px]">Most popular</span>}
                      {p.discountPct && <span className="pill border-success/40 text-success text-[10px]">Save {p.discountPct}%</span>}
                    </div>
                    <p className="mt-1 text-sm text-ash">{p.tagline}</p>

                    <div className="mt-6 flex items-baseline gap-2">
                      <span className="text-5xl font-semibold tracking-tight">${p.price}</span>
                      <span className="text-sm text-ash">/month</span>
                      {p.listPrice && <span className="text-sm text-ash line-through">${p.listPrice}</span>}
                    </div>

                    <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-graphite bg-void/40 p-4 text-sm">
                      <div><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Credits</dt><dd className="mt-1 font-medium">{p.credits.toLocaleString()} <span className="text-ash font-normal">/mo</span></dd></div>
                      <div><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">≈ Full pages</dt><dd className="mt-1 font-medium">{pages}</dd></div>
                      <div><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Agents</dt><dd className="mt-1 font-medium">{p.agentLimit === "all" ? `All ${AGENTS.length} + custom` : p.agentLimit}</dd></div>
                      <div><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Projects</dt><dd className="mt-1 font-medium capitalize">{p.projectLimit}</dd></div>
                      <div className="col-span-2"><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Top model</dt><dd className="mt-1 font-medium">{TIER_LABELS[p.maxTier]}</dd></div>
                    </dl>

                    <ul className="mt-6 space-y-3 text-sm text-fog flex-1">
                      {p.highlights.map((f) => <li key={f} className="flex gap-3"><span className="mt-0.5 w-4 h-4 rounded-full bg-signal/15 text-signal-soft grid place-items-center text-[10px] shrink-0">✓</span><span>{f}</span></li>)}
                    </ul>

                    <Link href={`/api/billing/checkout?plan=${id}`} className={`btn mt-8 ${featured ? "btn-signal btn-glow" : "btn-outline"}`}>Choose {p.name}</Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Free banner */}
            <div className="mt-6 glass-card rounded-3xl px-6 md:px-8 py-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 reveal-up" data-tilt="2">
              <div className="md:w-56 shrink-0">
                <div className="text-lg font-medium">Free</div>
                <div className="text-sm text-ash">{PLANS.FREE.tagline}</div>
              </div>
              <ul className="flex-1 flex flex-wrap gap-x-8 gap-y-2 text-sm text-fog">
                <li className="flex items-center gap-2"><span className="text-signal-soft">✓</span>{PLANS.FREE.credits} credits every month</li>
                {PLANS.FREE.highlights.map((f) => <li key={f} className="flex items-center gap-2"><span className="text-signal-soft">✓</span>{f}</li>)}
              </ul>
              <Link href={user ? "/app" : "/signup"} className="btn btn-outline shrink-0">Start free</Link>
            </div>

            <p className="mt-8 text-xs text-ash reveal max-w-3xl">
              Credits measure what the agents do, never tokens: a small edit costs about {CREDIT_GUIDE.smallEdit} credits, a full page about {CREDIT_GUIDE.page}, a full-stack feature about {CREDIT_GUIDE.fullstack}. Paid plans can top up with credit packs at any time.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-28 border-t border-graphite relative overflow-hidden" data-spotlight>
          <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(91,92,255,0.18),transparent_70%)] pointer-events-none" />
          <div className="relative max-w-3xl mx-auto px-6 text-center reveal-up">
            <h2 className="display !text-[clamp(34px,7vw,64px)]">Describe what you want to build.</h2>
            <p className="mt-6 text-lg text-fog">IDÆVIA builds it with you.</p>
            <div className="mt-10"><Link href={user ? "/app" : "/signup"} className="btn btn-signal btn-glow px-8 py-4 text-base" data-magnetic>Start building free</Link></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-graphite py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ash">
          <Logo size={22} />
          <nav className="flex flex-wrap justify-center gap-4 text-xs">
            <Link href="/pricing" className="hover:text-paper">Pricing</Link>
            <Link href="/privacy" className="hover:text-paper">Privacy</Link>
            <Link href="/terms" className="hover:text-paper">Terms</Link>
            <Link href="/cookies" className="hover:text-paper">Cookies</Link>
            <a href="mailto:support@idaevia.app" className="hover:text-paper">support@idaevia.app</a>
          </nav>
          <div>© {new Date().getFullYear()} IDÆVIA</div>
        </div>
      </footer>
    </div>
  );
}
