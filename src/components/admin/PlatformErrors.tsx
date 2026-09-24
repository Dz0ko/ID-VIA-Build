"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Incident = { id: string; source: string; code: string; title: string; area: string; severity: string; status: string; occurrences: number; revision: number; userId: string | null; projectId: string | null; runId: string | null; route: string | null; release: string | null; message: string; stack: string | null; explanation: string; steps: string[]; firstSeenAt: string; lastSeenAt: string; updatedAt: string; note: string; user: { id: string; name: string | null; email: string } | null; project: { id: string; name: string } | null };
type Result = { incidents: Incident[]; total: number; openCount: number; criticalCount: number; last24Hours: number; checkedAt: string };
const areas: Record<string, string> = { PLATFORM: "Platform", PROVIDER: "Provider", PROJECT: "Project code / settings", UNKNOWN: "Needs investigation" };
const statuses: Record<string, string> = { NEW: "New", INVESTIGATING: "In progress", RESOLVED: "Resolved" };
const date = (value: string) => new Date(value).toLocaleString();

export function PlatformErrors() {
  const [data, setData] = useState<Result | null>(null);
  const [status, setStatus] = useState("OPEN"), [area, setArea] = useState(""), [query, setQuery] = useState("");
  const [page, setPage] = useState(1), [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const url = `/api/admin/errors?${new URLSearchParams({ status, area, q: query, page: String(page) })}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(url, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load platform errors.");
      if (!signal?.aborted) { setData(body); setError(""); }
    } catch (error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : "Monitoring is unavailable. Check hosting logs and database connectivity."); }
  }, [url]);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const tick = async () => { if (!document.hidden) await load(controller.signal); if (!controller.signal.aborted) timer = setTimeout(tick, 5000); };
    timer = setTimeout(tick, 150);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load]);
  const current = data?.incidents.find(row => row.id === selected);
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between items-start gap-4"><div><p className="text-sm text-fog">Failures from generation, builds, previews, terminal, payments, email and the platform interface.</p><p className="mt-2 text-xs text-ash">Updates every 5 seconds · repeated errors are grouped · records expire after 90 days without a recurrence.</p></div><button className="btn btn-outline btn-sm" onClick={() => void load()}>Refresh</button></div>
    <section className="admin-metrics" aria-label="Error summary"><div className="p-4"><div className="label">Needs attention</div><div className="mt-1 text-2xl font-semibold">{data?.openCount ?? "—"}</div></div><div className="p-4"><div className="label">Critical open</div><div className="mt-1 text-2xl font-semibold text-red-400">{data?.criticalCount ?? "—"}</div></div><div className="p-4"><div className="label">Incidents in 24 hours</div><div className="mt-1 text-2xl font-semibold">{data?.last24Hours ?? "—"}</div></div></section>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-400">{error} Monitoring data may be out of date.</p>}
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px_220px] gap-3"><input className="input min-w-0" aria-label="Search platform errors" placeholder="Search user, email, project ID or error…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /><select className="input" aria-label="Error status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="OPEN">Needs attention</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="ALL">All statuses</option></select><select className="input" aria-label="Error area" value={area} onChange={e => { setArea(e.target.value); setPage(1); }}><option value="">All areas</option>{Object.entries(areas).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="rounded-2xl border border-graphite overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-graphite text-xs text-ash"><tr><th className="p-4 text-left font-medium">Problem</th><th className="p-4 text-left font-medium">Affected user / project</th><th className="p-4 text-left font-medium">Status</th><th className="p-4 text-right font-medium">Count / latest</th></tr></thead><tbody>{data?.incidents.map(row => <tr key={row.id} className="border-b border-graphite/60"><td className="p-4"><button className="text-left font-medium hover:text-signal-soft" aria-expanded={selected === row.id} onClick={() => setSelected(selected === row.id ? null : row.id)}>{row.title}</button><div className="mt-1 flex gap-2 text-xs text-ash"><span>{row.severity}</span><span>· {areas[row.area]}</span><span>· {row.source}</span></div></td><td className="p-4"><div>{row.user?.name || row.user?.email || "Platform service"}</div>{row.user?.name && <div className="mt-1 text-xs text-ash">{row.user.email}</div>}{row.project && <Link className="mt-1 block text-xs text-signal-soft hover:underline" href={`/admin/projects/${row.project.id}`}>{row.project.name} ↗</Link>}</td><td className="p-4"><span className="pill text-xs">{statuses[row.status]}</span></td><td className="p-4 text-right"><div>{row.occurrences}×</div><time className="mt-1 block text-xs text-ash" dateTime={row.lastSeenAt}>{date(row.lastSeenAt)}</time></td></tr>)}{data && !data.incidents.length && <tr><td colSpan={4} className="p-10 text-center text-ash">No recorded errors match this view. Monitoring starts with this release.</td></tr>}{!data && !error && <tr><td colSpan={4} className="p-10 text-center text-ash">Loading platform errors…</td></tr>}</tbody></table></div><div className="flex justify-between items-center p-3 text-xs text-ash"><span>{data?.total ?? 0} incidents{data?.checkedAt ? ` · checked ${new Date(data.checkedAt).toLocaleTimeString()}` : ""}</span><div className="flex items-center gap-3"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page}</span><button className="btn btn-ghost btn-sm" disabled={!data || page * 30 >= data.total} onClick={() => setPage(p => p + 1)}>Next</button></div></div></div>
    {current && <IncidentDetails key={current.id} incident={current} reload={load} />}
    <p className="text-xs text-ash">Suggested checks are based on error patterns, not a confirmed diagnosis. Browser reports are unverified. A total database or hosting outage requires the hosting provider’s logs.</p>
  </div>;
}
function IncidentDetails({ incident, reload }: { incident: Incident; reload: () => Promise<void> }) {
  const [note, setNote] = useState(incident.note), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function update(status: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/errors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: incident.id, status, revision: incident.revision, note }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update incident.");
      await reload();
    } catch (error) { setError(error instanceof Error ? error.message : "Update failed."); await reload(); }
    finally { setBusy(false); }
  }
  return <section aria-label="Incident details" className="rounded-2xl border border-graphite bg-ink p-6 space-y-5"><div><h2 className="text-lg font-semibold">{incident.title}</h2><p className="mt-2 text-sm text-fog">{incident.explanation}</p><p className="mt-2 text-xs text-ash">First seen {date(incident.firstSeenAt)} · Latest {date(incident.lastSeenAt)} · {incident.occurrences} occurrences</p></div><div><h3 className="text-sm font-medium">What to check</h3><ol className="list-decimal pl-5 mt-3 space-y-2 text-sm text-fog">{incident.steps.map(step => <li key={step}>{step}</li>)}</ol></div><div className="flex flex-wrap gap-3">{incident.project && <Link className="btn btn-outline btn-sm" href={`/admin/projects/${incident.project.id}`}>Open project & preview ↗</Link>}{incident.userId && <Link className="btn btn-outline btn-sm" href={`/admin/projects?owner=${incident.userId}`}>User’s projects ↗</Link>}{incident.source.startsWith("email") && <Link className="btn btn-outline btn-sm" href="/admin/email">Email deliveries ↗</Link>}{incident.source.startsWith("billing") && <Link className="btn btn-outline btn-sm" href="/admin/payments">Payments ↗</Link>}</div><details open><summary className="cursor-pointer text-sm font-medium">Sanitized diagnostic details</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-void p-4 text-xs font-mono text-fog">{incident.message}{incident.stack ? `\n\n${incident.stack}` : ""}</pre><div className="mt-3 text-xs text-ash font-mono break-all">Reference: {incident.id}<br />Code: {incident.code}{incident.route && <><br />Route: {incident.route}</>}{incident.runId && <><br />Agent run: {incident.runId}</>}{incident.release && <><br />Release: {incident.release.slice(0, 12)}</>}</div></details><div><label htmlFor="incident-note" className="text-sm font-medium">Investigation note</label><textarea id="incident-note" className="input mt-2 w-full" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="What was checked or fixed? Do not include credentials." /></div>{error && <p role="alert" className="text-sm text-red-400">{error}</p>}<div className="flex flex-wrap gap-3"><button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void update("INVESTIGATING")}>Mark in progress</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void update("RESOLVED")}>Mark resolved</button><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void update(incident.status)}>Save note</button>{incident.status === "RESOLVED" && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void update("NEW")}>Reopen</button>}</div><p className="text-xs text-ash">A resolved error reopens automatically if it occurs again.</p></section>;
}
