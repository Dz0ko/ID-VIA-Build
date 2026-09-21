import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export const LEGAL_UPDATED = "22 September 2026";
export const LEGAL_CONTACT = "support@idaevia.app";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-graphite">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-4 text-sm text-ash">
            <Link href="/privacy" className="hover:text-paper">Privacy</Link>
            <Link href="/terms" className="hover:text-paper">Terms</Link>
            <Link href="/cookies" className="hover:text-paper">Cookies</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 py-12 md:py-16">
        <p className="label">Legal</p>
        <h1 className="heading mt-3">{title}</h1>
        <p className="mt-3 text-sm text-ash">Last updated: {LEGAL_UPDATED}</p>
        <p className="mt-6 text-fog">{intro}</p>
        <article className="legal mt-10 space-y-8 text-sm leading-relaxed text-fog">{children}</article>
      </main>
      <footer className="border-t border-graphite py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-ash">
          <div>© {new Date().getFullYear()} IDÆVIA. All rights reserved.</div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-paper">Home</Link>
            <Link href="/pricing" className="hover:text-paper">Pricing</Link>
            <a href={`mailto:${LEGAL_CONTACT}`} className="hover:text-paper">{LEGAL_CONTACT}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-medium text-paper mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
