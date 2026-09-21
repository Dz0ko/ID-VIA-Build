import { redirect } from "next/navigation";
import { Shell } from "@/components/app/Shell";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  return <Shell user={user}>{children}</Shell>;
}
