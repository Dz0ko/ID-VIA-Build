import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/PageHeader";
import { IntegrationsPanel } from "@/components/app/IntegrationsPanel";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect GitHub, Vercel, Supabase, Higgsfield and more. Then use them from any project terminal." />
      <div className="flex-1 overflow-y-auto p-6">
        <Suspense><IntegrationsPanel /></Suspense>
      </div>
    </>
  );
}
