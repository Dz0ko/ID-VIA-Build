import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { EmailAdmin } from "@/components/admin/EmailAdmin";
export default async function EmailPage() {
  const user = await getCurrentUser(); if (!user || user.role !== "ADMIN") redirect("/app");
  return <EmailAdmin />;
}
