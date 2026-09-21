import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_CONTACT, LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · IDÆVIA Build", description: "How IDÆVIA Build collects, uses and protects your personal data." };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal data IDÆVIA (“we”, “us”) collects when you use IDÆVIA Build at idaevia.app (the “Service”), why we collect it, who we share it with and the rights you have. We are the data controller for the data described here."
    >
      <Section title="1. Data we collect">
        <p><strong className="text-paper">Account data.</strong> Email address, display name, avatar and a hashed password when you register with email, or the identifier, name, email and avatar returned by Google or GitHub when you sign in with them. We never receive or store your Google or GitHub password.</p>
        <p><strong className="text-paper">Content you create.</strong> Prompts, uploaded reference images, the websites, apps, files, versions and messages you generate, projects you publish, items you list on the marketplace, and settings you choose.</p>
        <p><strong className="text-paper">Billing data.</strong> Your plan, credit balance and credit history, Whop membership and payment identifiers, and the amounts paid. Card numbers and bank details are entered directly with our payment processor Whop and never reach our servers.</p>
        <p><strong className="text-paper">Usage and technical data.</strong> IP address, browser and device information, pages and features used, AI runs (model, tokens, cost), timestamps and error logs, and referral or affiliate codes you arrived with.</p>
      </Section>

      <Section title="2. Why we use it and the legal basis">
        <p><strong className="text-paper">To provide the Service</strong> (performance of a contract): creating your account, running AI agents on your prompts, storing and publishing your projects, granting plan credits and purchased credit packs, paying marketplace sellers and affiliates.</p>
        <p><strong className="text-paper">To keep the Service secure</strong> (legitimate interest): rate limiting, fraud and abuse detection, protecting accounts, verifying payment webhooks, auditing admin actions.</p>
        <p><strong className="text-paper">To improve and support the Service</strong> (legitimate interest): diagnosing errors, measuring which features are used, answering your support requests.</p>
        <p><strong className="text-paper">To comply with law</strong> (legal obligation): tax, accounting and payment regulations, responding to lawful requests.</p>
        <p>We do not sell personal data and we do not use it for third-party advertising.</p>
      </Section>

      <Section title="3. AI processing">
        <p>When you run an agent, your prompt, the current project content and any reference images are sent to our AI model providers, Anthropic (Claude models) and OpenAI (GPT models), to generate the result. These providers process the data on our behalf under their API terms, which state that API inputs are not used to train their models. We do not send your email, password or billing data to AI providers. Please do not include passwords, secrets or other people’s sensitive personal data in prompts.</p>
      </Section>

      <Section title="4. Who we share data with">
        <p>We use a small number of service providers (processors) that only handle data under our instructions:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-paper">Vercel</strong> (hosting and edge network, EU region), including error and access logs.</li>
          <li><strong className="text-paper">Supabase</strong> (PostgreSQL database, hosted in the EU, London region).</li>
          <li><strong className="text-paper">Whop</strong> (payment processing, subscriptions and payouts). Whop is an independent controller for the payment data you enter with them; see their privacy policy.</li>
          <li><strong className="text-paper">Anthropic and OpenAI</strong> (AI model inference, United States).</li>
          <li><strong className="text-paper">Google and GitHub</strong> (optional sign-in). They only receive that you are signing in to IDÆVIA Build.</li>
        </ul>
        <p>Marketplace: when you buy an item, the seller sees an anonymised sale (amount and date), never your email. When you sell, buyers see your display name. Affiliates see counts and commission amounts, never the identity of referred users.</p>
        <p>We may disclose data if required by law, to enforce our Terms, or to protect the rights and safety of users and the public. If IDÆVIA is involved in a merger or acquisition, data may be transferred as part of that transaction under the same protections.</p>
      </Section>

      <Section title="5. International transfers">
        <p>Our servers and database are in the European Union. AI providers and some sub-processors are in the United States. Where data leaves the EU/EEA we rely on the EU Standard Contractual Clauses and the providers’ certifications under the EU-US Data Privacy Framework.</p>
      </Section>

      <Section title="6. Retention">
        <ul className="list-disc pl-5 space-y-1">
          <li>Account and project data: for as long as your account exists. When you delete your account we delete it within 30 days, except data we must keep for legal reasons.</li>
          <li>Billing records: 7 years, as required by accounting and tax law.</li>
          <li>Security and access logs: up to 12 months.</li>
          <li>Payment webhook events: 24 months, for dispute handling.</li>
        </ul>
      </Section>

      <Section title="7. Your rights">
        <p>Under the GDPR and equivalent laws you can ask us to access, correct, export or delete your personal data, restrict or object to certain processing, and withdraw consent where processing is based on it. You can update your name and avatar in Settings and delete your account by emailing us. To exercise any right, write to <a className="text-paper underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>. We answer within 30 days. You also have the right to lodge a complaint with your local data protection authority.</p>
      </Section>

      <Section title="8. Security">
        <p>Passwords are stored as bcrypt hashes. Sessions use signed, HTTP-only, secure cookies. All traffic is encrypted with TLS (HTTPS) and HSTS. Generated websites are rendered in a sandboxed context, separate from the application. Payment webhooks are verified with HMAC signatures. Access to production systems is restricted to authorised staff. No system is perfectly secure; if we learn of a breach affecting you we will notify you and the authorities as required by law.</p>
      </Section>

      <Section title="9. Cookies">
        <p>We only use strictly necessary cookies. Details are in our <Link href="/cookies" className="text-paper underline">Cookie Policy</Link>.</p>
      </Section>

      <Section title="10. Children">
        <p>The Service is not directed at children under 16 and we do not knowingly collect their data. If you believe a child has created an account, contact us and we will delete it.</p>
      </Section>

      <Section title="11. Changes and contact">
        <p>We may update this policy as the Service evolves. Material changes are announced in the app or by email before they take effect. Questions and requests: <a className="text-paper underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>. Controller: IDÆVIA, operator of idaevia.app.</p>
      </Section>
    </LegalPage>
  );
}
