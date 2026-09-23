import { EmailUnsubscribe } from "@/components/EmailUnsubscribe";
export const metadata = { title: "Email preferences · IDÆVIA", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function UnsubscribePage({ searchParams }: PageProps<"/email/unsubscribe">) {
  const token = (await searchParams).token;
  return <EmailUnsubscribe token={typeof token === "string" ? token.slice(0, 64) : ""} />;
}
