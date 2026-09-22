import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LandingFx } from "@/components/LandingFx";
import { MobileNav } from "@/components/MobileNav";
import { BrandIcon, type BrandIconName } from "@/components/BrandIcon";
import { DownloadButton } from "@/components/landing/DownloadButton";
import { AgentTeamSection, AudienceTabs, RoleTabs } from "@/components/landing/Showcase";
import { HeroBlob } from "@/components/HeroBlob";
import { getCurrentUser } from "@/lib/auth";
import { CREDIT_GUIDE, PLANS, PLAN_ORDER, TIER_LABELS } from "@/lib/plans";
import { AGENTS } from "@/lib/agents";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates";

const FEATURES: { title: string; text: string; icon: BrandIconName }[] = [
  { title: "30 specialist agents", text: "Builder, Designer, Copywriter, Database, Deploy, QA, Security and more. Each one introduces itself, does its part and reports back.", icon: "agents" },
  { title: "Websites and React apps", text: "Single-page sites or multi-file React + TypeScript apps with a live in-browser sandbox and a real code editor.", icon: "code" },
  { title: "Real terminal", text: "git push, deploy vercel, supabase link, env set. Commands run for real with full logs.", icon: "terminal" },
  { title: "Client portal", text: "Share a link. Clients preview, comment and approve without an account. Feedback flows back to the agents.", icon: "share" },
  { title: "Templates and marketplace", text: `${TEMPLATES.length} templates across ${TEMPLATE_CATEGORIES.length} categories, plus ready-made prompts, components and effects you can drop into your project. Sell your own work on the marketplace and keep 90%.`, icon: "marketplace" },
  { title: "Versions and audits", text: "Every change is a version you can roll back. Production audit for performance, SEO, accessibility and security.", icon: "versions" },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-void text-paper landing">
      <LandingFx />
      {/* Roaming 3D blob: fixed layer behind the content, flies around the whole page and reacts to the pointer */}
      <div className="hidden lg:block fixed left-0 top-0 w-[340px] h-[340px] xl:w-[400px] xl:h-[400px] opacity-70 pointer-events-none z-0 will-change-transform"><HeroBlob roam className="absolute inset-0 [&>canvas]:w-full [&>canvas]:h-full" /></div>

      <header className="sticky top-0 z-40 bg-void/80 backdrop-blur-xl border-b border-graphite/70">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-7 text-[15px] text-fog">
            <a href="#features" className="hover:text-paper transition">Features</a>
            <a href="#agents" className="hover:text-paper transition">Agents</a>
            <a href="#templates" className="hover:text-paper transition">Templates</a>
            <a href="#pricing" className="hover:text-paper transition">Pricing</a>
            <Link href="/docs" className="hover:text-paper transition">Docs</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? <Link href="/app" className="hidden md:inline-flex btn btn-ghost btn-sm">Open workspace</Link> : <Link href="/login" className="hidden md:inline-flex btn btn-ghost btn-sm">Log in</Link>}
            <span className="hidden md:inline-flex"><DownloadButton size="sm" loggedIn={Boolean(user)} /></span>
            <MobileNav loggedIn={Boolean(user)} />
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden stars snap-section lg:min-h-[calc(100vh-4rem)] flex flex-col justify-center">
          <div className="guide-x" />
          <div className="relative z-10 max-w-[1400px] mx-auto px-8 md:px-12 pt-20 md:pt-24 pb-14 md:pb-20 text-center">
            <h1 className="display-hero max-w-6xl mx-auto">
              <span className="word" style={{ animationDelay: "100ms" }}>Where</span>{" "}
              <span className="word agents-chip" style={{ animationDelay: "220ms" }}><BrandIcon name="agents" size={28} strokeWidth={1.8} className="agents-chip-icon" />agents</span>{" "}
              <span className="word" style={{ animationDelay: "340ms" }}>build for you</span>
            </h1>
            <p className="reveal in mt-6 md:mt-7 text-base md:text-xl text-fog max-w-2xl mx-auto" style={{ transitionDelay: "450ms" }}>
              One workspace for websites and apps. Describe it, a team of 30 AI agents designs, builds, tests and deploys it, all from your real code.
            </p>
            <div className="reveal in mt-8 md:mt-9 flex flex-col items-center gap-3" style={{ transitionDelay: "600ms" }}>
              <DownloadButton loggedIn={Boolean(user)} />
            </div>
          </div>
          <div className="guide-x bottom" />
        </section>

        {/* WHO IT'S FOR + PRODUCT */}
        <section className="py-14 md:py-16 snap-section lg:min-h-screen flex flex-col justify-center">
          <div className="max-w-[1400px] mx-auto px-8 md:px-12 w-full">
            <AudienceTabs />
          </div>
        </section>

        {/* AGENT TEAM (scroll-driven) */}
        <section id="agents" className="py-12 md:py-14 border-t border-graphite/70 guides snap-section lg:min-h-[calc(100vh-4rem)] flex flex-col justify-center">
          <div className="max-w-[1400px] mx-auto px-8 md:px-12 w-full">
            <AgentTeamSection heading={<>Give every idea<br />a team of {AGENTS.length} agents</>} intro="Assign work like you would to teammates. The Router picks the right specialist, each agent says what it will do, does it, and reports back in the chat." catalogHref={user ? "/app/agents" : "/signup"} count={AGENTS.length} />
          </div>
        </section>

        {/* FOR WHOM */}
        <section id="features" className="py-12 md:py-14 border-t border-graphite/70 guides snap-section lg:min-h-[calc(100vh-4rem)] flex flex-col justify-center">
          <div className="max-w-[1400px] mx-auto px-8 md:px-12 w-full">
            <RoleTabs />
          </div>
        </section>

        {/* FEATURE GRID */}
        <section className="py-16 md:py-24 border-t border-graphite/70 snap-section lg:min-h-screen flex flex-col justify-center">
          <div className="max-w-[1400px] mx-auto px-8 md:px-12 w-full">
            <p className="label reveal">Everything included</p>
            <h2 className="heading mt-3 max-w-2xl reveal-text">Not just prompt to code. Idea to production.</h2>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-graphite/60 rounded-3xl overflow-hidden" data-stagger>
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-[#0b0b0d] p-7 md:p-8 hover:bg-[#101013] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-paper"><BrandIcon name={f.icon} size={17} strokeWidth={1.7} /></div>
                  <h3 className="mt-5 text-base font-medium">{f.title}</h3>
                  <p className="mt-2 text-sm text-fog/90 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TEMPLATES */}
        <section id="templates" className="py-16 md:py-24 border-t border-graphite/70 guides snap-section lg:min-h-screen flex flex-col justify-center">
          <div className="max-w-[1400px] mx-auto px-8 md:px-12 w-full">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="label reveal">Templates</p>
                <h2 className="heading mt-3 max-w-2xl reveal-text">{TEMPLATES.length} templates, remixable with one sentence.</h2>
              </div>
              <div className="flex flex-wrap gap-2 reveal" data-stagger>{TEMPLATE_CATEGORIES.slice(0, 10).map((c) => <span key={c} className="pill text-[11px]">{c}</span>)}</div>
            </div>
            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-stagger>
              {TEMPLATES.slice(0, 12).map((t) => (
                <Link key={t.id} href={user ? `/app/templates?category=${encodeURIComponent(t.category)}` : "/signup"} className="group rounded-2xl border border-graphite bg-[#0f0f11] overflow-hidden hover:border-white/20 transition">
                  <div className="h-24 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${t.palette.bg}, ${t.palette.surface})` }}>
                    <div className="absolute inset-x-4 top-4 h-2 rounded" style={{ background: t.palette.accent, opacity: 0.9 }} />
                    <div className="absolute inset-x-4 top-9 h-1.5 w-1/2 rounded" style={{ background: t.palette.muted, opacity: 0.5 }} />
                    <div className="absolute inset-x-4 bottom-4 grid grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="h-5 rounded" style={{ background: t.palette.border }} />)}</div>
                  </div>
                  <div className="px-3 py-2.5"><div className="text-xs font-medium truncate">{t.name}</div><div className="text-[10px] text-ash">{t.category}</div></div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-16 md:py-24 border-t border-graphite/70 snap-section lg:min-h-screen flex flex-col justify-center">
          <div className="max-w-[1400px] mx-auto px-8 md:px-12 w-full">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="label reveal">Pricing</p>
                <h2 className="heading mt-3 max-w-2xl reveal-text">Simple plans. Credits for everything the agents do.</h2>
              </div>
              <Link href="/pricing" className="btn btn-ghost btn-sm reveal self-start md:self-auto">Compare every feature →</Link>
            </div>
            <div className="mt-10 grid md:grid-cols-2 xl:grid-cols-4 gap-4" data-stagger>
              {PLAN_ORDER.filter((id) => id !== "FREE").map((id) => {
                const p = PLANS[id];
                const featured = id === "PRO";
                return (
                  <div key={id} className={`rounded-3xl border p-7 flex flex-col bg-[#0f0f11] ${featured ? "border-signal/60" : "border-graphite"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-medium">{p.name}</div>
                      {featured && <span className="pill border-signal text-signal-soft text-[10px]">Most popular</span>}
                      {p.discountPct && <span className="pill border-success/40 text-success text-[10px]">Save {p.discountPct}%</span>}
                    </div>
                    <p className="mt-1 text-sm text-ash">{p.tagline}</p>
                    <div className="mt-6 flex items-baseline gap-2"><span className="text-4xl font-semibold tracking-tight">${p.price}</span><span className="text-sm text-ash">/month</span>{p.listPrice && <span className="text-sm text-ash line-through">${p.listPrice}</span>}</div>
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                      <div><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Credits</dt><dd className="mt-0.5 font-medium">{p.credits.toLocaleString()}<span className="text-ash font-normal">/mo</span></dd></div>
                      <div><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">≈ Pages</dt><dd className="mt-0.5 font-medium">{Math.round(p.credits / CREDIT_GUIDE.page)}</dd></div>
                      <div><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Agents</dt><dd className="mt-0.5 font-medium">{p.agentLimit === "all" ? `All ${AGENTS.length}` : p.agentLimit}</dd></div>
                      <div><dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-ash">Top model</dt><dd className="mt-0.5 font-medium text-[13px] leading-snug">{TIER_LABELS[p.maxTier].split(" · ").map((m) => <span key={m} className="block">{m}</span>)}</dd></div>
                    </dl>
                    <ul className="mt-5 space-y-2 text-sm text-fog flex-1">{p.highlights.slice(0, 4).map((f) => <li key={f} className="flex gap-2.5"><span className="text-signal-soft">✓</span><span>{f}</span></li>)}</ul>
                    <Link href={`/api/billing/checkout?plan=${id}`} className={`btn mt-7 ${featured ? "btn-signal btn-glow" : "btn-outline"}`}>Choose {p.name}</Link>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-3xl border border-graphite bg-[#0f0f11] px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center gap-4 reveal-up">
              <div className="md:w-56 shrink-0"><div className="text-lg font-medium">Free</div><div className="text-sm text-ash">{PLANS.FREE.tagline}</div></div>
              <ul className="flex-1 flex flex-wrap gap-x-8 gap-y-2 text-sm text-fog"><li className="flex items-center gap-2"><span className="text-signal-soft">✓</span>{PLANS.FREE.credits} credits every month</li>{PLANS.FREE.highlights.map((f) => <li key={f} className="flex items-center gap-2"><span className="text-signal-soft">✓</span>{f}</li>)}</ul>
              <Link href={user ? "/app" : "/signup"} className="btn btn-outline shrink-0">Start free</Link>
            </div>
          </div>
        </section>

        {/* DOWNLOAD CTA */}
        <section className="py-20 md:py-32 border-t border-graphite/70 relative overflow-hidden stars snap-section lg:min-h-[70vh] flex flex-col justify-center">
          <div className="relative max-w-3xl mx-auto px-6 text-center reveal-up">
            <h2 className="display !text-[clamp(34px,6vw,64px)]">Build your first product tonight.</h2>
            <p className="mt-5 text-lg text-fog">Desktop app for macOS and Windows, or the web app in any browser. Same account, same projects, same team.</p>
            <div className="mt-10 flex flex-col items-center gap-3"><DownloadButton loggedIn={Boolean(user)} /></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-graphite py-10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ash">
          <Logo size={22} />
          <nav className="flex flex-wrap justify-center gap-4 text-xs">
            <Link href="/pricing" className="hover:text-paper">Pricing</Link>
            <Link href="/download" className="hover:text-paper">Download</Link>
            <Link href="/docs" className="hover:text-paper">Docs</Link>
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
