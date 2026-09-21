import Link from "next/link";
import { Monitor, ArrowLeft } from "@/components/icons";
import { Logo } from "@/components/Logo";

/**
 * The workspace (builder, editor, live preview) is desktop-only. On phones and
 * small tablets we show this screen instead of a cramped, half-working UI.
 * Rendered with `lg:hidden`; the real shell is wrapped in `hidden lg:contents`.
 */
export function MobileGate({ area = "workspace" }: { area?: string }) {
  return (
    <div className="lg:hidden min-h-screen bg-void text-paper flex flex-col items-center justify-center text-center px-6 py-10 gap-6">
      <Logo />
      <div className="w-16 h-16 rounded-2xl bg-signal/15 text-signal-soft grid place-items-center"><Monitor size={28} /></div>
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">The {area} needs a bigger screen</h1>
        <p className="mt-3 text-sm text-fog leading-relaxed">IDÆVIA Build runs a code editor, a live preview and an AI chat side by side. Open it on a laptop, a desktop or the IDÆVIA desktop app. Your projects and credits are waiting there.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
        <Link href="/" className="btn btn-outline w-full"><ArrowLeft size={14} />Back to the site</Link>
        <Link href="/pricing" className="btn btn-signal w-full">See plans</Link>
      </div>
      <p className="text-[11px] text-ash">Tip: on a tablet, rotate to landscape or use a screen wider than 1024px.</p>
    </div>
  );
}
