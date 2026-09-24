import { PageHeader } from "@/components/app/PageHeader";
import { SupportChat } from "@/components/support/SupportChat";
import { SupportInbox } from "@/components/support/SupportInbox";
import { getCurrentUser } from "@/lib/auth";
import { canManageSupport } from "@/lib/support-access";
import { redirect } from "next/navigation";

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/support");
  if (canManageSupport(user.role)) {
    return <><PageHeader title="Live support" subtitle="Read customer conversations, join the chat and reply in real time." /><div className="flex-1 min-h-0 overflow-auto p-6"><SupportInbox adminId={user.id} /></div></>;
  }
  return <><PageHeader title="Live support" subtitle="Start with IDÆVIA support. Reach a person whenever you need one." /><div className="flex-1 min-h-0 p-6"><div className="max-w-4xl mx-auto h-full"><SupportChat /></div></div></>;
}
