"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandIcon, type BrandIconName } from "@/components/BrandIcon";

/** Native scrolling drives the steps; wheel, touch and keyboard input stay with the browser. */
function useStepScroll(count: number, allowTallPanel = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const navigate = useRef<((i: number) => void) | null>(null);

  useEffect(() => {
    const track = ref.current;
    const panel = track?.firstElementChild as HTMLElement | null;
    if (!track || !panel) return;
    const media = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let enabled = false;
    let distance = 0;
    let current = 0;
    let reservedHeight = 0;
    let stickyTop = 64;
    const select = (next: number) => {
      if (next !== current) { current = next; setIndex(next); }
    };
    const update = () => {
      frame = 0;
      if (!enabled) return;
      const progress = (stickyTop - track.getBoundingClientRect().top) / distance;
      select(Math.max(0, Math.min(count - 1, Math.floor(progress + 0.5))));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const measure = () => {
      // Tall team panels scroll their heading out of view before pinning the agent list.
      const height = panel.getBoundingClientRect().height;
      enabled = media.matches && (allowTallPanel || height <= window.innerHeight - 64);
      if (enabled) {
        reservedHeight = Math.max(reservedHeight, height);
        stickyTop = allowTallPanel ? Math.min(64, window.innerHeight - reservedHeight - 16) : 64;
        if (allowTallPanel) panel.style.minHeight = `${reservedHeight}px`;
        distance = Math.max(320, window.innerHeight * 0.6);
        track.style.height = `${reservedHeight + (count - 1) * distance}px`;
        panel.style.position = "sticky";
        panel.style.top = `${stickyTop}px`;
        update();
      } else {
        reservedHeight = 0;
        track.style.removeProperty("height");
        panel.style.removeProperty("position");
        panel.style.removeProperty("top");
        if (allowTallPanel) panel.style.removeProperty("min-height");
      }
    };
    navigate.current = (next) => {
      select(next);
      if (enabled) {
        const top = window.scrollY + track.getBoundingClientRect().top - stickyTop + next * distance;
        window.scrollTo({ top, behavior: "instant" });
      }
    };
    const onResize = () => {
      reservedHeight = 0;
      if (allowTallPanel) panel.style.removeProperty("min-height");
      measure();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    media.addEventListener("change", onResize);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", onResize);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      navigate.current = null;
      track.style.removeProperty("height");
      panel.style.removeProperty("position");
      panel.style.removeProperty("top");
      if (allowTallPanel) panel.style.removeProperty("min-height");
    };
  }, [count, allowTallPanel]);

  const set = (i: number) => {
    if (navigate.current) navigate.current(i);
    else setIndex(i);
  };
  return { ref, index, set };
}
/* ---------- Product frames (pure HTML/CSS mock-ups of the real product) ---------- */

function Frame({ children, title = "idaevia.app" }: { children: ReactNode; title?: string }) {
  return (
    <div className="product-window">
      <div className="product-window-surface text-left text-[12px] leading-relaxed">
        <div className="flex items-center gap-1.5 px-4 h-10 border-b border-white/10 bg-white/[.025]">
          <span className="w-2 h-2 rounded-full bg-white/20" /><span className="w-2 h-2 rounded-full bg-white/15" /><span className="w-2 h-2 rounded-full bg-white/10" />
          <span className="ml-3 text-[11px] text-white/45 font-mono truncate">{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

const Bubble = ({ who, role, children }: { who: string; role: string; children: ReactNode }) => (
  <div className="max-w-[560px] rounded-2xl border border-white/10 bg-white/[.03] px-3.5 py-2.5"><div className="font-mono text-[10px] text-[#8d8dff] mb-1">{who} <span className="text-white/35">· {role}</span></div><div className="text-white/80">{children}</div></div>
);

export function WorkspaceFrame() {
  return (
    <Frame>
      <div className="grid md:grid-cols-[220px_1fr] min-h-[420px]">
        <aside className="hidden md:block border-r border-white/10 p-3 space-y-1 text-white/60">
          <div className="text-[10px] font-mono uppercase tracking-[.14em] text-white/35 px-2 mb-2">Workspace</div>
          {["Dashboard", "Projects", "IDÆVIA Agent", "Templates", "Agents", "Marketplace", "Deployments", "Integrations"].map((x, i) => <div key={x} className={`px-2 py-1.5 rounded-md ${i === 1 ? "bg-white/10 text-white" : ""}`}>{x}</div>)}
        </aside>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-white/50"><span className="text-white font-medium">Nimbus · SaaS landing</span><span className="font-mono text-[10px]">v07 · 2,410 credits left</span></div>
          <div className="ml-auto max-w-[420px] rounded-2xl bg-white/10 px-3.5 py-2.5 text-white/85">Make the hero darker, add a pricing table with 3 plans and tighten the copy.</div>
          <Bubble who="Router" role="auto-routing">Two disciplines detected. Handing design to Designer, then Copywriter for the text.</Bubble>
          <Bubble who="Designer" role="Product designer">Designer picking this up. I&apos;ll darken the hero, set one accent and build a 3-plan pricing table with the middle plan elevated.</Bubble>
          <Bubble who="Copywriter" role="Conversion copywriter">Copy pass done in v07: headline states the outcome, each plan has one benefit line, one CTA per plan.</Bubble>
          <div className="flex gap-2 pt-1 text-[10px] text-white/45 font-mono"><span className="px-2 py-1 rounded bg-white/5">✓ v07 saved</span><span className="px-2 py-1 rounded bg-white/5">30 credits</span><span className="px-2 py-1 rounded bg-white/5">preview updated</span></div>
        </div>
      </div>
    </Frame>
  );
}

function BuilderFrame() {
  return (
    <Frame title="idaevia.app / builder">
      <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[140px_1fr] min-h-[420px]">
        <aside className="border-r border-white/10 p-3 text-white/45 font-mono text-[10px]">
          <div className="uppercase tracking-widest text-white/30 mb-5">Explorer</div>
          <div className="mb-3 text-white/70">⌄ nimbus</div>
          <div className="space-y-3 pl-2"><div>⌄ src</div><div className="rounded-md bg-white/10 text-white px-2 py-1.5 -ml-2">App.tsx</div><div>Hero.tsx</div><div>Pricing.tsx</div><div>styles.css</div></div>
          <div className="mt-8 text-emerald-300/80">✓ 4 files saved</div>
        </aside>
        <div className="min-w-0 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-white/80">App.tsx</span><span className="text-[10px] text-white/35">React · TSX</span></div>
          <div className="p-4 flex-1 font-mono text-[11px] leading-7 overflow-x-auto">
            <div className="text-white/30">01 <span className="text-violet-300">import</span> <span className="text-white/75">Hero</span> <span className="text-violet-300">from</span> <span className="text-emerald-200">&quot;./Hero&quot;</span></div>
            <div className="text-white/30">02 <span className="text-violet-300">import</span> <span className="text-white/75">Pricing</span> <span className="text-violet-300">from</span> <span className="text-emerald-200">&quot;./Pricing&quot;</span></div>
            <div className="text-white/30">03</div>
            <div className="text-white/30">04 <span className="text-violet-300">export default function</span> <span className="text-white/85">App() {'{'}</span></div>
            <div className="text-white/30">05 <span className="text-violet-300">  return</span> <span className="text-white/75">(</span></div>
            <div className="text-white/30">06 <span className="text-sky-200">    &lt;main&gt;</span></div>
            <div className="text-white/30">07 <span className="text-sky-200">      &lt;Hero /&gt;</span></div>
            <div className="text-white/30">08 <span className="text-sky-200">      &lt;Pricing /&gt;</span></div>
            <div className="text-white/30">09 <span className="text-sky-200">    &lt;/main&gt;</span></div>
            <div className="text-white/30">10 <span className="text-white/75">  ); {'}'}</span></div>
          </div>
          <div className="border-t border-white/10 bg-white/[.025] px-4 py-3"><div className="text-emerald-300 text-[11px]">✓ Build successful</div><div className="mt-1 text-[10px] text-white/40">Builder · components connected, preview ready</div></div>
        </div>
      </div>
    </Frame>
  );
}

function DesignerFrame() {
  return (
    <Frame title="idaevia.app / designer">
      <div className="grid grid-cols-[1fr_110px] sm:grid-cols-[1fr_150px] min-h-[420px]">
        <div className="p-4 sm:p-5 bg-white/[.015] min-w-0">
          <div className="flex items-center justify-between text-[10px] text-white/40"><span>Canvas / Desktop</span><span>100%</span></div>
          <div className="mt-5 rounded-lg border border-white/15 bg-[#111116] p-4 sm:p-5 shadow-xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3"><span className="text-white/80 font-medium">nimbus.</span><span className="text-[8px] text-white/40">Product · Pricing</span></div>
            <div className="relative mt-6 border border-violet-400/60 p-3"><span className="absolute -top-4 left-0 text-[8px] font-mono text-violet-300">Hero / Heading</span><h4 className="text-[clamp(18px,2vw,28px)] leading-tight tracking-tight text-white">Less busywork.<br />More possibility.</h4><span className="absolute -bottom-1 -right-1 size-1.5 bg-violet-300" /></div>
            <p className="mt-3 text-[10px] leading-relaxed text-white/45">A calmer place for your team to do its best work.</p>
            <div className="inline-block mt-4 rounded-md bg-violet-400 px-3 py-1.5 text-[9px] font-medium text-[#111116]">Start building →</div>
            <div className="grid grid-cols-3 gap-2 mt-6">{["Plan", "Build", "Launch"].map((label) => <div key={label} className="rounded-md border border-white/10 py-3 text-center text-[9px] text-white/50">{label}</div>)}</div>
          </div>
        </div>
        <aside className="border-l border-white/10 p-3 sm:p-4 text-[10px] text-white/45">
          <div className="uppercase tracking-widest text-white/30">Design</div>
          <div className="mt-6 text-white/75">Typography</div><div className="mt-2 text-2xl text-white/90 tracking-tight">Aa</div><div className="mt-1">Space Grotesk</div><div className="mt-2 font-mono text-white/30">48 / 52 · 600</div>
          <div className="mt-6 text-white/75">Palette</div><div className="mt-3 flex gap-1.5"><span className="size-5 rounded-full border border-white/20 bg-[#111116]" /><span className="size-5 rounded-full bg-violet-400" /><span className="size-5 rounded-full bg-white/90" /></div>
          <div className="mt-6 text-white/75">Spacing</div><div className="mt-2 font-mono">8 · 16 · 24 · 32</div>
          <div className="mt-7 pt-3 border-t border-white/10 text-violet-300">✓ Styles applied</div>
        </aside>
      </div>
    </Frame>
  );
}

export function TerminalFrame() {
  return (
    <Frame>
      <div className="p-4 font-mono text-[12px] text-white/75 min-h-[380px] space-y-1.5">
        <div><span className="text-[#8d8dff]">$</span> git push</div>
        <div className="text-white/50">→ Repository gorge/nimbus-landing</div>
        <div className="text-white/50">  Uploading 3 files…</div>
        <div className="text-white/50">    + index.html (41.2 KB)</div>
        <div className="text-emerald-400">✓ Pushed 3f9c2a1 to gorge/nimbus-landing@main</div>
        <div className="pt-2"><span className="text-[#8d8dff]">$</span> deploy vercel</div>
        <div className="text-white/50">→ Creating deployment &quot;nimbus-landing&quot; on Vercel (3 files)…</div>
        <div className="text-white/50">  state: BUILDING</div>
        <div className="text-white/50">  state: READY</div>
        <div className="text-emerald-400">✓ Live at https://nimbus-landing.vercel.app</div>
        <div className="pt-2"><span className="text-[#8d8dff]">$</span> supabase link</div>
        <div className="text-emerald-400">✓ Linked Supabase project zzlpiuv: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set</div>
        <div className="pt-2 text-white/40">Type `help` for all commands</div>
      </div>
    </Frame>
  );
}

export function PortalFrame() {
  return (
    <Frame>
      <div className="grid md:grid-cols-[1fr_260px] min-h-[380px]">
        <div className="p-4 border-r border-white/10">
          <div className="flex items-center justify-between"><span className="text-white font-medium">Client portal · Fjord Studio</span><span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-400/15 text-emerald-300">Ready to approve</span></div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] h-[230px] grid place-items-center text-white/35">live preview of the site</div>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-[.14em] text-white/35">Comments</div>
          <div className="rounded-xl bg-white/[.04] p-3"><div className="text-white/85">Can the hero photo be warmer?</div><div className="text-[10px] text-white/35 mt-1">Ana · client · 2h</div></div>
          <div className="rounded-xl bg-white/[.04] p-3"><div className="text-white/85">Done in v09, resolved by Designer.</div><div className="text-[10px] text-white/35 mt-1">You · 1h</div></div>
          <button className="w-full rounded-lg bg-white text-black py-2 text-[12px] font-semibold">Approve</button>
        </div>
      </div>
    </Frame>
  );
}

export function TemplatesFrame() {
  return (
    <Frame>
      <div className="p-4 min-h-[380px]">
        <div className="flex gap-2 text-[11px] text-white/60">{["All", "SaaS", "Agency", "Restaurant", "Interactive", "Web3"].map((c, i) => <span key={c} className={`px-2.5 py-1 rounded-full border ${i === 0 ? "border-white/40 text-white" : "border-white/10"}`}>{c}</span>)}</div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {["SaaS · Dark Signal", "Agency · Studio", "Restaurant · Warm", "Trivia quiz", "Fitness · Bold", "Web3 · Neon"].map((t, i) => <div key={t} className="rounded-xl border border-white/10 overflow-hidden"><div className={`h-20 ${["bg-[#1a1a3a]", "bg-[#3a2a1a]", "bg-[#3a1a1a]", "bg-[#1a2a3a]", "bg-[#2a1a3a]", "bg-[#1a3a2a]"][i]}`} /><div className="px-2.5 py-2 text-[11px] text-white/80">{t}</div></div>)}
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Tabs: who is it for ---------- */

const AUDIENCES: { id: string; label: string; icon: BrandIconName; frame: ReactNode }[] = [
  { id: "founders", label: "Founders", icon: "bulb", frame: <WorkspaceFrame /> },
  { id: "agencies", label: "Agencies", icon: "teams", frame: <PortalFrame /> },
  { id: "creators", label: "Creators", icon: "templates", frame: <TemplatesFrame /> },
  { id: "developers", label: "Developers", icon: "terminal", frame: <TerminalFrame /> },
];

export function AudienceTabs() {
  const [active, setActive] = useState("founders");
  const a = AUDIENCES.find((x) => x.id === active)!;
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-stagger>
        {AUDIENCES.map((x) => (
          <button key={x.id} onClick={() => setActive(x.id)} className={`relative flex items-center gap-3 rounded-2xl border px-5 py-4 text-left text-base font-medium transition ${active === x.id ? "border-white/20 bg-[#141416] text-paper" : "border-graphite bg-[#0f0f11] text-ash hover:text-fog"}`}>
            <span className={`w-9 h-9 rounded-full grid place-items-center ${active === x.id ? "bg-signal/20 text-signal-soft" : "bg-white/5"}`}><BrandIcon name={x.icon} size={16} strokeWidth={1.7} /></span>{x.label}
            {active === x.id && <span className="absolute left-4 right-4 -bottom-px h-0.5 rounded-full bg-paper" />}
          </button>
        ))}
      </div>
      <div className="mt-6 pop-in" key={a.id}>{a.frame}</div>
    </div>
  );
}

/* ---------- Accordion: the agent team ---------- */

const TEAM: { name: string; role: string; text: string; icon: BrandIconName }[] = [
  { name: "Builder", role: "Lead full-stack engineer", text: "Turns your sentence into a complete page or app: structure, layout, real copy and interactions, saved as a version you can roll back.", icon: "build" },
  { name: "Designer", role: "Product designer", text: "Applies a strict design system: one style, one accent, consistent spacing and type, so everything reads premium.", icon: "designer" },
  { name: "Database & API", role: "Architects", text: "Design the schema and endpoints, then link your Supabase project from the terminal with one command.", icon: "database" },
  { name: "Deploy", role: "DevOps engineer", text: "Pushes to GitHub, deploys to Vercel and writes a launch guide for your exact stack, domain and SSL included.", icon: "launch" },
  { name: "QA & Security", role: "Engineers", text: "Test every section, link and form, audit for leaked secrets and unsafe patterns, and hand fixes to the Debugger.", icon: "security" },
];

export function AgentAccordion({ open, onOpen }: { open: number; onOpen: (i: number) => void }) {
  return (
    <div className="team-accordion space-y-3" data-stagger>
      {TEAM.map((t, i) => (
        <button key={t.name} onClick={() => onOpen(i)} className={`w-full text-left rounded-2xl border px-5 py-4 transition ${open === i ? "border-white/15 bg-[#141416]" : "border-graphite bg-[#0f0f11] hover:border-white/15"}`}>
          <div className="flex items-center gap-3"><span className={`w-9 h-9 rounded-full grid place-items-center ${open === i ? "bg-signal/20 text-signal-soft" : "bg-white/5 text-fog"}`}><BrandIcon name={t.icon} size={16} strokeWidth={1.7} /></span><span className="text-lg font-medium">{t.name}</span><span className="text-xs text-ash">· {t.role}</span></div>
          {open === i && <p className="mt-3 text-sm text-fog/90 leading-relaxed pop-in">{t.text}</p>}
          {open === i && <div className="mt-4 h-0.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-paper transition-[width] duration-700" style={{ width: `${((i + 1) / TEAM.length) * 100}%` }} /></div>}
        </button>
      ))}
    </div>
  );
}

const TEAM_FRAMES: ReactNode[] = [<BuilderFrame key="w" />, <DesignerFrame key="d" />, <TerminalFrame key="t" />, <TerminalFrame key="dep" />, <PortalFrame key="q" />];

/** Sticky, scroll-driven "Your team" section: scrolling advances Builder → Designer → … */
export function AgentTeamSection({ heading, intro, catalogHref, count }: { heading: ReactNode; intro: string; catalogHref: string; count: number }) {
  const { ref, index, set } = useStepScroll(TEAM.length, true);
  return (
    <div ref={ref}>
      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-16 items-center lg:min-h-[calc(100vh-9rem)] py-2">
        <div>
          <p className="label reveal">Your team</p>
          <h2 className="heading mt-3 reveal-text">{heading}</h2>
          <p className="mt-5 text-lg text-fog/90 max-w-xl reveal" style={{ transitionDelay: "120ms" }}>{intro}</p>
          <div className="mt-8"><AgentAccordion open={index} onOpen={set} /></div>
          <div className="mt-6 flex items-center justify-between gap-4"><a href={catalogHref} className="text-sm text-signal-soft hover:underline">See all {count} agents in the catalog →</a><span className="hidden lg:inline text-[11px] text-ash">Explore the team · {index + 1}/{TEAM.length}</span></div>
        </div>
        <div key={index} className="hidden lg:block pop-in">{TEAM_FRAMES[index]}</div>
        <div key={`mobile-${index}`} className="lg:hidden pop-in">{TEAM_FRAMES[index]}</div>
      </div>
    </div>
  );
}

/* ---------- Side tabs: for whom ---------- */

const ROLES: { id: string; label: string; title: string; text: string; frame: ReactNode }[] = [
  { id: "founders", label: "For founders", title: "From idea to live product, alone", text: "Describe the product. The team plans it, builds it, tests it and deploys it. You keep the code, the domain and the customers. No agency, no waiting.", frame: <WorkspaceFrame /> },
  { id: "agencies", label: "For agencies", title: "Ship client sites in hours, not weeks", text: "Client portal with comments and approvals, white-label, versions and rollback. Sell your best work on the marketplace and keep 90%.", frame: <PortalFrame /> },
  { id: "developers", label: "For developers", title: "Real code, real terminal, your stack", text: "Export a Vite project, push to GitHub, deploy to Vercel, link Supabase and set env vars from the built-in terminal. Everything is yours.", frame: <TerminalFrame /> },
];

export function RoleTabs() {
  const { ref, index, set } = useStepScroll(ROLES.length);
  const r = ROLES[index];
  return (
    <div ref={ref}>
      <div className="grid lg:grid-cols-[260px_1fr] gap-8 lg:gap-14 items-center lg:min-h-[calc(100vh-9rem)] py-2">
        <div className="flex lg:flex-col gap-4 lg:gap-6 lg:pt-12 overflow-x-auto">
          {ROLES.map((x, i) => (
            <button key={x.id} onClick={() => set(i)} className={`relative flex items-center gap-3 whitespace-nowrap text-left text-xl font-medium transition ${index === i ? "text-paper" : "text-ash hover:text-fog"}`}>
              {index === i && <span className="hidden lg:block absolute -left-8 text-signal-soft">✦</span>}{x.label}
            </button>
          ))}
        </div>
        <div key={r.id} className="pop-in min-w-0">
          <div className="rounded-3xl bg-[#111114] border border-white/5 p-6 md:p-10">
            <h3 className="text-2xl md:text-4xl font-semibold tracking-tight">{r.title}</h3>
            <p className="mt-4 text-base md:text-lg text-fog/90 leading-relaxed max-w-3xl">{r.text}</p>
          </div>
          <div className="mt-6">{r.frame}</div>
        </div>
      </div>
    </div>
  );
}
