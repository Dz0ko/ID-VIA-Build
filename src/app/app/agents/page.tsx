import { BrandIcon, agentIcon } from "@/components/BrandIcon";
import Link from "next/link";
import { Lock } from "@/components/icons";
import { AGENTS, AGENT_TEAMS, agentAllowed, minPlanForAgent } from "@/lib/agents";
import { requireUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { PageHeader } from "@/components/app/PageHeader";
import { CustomAgents } from "@/components/app/CustomAgents";
import { customAgentsAllowed } from "@/lib/agents-runtime";

export default async function Agents() {
  const user = await requireUser();
  const agents = [...AGENTS].sort((a, b) => a.order - b.order);
  const unlocked = agents.filter((a) => agentAllowed(user.plan, a.id)).length;
  return (
    <>
      <PageHeader title="Agents" subtitle={`${unlocked} of ${agents.length} agents unlocked on ${PLANS[user.plan].name}`}>
        {user.plan !== "AGENCY" && <Link href="/pricing" className="btn btn-outline btn-sm">Unlock more</Link>}
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        <CustomAgents allowed={customAgentsAllowed(user.plan)} userId={user.id} />
        <section>
          <h2 className="text-sm font-medium mb-3">Agent teams</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {AGENT_TEAMS.map((t) => (
              <div key={t.id} className="card p-4"><div className="font-medium text-sm">{t.name}</div><div className="text-xs text-ash mt-1">{t.description}</div></div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-sm font-medium mb-3">Catalog</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {agents.map((a) => {
              const ok = agentAllowed(user.plan, a.id);
              return (
                <div key={a.id} className={`card p-4 ${ok ? "" : "opacity-70"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg grid place-items-center bg-signal/15 text-paper"><BrandIcon name={agentIcon(a.id)} size={15} /></span><span className="font-medium text-sm">{a.name}</span></div>
                    {ok ? <span className="pill text-[10px] text-success border-success/40">Unlocked</span> : <span className="pill text-[10px] flex items-center gap-1"><Lock size={9} />{PLANS[minPlanForAgent(a)].name}</span>}
                  </div>
                  {a.profession && <p className="text-[11px] text-signal-soft mt-1">{a.profession}</p>}
                  <p className="text-xs text-ash mt-2">{a.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
                    <span className="pill">{a.tier} tier</span><span className="pill">{a.multiplier}× credits</span><span className="pill">{a.mode === "rewrite" ? "edits project" : "report"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
