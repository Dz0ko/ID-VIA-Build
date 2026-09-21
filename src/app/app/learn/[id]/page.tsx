import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Lightbulb } from "@/components/icons";
import { PageHeader } from "@/components/app/PageHeader";
import { UseInProject } from "@/components/app/UseInProject";
import { adjacentLessons, getLesson, lessonsByGroup, type LessonBlock } from "@/lib/learn";
import { requireUser } from "@/lib/auth";
import { planAtLeast } from "@/lib/agents";
import { LearnLocked } from "@/components/app/LearnLocked";

function Block({ b }: { b: LessonBlock }) {
  switch (b.type) {
    case "h":
      return <h3 className="text-base font-medium mt-8 mb-2">{b.text}</h3>;
    case "p":
      return <p className="text-sm text-fog leading-relaxed">{b.text}</p>;
    case "list":
      return <ul className="space-y-2 text-sm text-fog">{b.items.map((t, i) => <li key={i} className="flex gap-3"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-signal-soft shrink-0" /><span>{t}</span></li>)}</ul>;
    case "steps":
      return (
        <ol className="space-y-3">
          {b.items.map((s, i) => (
            <li key={i} className="card p-4 flex gap-4">
              <span className="shrink-0 w-8 h-8 rounded-lg bg-signal/15 text-signal-soft grid place-items-center font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
              <div><div className="text-sm font-medium">{s.title.replace(/^\d+\.\s*/, "")}</div><p className="text-xs text-ash mt-1 leading-relaxed">{s.text}</p></div>
            </li>
          ))}
        </ol>
      );
    case "compare":
      return (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-ash border-b border-graphite"><tr>{b.head.map((h, i) => <th key={i} className="text-left p-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i} className="border-b border-graphite/60 align-top"><td className="p-3 font-medium text-paper whitespace-nowrap">{r[0]}</td><td className="p-3 text-fog">{r[1]}</td><td className="p-3 text-ash font-mono">{r[2]}</td></tr>)}</tbody>
          </table>
        </div>
      );
    case "tip":
      return <div className="rounded-xl border border-signal/30 bg-signal/10 p-4 text-sm text-fog flex gap-3"><Lightbulb size={16} className="text-signal-soft shrink-0 mt-0.5" /><span>{b.text}</span></div>;
    case "code":
      return <pre className="card p-4 overflow-x-auto text-[12px] font-mono leading-relaxed text-fog"><code>{b.code}</code></pre>;
    case "try":
      return (
        <div className="rounded-xl border border-graphite bg-ink p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0"><div className="text-[10px] font-mono uppercase tracking-[0.14em] text-signal-soft">Try it now</div><p className="text-xs text-ash mt-1 line-clamp-2">{b.prompt}</p></div>
          <UseInProject prompt={b.prompt} agent={b.agent} label={b.label ?? "Open in the builder"} />
        </div>
      );
  }
}

export default async function LessonPage({ params }: PageProps<"/app/learn/[id]">) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const user = await requireUser();
  if (!planAtLeast(user.plan, "STARTER")) {
    return (
      <>
        <PageHeader title={lesson.title} subtitle={`${lesson.group} · Lesson ${lesson.order} · ${lesson.minutes} min`}>
          <Link href="/app/learn" className="btn btn-ghost btn-sm"><ArrowLeft size={13} />All lessons</Link>
        </PageHeader>
        <div className="flex-1 overflow-y-auto p-6"><div className="max-w-3xl mx-auto space-y-4"><h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1><p className="text-fog">{lesson.summary}</p><LearnLocked /></div></div>
      </>
    );
  }
  const { prev, next } = adjacentLessons(id);
  const groups = lessonsByGroup();

  return (
    <>
      <PageHeader title={lesson.title} subtitle={`${lesson.group} · Lesson ${lesson.order} · ${lesson.minutes} min`}>
        <Link href="/app/learn" className="btn btn-ghost btn-sm"><ArrowLeft size={13} />All lessons</Link>
      </PageHeader>
      <div className="flex-1 overflow-hidden flex">
        <aside className="hidden lg:block w-64 shrink-0 border-r border-graphite overflow-y-auto p-4 space-y-5">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="label mb-2">{g.group}</div>
              <ul className="space-y-0.5">
                {g.lessons.map((l) => (
                  <li key={l.id}><Link href={`/app/learn/${l.id}`} className={`block rounded-lg px-2.5 py-1.5 text-xs transition ${l.id === id ? "bg-graphite text-paper" : "text-fog hover:bg-ink hover:text-paper"}`}><span className="font-mono text-ash mr-2">{String(l.order).padStart(2, "0")}</span>{l.title}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
        <article className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6 md:p-10">
            <div className="flex items-center gap-2 text-[11px] text-ash"><span className="pill text-[10px]">{lesson.group}</span><span className="flex items-center gap-1"><Clock size={11} />{lesson.minutes} min read</span></div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
            <p className="mt-2 text-fog">{lesson.summary}</p>
            <div className="mt-8 space-y-4">{lesson.blocks.map((b, i) => <Block key={i} b={b} />)}</div>
            <div className="mt-12 pt-6 border-t border-graphite flex items-center justify-between gap-3">
              {prev ? <Link href={`/app/learn/${prev.id}`} className="btn btn-outline btn-sm"><ArrowLeft size={13} />{prev.title}</Link> : <span />}
              {next ? <Link href={`/app/learn/${next.id}`} className="btn btn-signal btn-sm">{next.title}<ArrowRight size={13} /></Link> : <Link href="/app/learn" className="btn btn-signal btn-sm">Back to all lessons</Link>}
            </div>
          </div>
        </article>
      </div>
    </>
  );
}

