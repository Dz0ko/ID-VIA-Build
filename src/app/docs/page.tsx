import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BrandIcon, agentIcon } from "@/components/BrandIcon";
import { AGENTS } from "@/lib/agents";
import { CREDIT_GUIDE, CREDIT_PACKS, PLANS, PLAN_ORDER, TIER_LABELS } from "@/lib/plans";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates";
import { PROVIDER_INFO } from "@/lib/integrations";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { MARKETPLACE_FEE_PCT } from "@/lib/marketplace";
import { LEGAL_CONTACT } from "@/components/LegalPage";
import { DocsNav } from "@/components/DocsNav";

export const metadata: Metadata = { title: "Docs", description: "Everything about IDÆVIA Build: how it works, the 30 agents, models and credits, terminal and deploys, integrations, marketplace, plans." };

const NAV = [
  ["overview", "What is IDÆVIA Build"],
  ["start", "Getting started"],
  ["workspace", "The workspace"],
  ["agents", "The 30 agents"],
  ["models", "Models"],
  ["credits", "Credits and plans"],
  ["terminal", "Terminal and deploys"],
  ["integrations", "Integrations"],
  ["templates", "Templates and library"],
  ["marketplace", "Marketplace and payouts"],
  ["portal", "Client portal and teams"],
  ["referrals", "Referrals and affiliates"],
  ["account", "Account, security, privacy"],
  ["desktop", "Desktop app"],
  ["faq", "FAQ"],
] as const;

