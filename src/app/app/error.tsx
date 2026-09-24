"use client";
import { useEffect } from "react";
import { reportBrowserError } from "@/components/app/PlatformErrorReporter";
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { if (!error.digest) reportBrowserError(error); }, [error]);
  return <div className="p-8 space-y-4"><h1 className="text-xl font-semibold">This screen could not load</h1><p className="text-sm text-ash">Try again. If the problem continues, contact live support with the screen name and time.</p>{error.digest && <p className="text-xs font-mono text-ash">Reference: {error.digest}</p>}<button className="btn btn-primary" onClick={reset}>Try again</button></div>;
}
