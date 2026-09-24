import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { MobileGate } from "@/components/MobileGate";

export const dynamic = "force-dynamic";

/** Standalone admin console: its own shell, only for ADMIN accounts. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role === "SUPPORTER") redirect("/app/support");
  if (user.role !== "ADMIN") redirect("/app");
  return (
    <>
      <div className="hidden lg:contents"><AdminShell user={user}>{children}</AdminShell></div>
      <MobileGate area="admin console" />
    </>
  );
}
