import { redirect } from "next/navigation";
import { Shell } from "@/components/app/Shell";
import { MobileGate } from "@/components/MobileGate";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  return (
    <>
      <div className="hidden lg:contents"><Shell user={user}>{children}</Shell></div>
      <MobileGate />
    </>
  );
}
