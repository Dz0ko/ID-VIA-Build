import { ClientPortal } from "@/components/ClientPortal";

export default async function PortalPage({ params }: PageProps<"/portal/[token]">) {
  const { token } = await params;
  return <ClientPortal token={token} />;
}
