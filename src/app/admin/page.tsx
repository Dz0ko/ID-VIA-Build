import { getAdminStats } from "@/lib/admin-stats";
import { AdminOverview } from "@/components/app/AdminOverview";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();
  return <AdminOverview s={stats} />;
}
