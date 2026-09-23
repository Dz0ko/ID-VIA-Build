import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SupportInbox } from "@/components/support/SupportInbox";
export default async function AdminSupportPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/app");
  return <SupportInbox adminId={user.id} />;
}
