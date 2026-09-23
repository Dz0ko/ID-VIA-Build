import { PageHeader } from "@/components/app/PageHeader";
import { SupportChat } from "@/components/support/SupportChat";
export default function SupportPage() {
  return <><PageHeader title="Live support" subtitle="Start with IDÆVIA support. Reach a person whenever you need one." /><div className="flex-1 min-h-0 p-6"><div className="max-w-4xl mx-auto h-full"><SupportChat /></div></div></>;
}
