import { AffiliatesPanel } from "@/components/app/AffiliatesPanel";

export default function AdminAffiliatesPage() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-ash max-w-3xl">Create a partner link, set what percentage of every plan payment the partner earns, and share the link. Visitors land on the login page; whoever signs up or logs in (without an existing attribution) is credited to the partner for life. Commissions accumulate in Payouts.</p>
      <AffiliatesPanel />
    </div>
  );
}
