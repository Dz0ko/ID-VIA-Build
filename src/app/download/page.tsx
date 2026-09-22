import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Download", description: "IDÆVIA Build for macOS and Windows." };

const RELEASES = "https://github.com/Dz0ko/ID-VIA-Build/releases/latest";

export default async function Download({ searchParams }: PageProps<"/download">) {
  const sp = await searchParams;
  const os = sp.os === "win" ? "win" : "mac";
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-graphite"><div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between"><Logo /><Link href="/signup" className="btn btn-primary btn-sm">Use in the browser</Link></div></header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16 md:py-24 text-center">
        <p className="label">Desktop app</p>
        <h1 className="heading mt-3">IDÆVIA Build for {os === "mac" ? "macOS" : "Windows"}</h1>
        <p className="mt-4 text-fog max-w-xl mx-auto">The same workspace as the web app, plus a real local shell in the terminal tab: run npm, git and your own tools next to the AI team.</p>
        <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
          <a href={RELEASES} className={`rounded-2xl border p-6 text-left transition ${os === "mac" ? "border-signal bg-signal/5" : "border-graphite hover:border-white/20"}`}><div className="text-lg font-medium">macOS</div><div className="text-sm text-ash mt-1">Apple Silicon and Intel · .dmg</div><div className="mt-4 text-sm text-signal-soft">Download →</div></a>
          <a href={RELEASES} className={`rounded-2xl border p-6 text-left transition ${os === "win" ? "border-signal bg-signal/5" : "border-graphite hover:border-white/20"}`}><div className="text-lg font-medium">Windows</div><div className="text-sm text-ash mt-1">Windows 10 and 11 · .exe installer</div><div className="mt-4 text-sm text-signal-soft">Download →</div></a>
        </div>
        <p className="mt-8 text-xs text-ash">Downloads come from our GitHub releases page. Your account, projects and credits are shared between the desktop and web app.</p>
        <Link href="/" className="inline-block mt-10 text-sm text-ash hover:text-paper">← Back to idaevia.app</Link>
      </main>
    </div>
  );
}
