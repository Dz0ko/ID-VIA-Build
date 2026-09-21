import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/PageHeader";
import { MarketplacePanel } from "@/components/app/MarketplacePanel";

export default async function MarketplacePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Marketplace" subtitle="Templates, prompts, components and agents from the community" />
      <div className="flex-1 overflow-y-auto p-6">
        <MarketplacePanel plan={user.plan} />
      </div>
    </>
  );
}
