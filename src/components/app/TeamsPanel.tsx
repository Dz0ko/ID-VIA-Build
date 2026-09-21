"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, Lock, Trash2, Palette, FolderPlus } from "@/components/icons";

type Member = { id: string; email: string; role: string; status: string };
type Project = { id: string; name: string; status: string; clientStatus: string; slug: string };
type Team = { id: string; name: string; slug: string; ownerId: string; myRole: string; whiteLabel: Record<string, string | boolean>; members: Member[]; projects?: Project[]; _count?: { projects: number } };
const ROLES = ["ADMIN", "DEVELOPER", "DESIGNER", "EDITOR", "VIEWER"];

export function TeamsPanel({ allowed, myEmail }: { allowed: boolean; myEmail: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [active, setActive] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState({ email: "", role: "EDITOR" });
  const [wl, setWl] = useState<Record<string, string | boolean>>({});
  const [myProjects, setMyProjects] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/teams").then((r) => r.json());
    setTeams(d.teams ?? []);
  }, []);
  const open = useCallback(async (id: string) => {
    const d = await fetch(`/api/teams/${id}`).then((r) => r.json());
    if (d.team) { setActive(d.team); setWl(d.team.whiteLabel ?? {}); }
    const p = await fetch("/api/projects").then((r) => r.json());
    setMyProjects(p.projects ?? []);
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function create() {
    const res = await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error);
    setName(""); load(); open(d.team.id);
  }
  async function patch(body: Record<string, unknown>) {
    if (!active) return;
    const res = await fetch(`/api/teams/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error);
    setMsg("Saved"); setTimeout(() => setMsg(null), 1500); open(active.id); load();
  }
  async function remove() {
    if (!active || !confirm(`Delete team "${active.name}"?`)) return;
    await fetch(`/api/teams/${active.id}`, { method: "DELETE" }); setActive(null); load();
  }

  if (!allowed && teams.length === 0)
    return (
      <div className="card p-8 max-w-xl">
        <div className="flex items-center gap-2 text-sm font-medium"><Lock size={14} />Teams are an Agency feature</div>
        <p className="text-sm text-ash mt-2">Invite members with roles, attach client projects, share password-protected client portals with comments and approvals, and white-label everything with your own brand.</p>
        <Link href="/pricing" className="btn btn-primary btn-sm mt-4">Upgrade to Agency</Link>
      </div>
    );

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div className="space-y-3">
        {allowed && (
          <div className="card p-3 flex gap-2">
            <input className="input" placeholder="New team / agency name" value={name} onChange={(e) => setName(e.target.value)} />
            <button disabled={name.length < 2} onClick={create} className="btn btn-primary btn-sm">Create</button>
          </div>
        )}
        {teams.map((t) => (
          <button key={t.id} onClick={() => open(t.id)} className={`card w-full text-left p-3 hover:border-ash ${active?.id === t.id ? "border-signal" : ""}`}>
            <div className="text-sm font-medium flex items-center gap-2"><Users size={13} className="text-ash" />{t.name}</div>
            <div className="text-[11px] text-ash mt-1">{t.members.length} members · {t._count?.projects ?? 0} projects · you: {t.myRole}</div>
          </button>
        ))}
        {teams.length === 0 && <div className="text-xs text-ash px-1">No teams yet.</div>}
      </div>

      {active ? (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div><h2 className="text-sm font-medium">{active.name}</h2><div className="text-[11px] text-ash font-mono">{active.slug}</div></div>
              <div className="flex items-center gap-2">{msg && <span className="text-xs text-success">{msg}</span>}{active.myRole === "OWNER" && <button onClick={remove} className="btn btn-ghost btn-sm text-ash hover:text-error"><Trash2 size={12} /></button>}</div>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-medium">Members</h3>
            <table className="w-full text-xs">
              <tbody>
                {active.members.map((m) => (
                  <tr key={m.id} className="border-b border-graphite/60">
                    <td className="py-2">{m.email}{m.email === myEmail && <span className="ml-1 text-ash">(you)</span>}</td>
                    <td className="py-2"><span className={`pill text-[10px] ${m.status === "PENDING" ? "text-warning border-warning/40" : ""}`}>{m.status === "PENDING" ? "Invited" : "Active"}</span></td>
                    <td className="py-2">
                      {m.role === "OWNER" ? <span className="pill text-[10px]">OWNER</span> : (
                        <select className="input py-1 w-32" value={m.role} onChange={(e) => patch({ setRole: { email: m.email, role: e.target.value } })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                      )}
                    </td>
                    <td className="py-2 text-right">{m.role !== "OWNER" && <button onClick={() => patch({ removeEmail: m.email })} className="text-ash hover:text-error"><Trash2 size={12} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2">
              <input className="input" placeholder="teammate@company.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              <select className="input w-36" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              <button disabled={!invite.email.includes("@")} onClick={() => { patch({ invite }); setInvite({ email: "", role: "EDITOR" }); }} className="btn btn-primary btn-sm">Invite</button>
            </div>
            <p className="text-[11px] text-ash">Invited people get access automatically when they sign up with that email.</p>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2"><Palette size={13} />White label</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <label><span className="label">Brand name</span><input className="input mt-1" value={String(wl.brandName ?? "")} onChange={(e) => setWl({ ...wl, brandName: e.target.value })} placeholder="Northform Studio" /></label>
              <label><span className="label">Logo URL</span><input className="input mt-1" value={String(wl.logoUrl ?? "")} onChange={(e) => setWl({ ...wl, logoUrl: e.target.value })} placeholder="https://…/logo.png" /></label>
              <label><span className="label">Accent colour</span><input className="input mt-1" value={String(wl.accent ?? "")} onChange={(e) => setWl({ ...wl, accent: e.target.value })} placeholder="#5b5cff" /></label>
              <label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={Boolean(wl.hideIdaevia)} onChange={(e) => setWl({ ...wl, hideIdaevia: e.target.checked })} />Hide “Powered by IDÆVIA” in client portals</label>
              <label className="sm:col-span-2"><span className="label">Portal welcome message</span><textarea className="input mt-1" value={String(wl.portalWelcome ?? "")} onChange={(e) => setWl({ ...wl, portalWelcome: e.target.value })} placeholder="Hi! Review the draft below and leave comments or approve." /></label>
            </div>
            <button onClick={() => patch({ whiteLabel: wl })} className="btn btn-primary btn-sm">Save white label</button>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2"><FolderPlus size={13} />Client projects</h3>
            {(active.projects ?? []).length === 0 && <div className="text-xs text-ash">No projects attached. Attach a project so client portals use this team’s white label.</div>}
            {(active.projects ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs border-b border-graphite/60 py-2">
                <Link href={`/app/projects/${p.id}`} className="hover:underline">{p.name}</Link>
                <div className="flex items-center gap-2"><span className="pill text-[10px]">{p.clientStatus === "NONE" ? "no portal" : p.clientStatus.toLowerCase().replace("_", " ")}</span><button onClick={() => patch({ detachProjectId: p.id })} className="text-ash hover:text-error">detach</button></div>
              </div>
            ))}
            <div className="flex gap-2">
              <select id="attach" className="input"><option value="">Attach one of my projects…</option>{myProjects.filter((p) => !(active.projects ?? []).some((x) => x.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <button onClick={() => { const el = document.getElementById("attach") as HTMLSelectElement; if (el.value) patch({ attachProjectId: el.value }); }} className="btn btn-outline btn-sm">Attach</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-sm text-ash">Select a team to manage members, white label and client projects. Client portal links are created from each project’s <b>Share</b> tab in the workspace.</div>
      )}
    </div>
  );
}
