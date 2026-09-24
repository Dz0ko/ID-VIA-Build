import { requireAdmin } from "@/lib/finance";
import { PlatformErrors } from "@/components/admin/PlatformErrors";
import { ProviderHealthPanel } from "@/components/admin/ProviderHealthPanel";
export default async function PlatformErrorsPage() {
  await requireAdmin();
  return <div className="space-y-6"><ProviderHealthPanel /><PlatformErrors /></div>;
}
