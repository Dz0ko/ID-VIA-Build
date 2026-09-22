import { TrackEvent } from "@/components/TrackEvent";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { MARKETPLACE_FEE_PCT } from "@/lib/marketplace";
import { PageHeader } from "@/components/app/PageHeader";
import { MarketplacePanel } from "@/components/app/MarketplacePanel";

export default async function MarketplacePage() {
  const user = await requireUser();
  return (
    <>
      <TrackEvent event="view_content" props={{ content: "marketplace" }} />
      <PageHeader title="Marketplace" subtitle={`Buy and sell websites, apps, components, prompts and agents. Payments by Whop, ${MARKETPLACE_FEE_PCT}% platform fee.`} />
      <div className="flex-1 overflow-y-auto p-6">
        <Suspense><MarketplacePanel plan={user.plan} feePct={MARKETPLACE_FEE_PCT} /></Suspense>
      </div>
    </>
  );
}
