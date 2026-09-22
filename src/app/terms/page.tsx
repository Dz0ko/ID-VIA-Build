import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_CONTACT, LegalPage, Section } from "@/components/LegalPage";
import { CREDIT_PACKS, PLANS } from "@/lib/plans";
import { MARKETPLACE_FEE_PCT } from "@/lib/marketplace";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms that govern your use of IDÆVIA Build." };

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These Terms are a binding agreement between you and IDÆVIA (“we”, “us”) for the use of IDÆVIA Build at idaevia.app, including the web app, desktop app, marketplace, affiliate programme and hosted sites (the “Service”). By creating an account or using the Service you accept these Terms and our Privacy Policy."
    >
      <Section title="1. Your account">
        <p>You must be at least 16 years old and provide accurate information. You are responsible for everything that happens under your account and for keeping your password and devices secure. Tell us immediately at <a className="text-paper underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a> if you suspect unauthorised access. One person may not hold multiple free accounts to obtain extra credits.</p>
      </Section>

      <Section title="2. Plans, credits and payments">
        <p><strong className="text-paper">Plans.</strong> The Free plan includes {PLANS.FREE.credits} credits per month. Paid plans are monthly subscriptions: Starter ${PLANS.STARTER.price} ({PLANS.STARTER.credits.toLocaleString()} credits), Pro ${PLANS.PRO.price} ({PLANS.PRO.credits.toLocaleString()} credits), Max ${PLANS.MAX.price} ({PLANS.MAX.credits.toLocaleString()} credits) and Agency ${PLANS.AGENCY.price} ({PLANS.AGENCY.credits.toLocaleString()} credits). Prices are in US dollars and exclude any taxes that apply where you live. Current prices and inclusions are always shown on the <Link href="/pricing" className="text-paper underline">pricing page</Link>, which forms part of these Terms.</p>
        <p><strong className="text-paper">Billing.</strong> Payments are processed by Whop. Subscriptions renew automatically every 30 days until you cancel. You can cancel at any time from your Whop account or the billing page; your plan stays active until the end of the paid period and then reverts to Free. We do not offer partial refunds for unused time, except where required by law.</p>
        <p><strong className="text-paper">Credits.</strong> Credits measure AI work (roughly: a small edit costs a few credits, a full page tens, a full-stack feature more). Credit costs are estimated before each run and shown in the app. Plan credits are renewed monthly; Pro and higher plans roll over up to 25% of unused plan credits. Credit packs ({CREDIT_PACKS.map((c) => `${c.credits.toLocaleString()} for $${c.price}`).join(", ")}) are one-time purchases available on paid plans; purchased credits never expire while your account exists and are spent after your plan credits. Credits have no cash value, cannot be transferred and are not refundable once used. If a generation fails on our side, the credits for that run are refunded automatically.</p>
        <p><strong className="text-paper">Price changes.</strong> We may change prices or plan contents with at least 30 days’ notice by email or in the app. Changes apply from your next renewal.</p>
      </Section>

      <Section title="3. AI-generated content">
        <p>The Service uses third-party AI models. Output is generated automatically and may be inaccurate, incomplete, insecure or similar to output produced for other users. You are responsible for reviewing and testing everything before you rely on it or publish it. Subject to these Terms, you own the code and content generated in your projects and may use it for any lawful purpose. We do not claim rights over your prompts or output, but you grant us the licence in section 5 so we can operate the Service.</p>
      </Section>

      <Section title="4. Acceptable use">
        <p>You may not use the Service to: break the law or infringe others’ rights; build or host phishing pages, malware, scams, spam or deceptive sites; generate sexual content involving minors, or content that harasses, threatens or incites violence; collect personal data without a lawful basis; attempt to bypass credit limits, rate limits, plan restrictions, security controls or the payment flow; probe, scan or attack the Service or other users’ sites; resell access to the Service; or use automated tools to scrape the Service beyond normal use. We may suspend or terminate accounts that break these rules and remove hosted content without notice where necessary.</p>
      </Section>

      <Section title="5. Your content and hosting">
        <p>You keep ownership of the content you create and upload. You grant us a worldwide, non-exclusive licence to store, process, display and transmit it as needed to provide the Service (for example to run AI agents on it, host published sites and show marketplace previews). You confirm you have the rights to everything you upload. Published sites are hosted on our infrastructure at our discretion; we may set fair-use limits on bandwidth and storage and may remove content that violates these Terms.</p>
      </Section>

      <Section title="6. Marketplace">
        <p><strong className="text-paper">Selling.</strong> You may list websites and templates you created and have the right to sell. Listings must be accurate. When an item sells, {100 - MARKETPLACE_FEE_PCT}% of the sale price is credited to your seller balance and IDÆVIA keeps a {MARKETPLACE_FEE_PCT}% platform fee. Balances are paid out by us through Whop on request, subject to a minimum of $10 and any verification Whop requires. You are responsible for taxes on your earnings.</p>
        <p><strong className="text-paper">Buying.</strong> A purchase gives you a licence to install the item into your own projects and modify and deploy it for your own or your clients’ use. You may not resell, redistribute or re-list the item. Because items are digital and delivered instantly, sales are final except where the item is materially different from its listing, in which case contact us within 14 days.</p>
      </Section>

      <Section title="7. Referral and affiliate programme">
        <p>Referral links grant bonus credits to you and the people you refer, as shown in the app. Affiliates approved by us earn a commission on payments made by users they refer, at the rate shown in their affiliate dashboard, paid out through Whop. Self-referrals, fake accounts, misleading promotion, spam and bidding on our brand terms are prohibited and lead to forfeiture of rewards and termination. We may change or end the programme with notice.</p>
      </Section>

      <Section title="8. Our intellectual property">
        <p>The Service, its software, design, brand, icons, templates, lesson content and documentation belong to IDÆVIA and its licensors. You may not copy, modify, reverse-engineer or create derivative works of the Service itself, except for the output you generate.</p>
      </Section>

      <Section title="9. Availability and changes">
        <p>We aim for high availability but the Service is provided “as is” and may be interrupted for maintenance, updates or reasons outside our control, including outages at our AI, hosting or payment providers. We may add, change or remove features at any time. If we discontinue a paid feature you rely on, we will refund the unused part of your current subscription period.</p>
      </Section>

      <Section title="10. Disclaimer and liability">
        <p>To the fullest extent permitted by law, we disclaim all warranties, express or implied, including fitness for a particular purpose and non-infringement. We are not liable for indirect, incidental or consequential damages, loss of profits, data or business, or for damage caused by content generated by AI or by third-party services. Our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim. Nothing in these Terms limits liability that cannot be limited by law, including for fraud or for death or personal injury caused by negligence.</p>
      </Section>

      <Section title="11. Termination">
        <p>You can stop using the Service and delete your account at any time. We may suspend or terminate your account for breach of these Terms, unlawful use, non-payment or if required by law, with notice where reasonable. On termination your right to use the Service ends; published sites may be taken offline and your data is deleted as described in the Privacy Policy. Sections 3, 5, 6, 8, 10 and 12 survive termination.</p>
      </Section>

      <Section title="12. General">
        <p>These Terms are governed by the laws of the Republic of North Macedonia, without affecting mandatory consumer protection rules of the country where you live. Disputes are subject to the courts of Skopje, unless consumer law gives you the right to sue elsewhere. If any provision is invalid, the rest remains in force. We may update these Terms; material changes are announced at least 14 days in advance in the app or by email, and continued use after that date means you accept them. Contact: <a className="text-paper underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.</p>
      </Section>
    </LegalPage>
  );
}