const GROUPS: [string, string[]][] = [
  ["Core", ["builder", "planner", "designer", "copywriter", "debugger", "seo"]],
  ["Design and content", ["ui", "ux", "animation", "3d", "asset", "localization", "asset-ref", "clone"]],
  ["Quality", ["performance", "accessibility", "security", "qa", "refactoring", "dependency"]],
  ["Full-stack and launch", ["database", "api", "auth", "payments", "git", "deploy", "analytics", "conversion", "documentation", "pm"]],
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  const n = NAV.findIndex(([k]) => k === id) + 1;
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl md:text-3xl font-semibold tracking-tight mt-16 first:mt-0 flex items-baseline gap-3">
      <span className="font-mono text-sm text-signal-soft">{String(n).padStart(2, "0")}</span>
      <span>{children}<span className="block mt-2 h-[2px] w-10 rounded-full bg-signal" /></span>
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-medium mt-8 text-paper"><span className="text-signal-soft mr-2">§</span>{children}</h3>;
}
/** Key term in the brand colour. */
function K({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-signal-soft">{children}</strong>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-fog leading-relaxed">{children}</p>;
}
function Table({ head, rows }: { head: string[]; rows: (React.ReactNode)[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-graphite">
      <table className="w-full text-sm">
        <thead className="bg-ink text-signal-soft"><tr>{head.map((h) => <th key={h} className="text-left p-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-graphite align-top">{r.map((c, j) => <td key={j} className="p-3 text-fog">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
const Code = ({ children }: { children: string }) => <code className="font-mono text-[13px] bg-ink border border-graphite rounded px-1.5 py-0.5 text-signal-soft">{children}</code>;

export default function Docs() {
  const agentById = new Map(AGENTS.map((a) => [a.id, a]));
  const ref = DEFAULT_SETTINGS.referral;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-graphite bg-void/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-5 text-sm text-fog"><Link href="/" className="hover:text-paper">Home</Link><Link href="/pricing" className="hover:text-paper">Pricing</Link><Link href="/download" className="hover:text-paper">Download</Link><Link href="/signup" className="btn btn-primary btn-sm">Start free</Link></nav>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto w-full px-6 py-10 md:py-14 grid lg:grid-cols-[260px_1fr] gap-10 lg:gap-16 flex-1">
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="label text-signal-soft">Documentation</div>
          <DocsNav items={NAV} />
        </aside>

        <article className="min-w-0 max-w-3xl">
          <p className="label text-signal-soft">IDÆVIA Build docs</p>
          <h1 className="heading mt-3">Everything you need to <span className="text-signal-soft">know</span>.</h1>
          <P>IDÆVIA Build is an AI software-creation platform. You describe a website or app in one sentence; a team of {AGENTS.length} specialist agents plans, designs, builds, tests and deploys it while you watch, edit real code, collect client approvals and launch. This page explains what the product does, what each feature is for, and how credits and plans work.</P>

          <H2 id="overview">What is IDÆVIA Build</H2>
          <P>One workspace for two kinds of projects: <K>websites</K> (a single, fast HTML page with Tailwind and vanilla JavaScript, ready to publish anywhere) and <K>React apps</K> (a multi-file React + TypeScript project that runs live in your browser and exports as a Vite project).</P>
          <P>You never write prompts for a generic chatbot. You talk to a team: the Router reads your request, picks the right specialist, the specialist tells you what it will do, does it, and reports back. Every change is saved as a version you can roll back.</P>
          <Table head={["You get", "In short"]} rows={[
            ["30 agents", "Named specialists with professions, from Builder and Designer to Database, Deploy, QA and Security."],
            ["5 model tiers", "From fast everyday models to frontier models (Claude Fable 5.1, GPT-6 Astra), your choice per run."],
            ["Live workspace", "Preview on desktop/tablet/mobile, code editor, React sandbox, versions, audits, logs."],
            ["Real terminal", "publish, git push, deploy vercel, supabase link, env set, export. Real commands with full logs."],
            ["Integrations", "GitHub, Vercel, Supabase, Higgsfield, Netlify."],
            ["Library", `${TEMPLATES.length} templates in ${TEMPLATE_CATEGORIES.length} categories, plus ready-made prompts, components and effects (hover, scroll, cursor, 3D) you drop into any project.`],
            ["Collaboration", "Teams, white-label client portal with comments and approvals."],
            ["Marketplace", `Sell templates, components, prompts and agents; keep ${100 - MARKETPLACE_FEE_PCT}%.`],
            ["Learn", "18 lessons and a glossary, from frontend basics to deployment and security."],
          ]} />

          <H2 id="start">Getting started</H2>
          <ol className="mt-3 list-decimal pl-5 space-y-2 text-fog">
            <li>Create an account with email, Google or GitHub. The Free plan gives {PLANS.FREE.credits} credits every month, no card.</li>
            <li>Click <K>New project</K>, name it and describe what you want. Or pick a template and remix it with one sentence. You can also attach a screenshot (Starter+) or import from a URL, GitHub or ZIP.</li>
            <li>Watch the Builder stream the first version. Keep chatting: “make the hero darker”, “add a pricing table”, “translate to German”. The Router sends each request to the right agent.</li>
            <li>Open the <K>Problems</K> tab for a production audit, fix issues with one click, then <K>publish</K> for an instant link, push to GitHub or deploy to Vercel from the terminal.</li>
          </ol>

          <H2 id="workspace">The workspace</H2>
          <H3>Chat</H3>
          <P>The default agent is <K>Auto</K>: the Router classifies your request (small tweak, section, full page, feature, full-stack) and picks the specialist. You can choose an agent and a model yourself. Each agent introduces itself when it starts and writes a short first-person note when it finishes, so the chat reads like a real team.</P>
          <H3>Preview and code</H3>
          <P>Live preview with desktop, tablet and mobile widths. Switch to <K>Code</K> to edit the HTML or any file of a React app in a full editor; saving creates a new version. Generated sites run in an isolated sandbox and cannot touch your account.</P>
          <H3>Versions, audits, logs</H3>
          <P>Every run is a version with a message; restore any version instantly. The audit scores performance, SEO, accessibility, security, code quality and mobile, and the Debugger fixes findings on request. The Logs tab shows routing decisions, the model used, credits and deploy events.</P>
          <H3>One-click workflows</H3>
          <P><K>Build website</K>, <K>Make it premium</K>, <K>Production ready</K> and <K>Optimise landing</K> run several agents in sequence on your project.</P>

          <H2 id="agents">The {AGENTS.length} agents</H2>
          <P>Every agent is a specialist with a profession. Agents unlock by plan: Free {PLANS.FREE.agentLimit}, Starter {PLANS.STARTER.agentLimit}, Pro {PLANS.PRO.agentLimit}, Max and Agency all {AGENTS.length}. Agency can also create custom agents with their own instructions.</P>
          {GROUPS.map(([g, ids]) => (
            <div key={g}>
              <H3>{g}</H3>
              <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                {ids.map((id) => { const a = agentById.get(id); if (!a) return null; return (
                  <li key={id} className="flex gap-3 rounded-xl border border-graphite p-3">
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-ink border border-graphite grid place-items-center"><BrandIcon name={agentIcon(id)} size={15} /></span>
                    <div className="min-w-0"><div className="text-sm font-medium">{a.name} <span className="text-ash font-normal">· {a.profession}</span></div><div className="text-xs text-ash mt-0.5">{a.description}</div></div>
                  </li>
                ); })}
              </ul>
            </div>
          ))}

          <H2 id="models">Models</H2>
          <P>Runs execute on one of five tiers. Auto routing picks the cheapest tier that fits the task and never escalates to Frontier on its own; you choose the model explicitly from the dropdown in the chat.</P>
          <Table head={["Tier", "Models", "Best for", "Credit multiplier"]} rows={[
            ["Fast", TIER_LABELS.fast, "Small tweaks: colours, text, spacing", `×${DEFAULT_SETTINGS.tierMultiplier.fast}`],
            ["Standard", TIER_LABELS.standard, "Sections, edits, most everyday work", `×${DEFAULT_SETTINGS.tierMultiplier.standard}`],
            ["Advanced", TIER_LABELS.advanced, "Full pages, complex layouts", `×${DEFAULT_SETTINGS.tierMultiplier.advanced}`],
            ["Premium", "Claude Opus 5 · GPT-5.6 Sol", "Full-stack features, hard reasoning", `×${DEFAULT_SETTINGS.tierMultiplier.premium}`],
            ["Frontier", TIER_LABELS.frontier, "The most demanding builds", `×${DEFAULT_SETTINGS.tierMultiplier.frontier}`],
          ]} />
          <P>If a provider is unavailable, the same tier runs on the alternative provider automatically; failed runs are refunded.</P>

          <H2 id="credits">Credits and plans</H2>
          <P>Credits measure the work the agents do. A run is priced from what it is (a tweak, a section, a full page, a feature), which agent and model tier it uses, and how large your document is, because an edit rewrites the whole document. You see the estimate before the run and the exact charge, with the reason, in <K>Profile → Credit usage</K>.</P>
          <Table head={["Typical task", "Credits (Standard/Advanced)"]} rows={[
            ["Small edit on a typical page", `about ${CREDIT_GUIDE.smallEdit}`],
            ["New full landing page", `about ${CREDIT_GUIDE.page}`],
            ["Full-stack feature on Opus", `about ${CREDIT_GUIDE.fullstack}`],
          ]} />
          <P>Frontier models cost more per run (deep reasoning), and the credit log says so. Failed runs are refunded in full; if the model answers in the wrong format, half is refunded.</P>
          <H3>Plans</H3>
          <Table head={["Plan", "Price", "Credits / month", "Agents", "Top tier", "Includes"]} rows={PLAN_ORDER.map((id) => { const p = PLANS[id]; return [p.name, p.price ? `$${p.price}/mo` : "Free", p.credits.toLocaleString(), p.agentLimit === "all" ? `All ${AGENTS.length}` : String(p.agentLimit), TIER_LABELS[p.maxTier].split(" · ")[0], p.highlights.slice(0, 3).join(" · ")]; })} />
          <P>Plan credits renew every 30 days; Pro and above roll over up to 25% of unused plan credits. Cancel any time; the plan stays active until the end of the paid period.</P>
          <H3>Credit packs</H3>
          <P>{CREDIT_PACKS.map((c) => `${c.credits.toLocaleString()} for $${c.price}`).join(" · ")}. Packs are one-time purchases on paid plans, paid by card, PayPal or crypto. Purchased credits <K>never expire</K> and are spent after your plan credits.</P>

          <H2 id="terminal">Terminal and deploys</H2>
          <P>Every project has a terminal. On the web the commands run on our servers with full logs; in the desktop app you also get a real local shell.</P>
          <Table head={["Command", "What it does"]} rows={[
            [<Code key="1">publish</Code>, "Publishes the website at idaevia.app/s/your-slug. Free plan adds a small “Made with IDÆVIA” badge."],
            [<Code key="2">git push [owner/repo] [--public]</Code>, "Creates the repository if needed and pushes every file as one commit. Needs GitHub in Integrations."],
            [<Code key="3">deploy vercel [name]</Code>, "Deploys the site or the React app (Vite build) to your Vercel account and streams the build log."],
            [<Code key="4">supabase link</Code>, "Injects your connected Supabase URL and keys into the project environment for apps."],
            [<Code key="5">env set KEY=VALUE · env list · env unset</Code>, "Per-project environment variables, encrypted. VITE_* values are baked into builds."],
            [<Code key="6">audit · preview · status · ls · cat</Code>, "Checks and information about the project."],
            [<Code key="7">export</Code>, "Downloads a ZIP: the HTML site, or a complete Vite + React project (Starter+)."],
          ]} />

          <H2 id="integrations">Integrations</H2>
          <P>Connect services once in <K>Integrations</K>; the terminal uses them in every project. Credentials are verified when you save them, stored encrypted, never shown again and never sent to AI providers.</P>
          <Table head={["Service", "What it enables"]} rows={Object.entries(PROVIDER_INFO).map(([id, p]) => [p.name, p.blurb])} />

          <H2 id="templates">Templates and library</H2>
          <P>{TEMPLATES.length} templates across {TEMPLATE_CATEGORIES.join(", ")}. Pick one, then change anything with a sentence. The Interactive category contains playable mini-apps (trivia quiz, poll, countdown with RSVP, decision wheel, personality quiz, would-you-rather, party cards).</P>
          <P>Everything in the library is ready to use in your own project. The <K>Prompts</K> library gives you proven prompts per industry that you run as they are or adapt. <K>Components</K> (heroes, pricing tables, navbars, forms, testimonials and more) and <K>Effects</K> (hover, scroll, cursor, 3D) have live previews and are added to the project by prompt, so a section that would take an afternoon is one click. <K>Learn</K> (Starter+) has 18 lessons and a 45-term glossary.</P>

          <H2 id="marketplace">Marketplace and payouts</H2>
          <P>Sell websites, app templates, components, prompts and agents (Starter+). Buyers see a protected preview, never the code; after paying they install the item into a new project. IDÆVIA keeps {MARKETPLACE_FEE_PCT}%, you keep {100 - MARKETPLACE_FEE_PCT}%.</P>
          <P>Earnings land in your <K>Seller wallet</K> on your profile. Add a payout destination (crypto: USDT, USDC, BTC, ETH on several networks, or PayPal), then request a payout of at least $10. We review and send it within 3 business days; every step is visible in the wallet.</P>

          <H2 id="portal">Client portal and teams</H2>
          <P>Create a share link for any project, optionally with a password and an expiry. Clients open it without an account, see the live preview, leave comments and change requests and approve. Feedback flows back into the workspace. Agency plans get teams with roles and white-label portals (your name, logo and colours).</P>

          <H2 id="referrals">Referrals and affiliates</H2>
          <P>Your profile has a referral link. A friend who signs up through it gets {ref.referredSignupCredits} credits, you get {ref.referrerSignupCredits}, and {ref.referrerPaidCredits} more when they buy any paid plan. Partners can apply for the affiliate programme and earn a percentage of every payment by the users they bring; write to <a className="text-paper underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.</P>

          <H2 id="account">Account, security, privacy</H2>
          <P>Sign in with email and password, Google or GitHub. Changing your password signs out every other device. Payments are processed by Whop; we never see card numbers. Your prompts and projects are processed by AI providers under terms that exclude training on your data. Generated sites always run in an isolated sandbox. Details in the <Link href="/privacy" className="text-paper underline">Privacy Policy</Link>, <Link href="/terms" className="text-paper underline">Terms</Link> and <Link href="/cookies" className="text-paper underline">Cookie Policy</Link>.</P>

          <H2 id="desktop">Desktop app</H2>
          <P>The desktop app for macOS and Windows is the same workspace plus a real local shell in the terminal tab, so you can run npm, git and your own tools next to the AI team. Your account, projects and credits are shared with the web app. <Link href="/download" className="text-paper underline">Download</Link>.</P>

          <H2 id="faq">FAQ</H2>
          {[
            ["Do I own what I build?", "Yes. You own the code and content generated in your projects and can export and host it anywhere."],
            ["Which model is used?", "Your choice per run, from Fast to Frontier. Auto routing uses the cheapest tier that fits the task."],
            ["What happens if a run fails?", "Credits for that run are refunded automatically."],
            ["Can I use it on my phone?", "The landing page and account creation work on phones; the workspace is designed for desktop browsers and the desktop app."],
            ["Can I bring my own domain?", "Publish to idaevia.app for a preview link, or deploy to Vercel/Netlify from the terminal and attach your domain there. The Deploy agent writes the exact steps for your project."],
            ["How do payouts work for sellers?", "Sales are credited to your wallet; request a payout to crypto or PayPal from your profile once you have $10 or more."],
          ].map(([q, a]) => <div key={q} className="mt-5"><div className="font-medium">{q}</div><p className="mt-1 text-fog">{a}</p></div>)}

          <div className="mt-16 rounded-2xl border border-graphite p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1"><div className="font-medium">Ready to build?</div><div className="text-sm text-ash mt-1">Free plan, no card needed.</div></div>
            <Link href="/signup" className="btn btn-primary">Start free</Link>
          </div>
        </article>
      </div>

      <footer className="border-t border-graphite py-8">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-ash">
          <div>© {new Date().getFullYear()} IDÆVIA</div>
          <div className="flex gap-4"><Link href="/" className="hover:text-paper">Home</Link><Link href="/pricing" className="hover:text-paper">Pricing</Link><Link href="/privacy" className="hover:text-paper">Privacy</Link><Link href="/terms" className="hover:text-paper">Terms</Link><a href={`mailto:${LEGAL_CONTACT}`} className="hover:text-paper">{LEGAL_CONTACT}</a></div>
        </div>
      </footer>
    </div>
  );
}
