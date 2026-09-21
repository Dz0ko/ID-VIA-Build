import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/PageHeader";
import { ImportPanel } from "@/components/app/ImportPanel";

export default async function ImportPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Import" subtitle="Start from a live website, a GitHub repository, a ZIP or a screenshot" />
      <div className="flex-1 overflow-y-auto p-6">
        <ImportPanel plan={user.plan} />
      </div>
    </>
  );
}
