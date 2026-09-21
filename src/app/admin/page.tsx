import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/app/Shell";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminPanel } from "@/components/app/AdminPanel";

export default async function Admin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/app");
  return (
    <Shell user={user}>
      <PageHeader title="Admin" subtitle="Models, tiers, credits, users" />
      <div className="flex-1 overflow-y-auto"><AdminPanel /></div>
    </Shell>
  );
}
