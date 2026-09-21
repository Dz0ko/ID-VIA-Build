import { requireUser } from "@/lib/auth";
import { providerStatus } from "@/lib/ai/router";
import { PageHeader } from "@/components/app/PageHeader";
import { AssistantChat } from "@/components/app/AssistantChat";

export default async function AssistantPage() {
  const user = await requireUser();
  const providers = providerStatus();
  return (
    <>
      <PageHeader title="IDÆVIA Agent" subtitle="Ideas for projects and SaaS products, design directions, and ready-to-build briefs. Your conversation is saved." />
      <AssistantChat offline={!providers.anthropic && !providers.openai} name={user.name ?? user.email} />
    </>
  );
}
