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
      <PageHeader title={`Welcome, ${user.name ?? user.email}`} subtitle="Describe what you want to build. IDÆVIA builds it with you.">
        <Suspense><NewProject templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category }))} /></Suspense>
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {sp.welcome === "1" && <TrackEvent event="complete_registration" props={{ method: "social" }} />}
        {offline && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            {process.env.NODE_ENV === "production"
              ? "AI generation is temporarily unavailable. Your credits are not charged for failed runs; please try again shortly."
              : "Local dev: no AI provider key is configured, so generation uses the built-in template engine. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env for real agents."}
          </div>
        )}
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            ["Projects", `${count}${plan.projectLimit === "unlimited" ? "" : ` / ${plan.projectLimit}`}`],
            ["Published", String(published)],
            ["Agent runs", String(runs)],
            ["Credits", `${user.credits.toLocaleString()} / ${plan.credits.toLocaleString()}`],
          ].map(([l, v]) => (
            <div key={l} className="card p-4"><div className="label">{l}</div><div className="mt-1 text-2xl font-semibold tracking-tight">{v}</div></div>
          ))}
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Recent projects</h2>
            <Link href="/app/projects" className="text-xs text-ash hover:text-paper">All projects →</Link>
          </div>
          <ProjectGrid projects={projects} />
        </section>

        <section className="grid lg:grid-cols-2 gap-4 min-w-0">
          <div className="card p-5">
            <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Your AI team</h2><span className="text-xs text-ash">{agentsForPlan(user.plan).length} agents on {plan.name}</span></div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {agentsForPlan(user.plan).map((a) => <span key={a.id} className="pill">{a.name}</span>)}
            </div>
            <Link href="/app/agents" className="mt-4 inline-block text-xs text-signal-soft hover:underline">Browse the catalog →</Link>
          </div>
          <div className="card p-5 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Quick starts</h2><Link href="/app/assistant" className="text-xs text-signal-soft hover:underline whitespace-nowrap">Ask the Agent for ideas →</Link></div>
            <div className="mt-3 grid gap-2 min-w-0">
              {[
                ["SaaS landing page", "Build a modern dark SaaS landing page for an AI CRM targeting agencies with pricing, testimonials and FAQ."],
                ["Local business", "Build a modern website for a restaurant with a menu, gallery and table reservations."],
                ["Portfolio", "Create a minimal portfolio for a product designer with a projects grid and contact form."],
              ].map(([t, p]) => (
                <Link key={t} href={`/app?prompt=${encodeURIComponent(p)}`} className="group min-w-0 rounded-xl border border-graphite px-3.5 py-2.5 text-sm hover:border-signal/60 hover:bg-ink transition flex items-center gap-3"><span className="min-w-0 flex-1"><span className="block font-medium">{t}</span><span className="block text-xs text-ash truncate">{p}</span></span><span className="shrink-0 text-ash group-hover:text-signal-soft transition">→</span></Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
