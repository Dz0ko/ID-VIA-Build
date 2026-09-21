import Link from "next/link";
import { GraduationCap, Clock, ArrowRight, Lock } from "@/components/icons";
import { PageHeader } from "@/components/app/PageHeader";
import { GLOSSARY, LESSONS, lessonsByGroup } from "@/lib/learn";
import { requireUser } from "@/lib/auth";
import { planAtLeast } from "@/lib/agents";
import { LearnLocked } from "@/components/app/LearnLocked";

export default async function LearnPage() {
  const user = await requireUser();
  const groups = lessonsByGroup();
  const unlocked = planAtLeast(user.plan, "STARTER");
  const total = LESSONS.reduce((s, l) => s + l.minutes, 0);
  return (
    <>
      <PageHeader title="Learn" subtitle="A short course on how websites, apps and the tools around them work. No experience needed." />
      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        <section className="card p-6 md:p-8 grid md:grid-cols-[1.5fr_1fr] gap-6 items-center">
          <div>
            <div className="flex items-center gap-2 text-signal-soft text-xs font-mono uppercase tracking-[0.14em]"><GraduationCap size={14} />IDÆVIA Academy</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">From “what is a website?” to a published product.</h2>
            <p className="mt-2 text-sm text-fog max-w-xl">{LESSONS.length} short lessons, about {Math.round(total / 60 * 10) / 10} hours in total. Every lesson explains the words you will hear from developers and designers, then gives you something to try in the builder right away.</p>
            <div className="mt-4 flex gap-2">
              {unlocked ? (
                <Link href={`/app/learn/${LESSONS[0].id}`} className="btn btn-signal btn-sm">Start lesson 1<ArrowRight size={13} /></Link>
              ) : (
                <Link href="/pricing" className="btn btn-signal btn-sm">Unlock with Starter, $19/mo<ArrowRight size={13} /></Link>
              )}
              <a href="#glossary" className="btn btn-outline btn-sm">Glossary ({GLOSSARY.length} terms)</a>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-graphite p-3"><div className="text-2xl font-semibold">{LESSONS.length}</div><div className="text-[10px] text-ash uppercase tracking-wider">Lessons</div></div>
            <div className="rounded-xl border border-graphite p-3"><div className="text-2xl font-semibold">{groups.length}</div><div className="text-[10px] text-ash uppercase tracking-wider">Chapters</div></div>
            <div className="rounded-xl border border-graphite p-3"><div className="text-2xl font-semibold">{LESSONS.filter((l) => l.blocks.some((b) => b.type === "try")).length}</div><div className="text-[10px] text-ash uppercase tracking-wider">Hands-on</div></div>
          </div>
        </section>

        {!unlocked && <LearnLocked />}

        {groups.map((g, gi) => (
          <section key={g.group}>
            <div className="flex items-baseline gap-3 mb-3"><span className="font-mono text-xs text-ash">0{gi + 1}</span><h3 className="text-sm font-medium">{g.group}</h3></div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {g.lessons.map((l) => (
                <Link key={l.id} href={unlocked ? `/app/learn/${l.id}` : "/pricing"} className={`card p-4 flex flex-col gap-2 hover:border-signal transition group ${unlocked ? "" : "opacity-80"}`}>
                  <div className="flex items-center justify-between text-[11px] text-ash"><span className="font-mono">Lesson {l.order}</span><span className="flex items-center gap-1"><Clock size={11} />{l.minutes} min</span></div>
                  <div className="text-sm font-medium group-hover:text-signal-soft transition">{l.title}</div>
                  <p className="text-xs text-ash flex-1">{l.summary}</p>
                  <div className="flex gap-1.5">
                    {l.blocks.some((b) => b.type === "try") && <span className="pill text-[10px] border-signal/40 text-signal-soft">Hands-on</span>}
                    {!unlocked && <span className="pill text-[10px]"><Lock size={9} className="mr-1" />Starter</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section id="glossary" className="card p-6">
          <h3 className="text-sm font-medium">Glossary</h3>
          <p className="text-xs text-ash mt-1">The words you will hear in meetings, in plain language.</p>
          <dl className="mt-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3 text-xs">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="border-b border-graphite/60 pb-2"><dt className="font-medium text-paper">{g.term}</dt><dd className="text-ash mt-0.5">{g.def}</dd></div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
