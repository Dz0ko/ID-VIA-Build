import { requireAdmin } from "@/lib/finance";
import { PlatformErrors } from "@/components/admin/PlatformErrors";
export default async function PlatformErrorsPage() {
  await requireAdmin();
  return <PlatformErrors />;
}
