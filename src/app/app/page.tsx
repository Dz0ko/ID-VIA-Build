import { BrandIcon } from "@/components/BrandIcon";
import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { agentsForPlan } from "@/lib/agents";
import { TEMPLATES } from "@/lib/templates";
import { PageHeader } from "@/components/app/PageHeader";
import { NewProject } from "@/components/app/NewProject";
import { ProjectGrid } from "@/components/app/ProjectGrid";
import { providerStatus } from "@/lib/ai/router";
import { TrackEvent } from "@/components/TrackEvent";

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const sp = await searchParams;
  const projects = await db.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, name: true, slug: true, status: true, kind: true, description: true, updatedAt: true, publishedAt: true } });
  const count = await db.project.count({ where: { userId: user.id } });
  const published = await db.project.count({ where: { userId: user.id, status: "PUBLISHED" } });
  const runs = await db.agentRun.count({ where: { userId: user.id } });
  const plan = PLANS[user.plan];
  const providers = providerStatus();
  const offline = !providers.anthropic && !providers.openai;

  return (
    <>
      <PageHeader title="Overview" subtitle="Your projects, tools and next steps in one place.">
        <Suspense><NewProject key={JSON.stringify([sp.prompt, sp.template])} templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category }))} /></Suspense>
      </PageHeader>
      <div className="dashboard-content flex-1 overflow-y-auto p-6 space-y-8">
        {sp.welcome === "1" && <TrackEvent event="complete_registration" props={{ method: "social" }} />}
        {offline && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            {process.env.NODE_ENV === "production"
              ? "AI generation is temporarily unavailable. Your credits are not charged for failed runs; please try again shortly."
              : "Local dev: no AI provider key is configured, so generation uses the built-in template engine. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env for real agents."}
          </div>
        )}
        <section className="dashboard-intro">
          <div><p className="label mb-3">Your workspace</p><h2>Let’s build something great{user.name ? `, ${user.name.split(" ")[0]}` : ""}.</h2><p className="text-sm text-ash mt-3">Pick up where you left off, or bring a new idea to life.</p></div>
          <Link href="/app/assistant" className="btn btn-outline"><BrandIcon name="agent" size={16} />Talk to your agent <span aria-hidden="true">↗</span></Link>
        </section>
        <div className="workspace-metrics">
          {[
            ["Projects", `${count}${plan.projectLimit === "unlimited" ? "" : ` / ${plan.projectLimit}`}`, "In your workspace"],
            ["Published", String(published), "Live on the web"],
            ["Agent runs", String(runs), "Across your projects"],
            ["Credits available", user.credits.toLocaleString(), `${plan.credits.toLocaleString()} included · ${plan.name}`],
          ].map(([label, value, detail]) => (
            <div key={label}><p className="text-xs text-ash">{label}</p><p className="metric-value">{value}</p><p className="text-[11px] text-ash">{detail}</p></div>
          ))}
        </div>

        <section>
          <div className="section-heading"><div><h2>Start with an idea</h2><p>Three starting points. Make any of them yours.</p></div><Link href="/app/prompts">Explore prompts →</Link></div>
          <div className="quick-start-grid">
            {[
              { title: "SaaS application", detail: "Turn a workflow into a product", icon: "dashboard" as const, prompt: "Build a polished SaaS CRM for agencies with a dashboard, contacts, deal pipeline, team roles, search and responsive navigation. Ask me about my preferred stack before implementation." },
              { title: "Business website", detail: "Give your business a new home", icon: "projects" as const, prompt: "Build a modern website for a restaurant with a menu, gallery, opening hours, location and table reservations. Use refined typography and a clear mobile navigation." },
              { title: "Personal portfolio", detail: "Let your best work stand out", icon: "templates" as const, prompt: "Create an editorial portfolio for a product designer with selected projects, detailed case studies, about and a contact form. Use generous whitespace and subtle motion." },
            ].map(item => <Link key={item.title} href={`/app?prompt=${encodeURIComponent(item.prompt)}`} className="quick-start"><span className="quick-start-icon"><BrandIcon name={item.icon} size={20} /></span><span className="min-w-0 flex-1"><strong>{item.title}</strong><span>{item.detail}</span></span><span className="text-ash" aria-hidden="true">↗</span></Link>)}
          </div>
        </section>

        <section>
          <div className="section-heading">
            <div><h2>Recent projects</h2><p>Your latest work, ready to continue.</p></div>
            <Link href="/app/projects" className="text-xs text-ash hover:text-paper">All projects →</Link>
          </div>
          <ProjectGrid projects={projects} />
        </section>

        <section className="team-overview">
          <div className="quick-start-icon"><BrandIcon name="agents" size={22} /></div>
          <div className="flex-1 min-w-0"><h2 className="text-sm font-medium">Your creative team, on demand</h2><p className="text-xs text-ash mt-1">{agentsForPlan(user.plan).length} specialised agents for design, code and everything in between.</p></div>
          <Link href="/app/agents" className="btn btn-outline btn-sm">Meet your agents →</Link>
          <details className="basis-full"><summary className="text-xs text-ash cursor-pointer">See included agents</summary><div className="mt-3 flex flex-wrap gap-2">{agentsForPlan(user.plan).map(a => <span key={a.id} className="pill">{a.name}</span>)}</div></details>
        </section>
      </div>
    </>
  );
}
