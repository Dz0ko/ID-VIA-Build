import { getFinanceStats } from "@/lib/finance";
import { FinancePanel } from "@/components/admin/FinancePanel";
import { getAdminStats } from "@/lib/admin-stats";
import { AdminOverview } from "@/components/app/AdminOverview";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [stats, finance] = await Promise.all([getAdminStats(), getFinanceStats()]);
  return <div className="space-y-8"><FinancePanel stats={finance} compact /><AdminOverview s={stats} /></div>;
}
