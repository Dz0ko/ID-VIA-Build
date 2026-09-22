import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_CONTACT, LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Cookie Policy", description: "Which cookies IDÆVIA Build uses and why." };

const COOKIES = [
  { name: "idaevia_session", purpose: "Keeps you signed in. A signed, HTTP-only token that identifies your session.", duration: "30 days", type: "Strictly necessary" },
  { name: "idaevia_ref", purpose: "Remembers the referral or affiliate code you arrived with so the referrer is credited when you sign up.", duration: "30 days", type: "Strictly necessary (functional)" },
  { name: "oauth_state, oauth_next", purpose: "Protect Google and GitHub sign-in against cross-site request forgery and return you to the page you came from. Set only during sign-in.", duration: "10 minutes", type: "Strictly necessary" },
  { name: "idaevia_cookie_notice", purpose: "Remembers that you have dismissed the cookie notice.", duration: "12 months", type: "Preference" },
];

export default function Cookies() {
  return (
    <LegalPage
      title="Cookie Policy"
      intro="Cookies are small text files stored in your browser. IDÆVIA Build uses only the cookies needed to run the Service. We do not use advertising, tracking or third-party analytics cookies."
    >
      <Section title="1. Cookies we set">
        <div className="overflow-x-auto rounded-xl border border-graphite">
          <table className="w-full text-xs">
            <thead className="bg-ink text-ash">
              <tr><th className="text-left p-3 font-medium">Cookie</th><th className="text-left p-3 font-medium">Purpose</th><th className="text-left p-3 font-medium">Duration</th><th className="text-left p-3 font-medium">Type</th></tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.name} className="border-t border-graphite align-top">
                  <td className="p-3 font-mono text-paper whitespace-nowrap">{c.name}</td>
                  <td className="p-3">{c.purpose}</td>
                  <td className="p-3 whitespace-nowrap">{c.duration}</td>
                  <td className="p-3 whitespace-nowrap">{c.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Because all of these cookies are necessary for the Service to work or store a choice you made, they do not require consent under the ePrivacy rules. The notice shown on your first visit is informational.</p>
      </Section>

      <Section title="2. Local storage">
        <p>The app may store non-personal preferences in your browser’s local storage (for example the last open project, editor layout or dismissed tips). This data never leaves your device and is cleared when you clear site data.</p>
      </Section>

      <Section title="3. Third-party cookies">
        <p>When you pay, you are taken to Whop’s checkout, which sets its own cookies under Whop’s cookie policy. When you sign in with Google or GitHub, those providers set cookies on their own domains. Sites you publish on IDÆVIA hosting are served from a separate origin and do not receive IDÆVIA Build cookies.</p>
      </Section>

      <Section title="4. Managing cookies">
        <p>You can delete or block cookies in your browser settings. Blocking the session cookie will sign you out and prevent you from using the app. Questions: <a className="text-paper underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>. See also our <Link href="/privacy" className="text-paper underline">Privacy Policy</Link>.</p>
      </Section>
    </LegalPage>
  );
}
