"use client";
import { useEffect } from "react";
import { expectedOperationalError, redactIncidentText } from "@/lib/platform-error-details";

/** A request cancelled by navigation or an unmount is not an interface failure. */
export function isCancelledRequest(error: Error): boolean {
  return error.name === "AbortError" || /\baborted\b|AbortError/i.test(error.message);
}

export function reportBrowserError(error: Error) {
  if (isCancelledRequest(error) || expectedOperationalError(error)) return;
  const key = redactIncidentText(error.message).slice(0, 200);
  if (seen.has(key) || seen.size >= 8) return;
  seen.add(key);
  void fetch("/api/monitoring", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: redactIncidentText(error.message).slice(0, 2000), stack: redactIncidentText(error.stack || "").slice(0, 4000), path: location.pathname }), keepalive: true }).catch(() => {});
}
const seen = new Set<string>();
export function PlatformErrorReporter() {
  useEffect(() => {
    const ours = (stack: string) => stack.includes(`${location.origin}/_next/`);
    const onError = (event: ErrorEvent) => {
      if (event.error instanceof Error && (event.filename.startsWith(`${location.origin}/_next/`) || ours(event.error.stack || ""))) reportBrowserError(event.error);
    };
    const onRejection = (event: PromiseRejectionEvent) => { if (event.reason instanceof Error && ours(event.reason.stack || "")) reportBrowserError(event.reason); };
    window.addEventListener("error", onError); window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
