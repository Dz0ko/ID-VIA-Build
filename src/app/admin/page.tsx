import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin-stats";
import { Shell } from "@/components/app/Shell";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminOverview } from "@/components/app/AdminOverview";
import { AdminPanel } from "@/components/app/AdminPanel";
import { AffiliatesPanel } from "@/components/app/AffiliatesPanel";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/app");
  const stats = await getAdminStats();
  return (
    <Shell user={user}>
      <PageHeader title="Admin" subtitle="Business overview, users, plans, models and credits" />
      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        <AdminOverview s={stats} />
        <div>
          <h2 className="text-sm font-medium mb-4">Growth: affiliates and referrals</h2>
          <AffiliatesPanel />
        </div>
        <div>
          <h2 className="text-sm font-medium mb-4">Configuration</h2>
          <AdminPanel />
        </div>
      </div>
    </Shell>
  );
}
