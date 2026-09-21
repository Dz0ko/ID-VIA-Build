import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/PageHeader";
import { TeamsPanel } from "@/components/app/TeamsPanel";
import { planAtLeast } from "@/lib/agents";

export default async function TeamsPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Teams & clients" subtitle="Agency workspace: members, roles, client portals, white-label" />
      <div className="flex-1 overflow-y-auto p-6">
        <TeamsPanel allowed={planAtLeast(user.plan, "AGENCY")} myEmail={user.email} />
      </div>
    </>
  );
}
