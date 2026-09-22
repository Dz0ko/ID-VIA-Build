"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { whopTrack } from "@/components/WhopPixel";

type Providers = { google: boolean; github: boolean };

const ERRORS: Record<string, string> = {
  google_failed: "Google sign-in failed. Please try again.",
  github_failed: "GitHub sign-in failed. Please try again.",
  google_state: "Google sign-in expired. Please try again.",
  github_state: "GitHub sign-in expired. Please try again.",
  google_not_configured: "Google sign-in is currently unavailable. Please use email and password.",
  github_not_configured: "GitHub sign-in is currently unavailable. Please use email and password.",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  );
}

export function AuthForm({ mode, providers }: { mode: "login" | "signup"; providers: Providers }) {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") ?? "/app";
  // Same-site paths only (no "//evil.com" or absolute URLs).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const e = params.get("error");
    return e ? ERRORS[e] ?? "Sign-in failed. Please try again." : null;
  });
  const [loading, setLoading] = useState(false);
  const verb = mode === "login" ? "Continue" : "Sign up";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    whopTrack(mode === "signup" ? "complete_registration" : "login", { method: "email" });
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-8 w-full max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-ash mt-1">{mode === "login" ? "Log in to your workspace." : "Free plan. No card required."}</p>
      </div>

      {(providers.google || providers.github) && (
        <>
          <div className="grid gap-2">
            {providers.google && (
              <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="btn btn-outline w-full gap-2.5">
                <GoogleIcon />{verb} with Google
              </a>
            )}
            {providers.github && (
              <a href={`/api/auth/github?next=${encodeURIComponent(next)}`} className="btn btn-outline w-full gap-2.5">
                <GitHubIcon />{verb} with GitHub
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-ash"><span className="h-px flex-1 bg-graphite" />or with email<span className="h-px flex-1 bg-graphite" /></div>
        </>
      )}

      {mode === "signup" && (
        <label className="block text-sm"><span className="label">Name</span><input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>
      )}
      <label className="block text-sm"><span className="label">Email</span><input required type="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" /></label>
      <label className="block text-sm"><span className="label">Password</span><input required type="password" minLength={8} className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
      {error && <div className="text-sm text-error">{error}</div>}
      <button disabled={loading} className="btn btn-primary w-full">{loading ? "…" : mode === "login" ? "Log in" : "Create account"}</button>
      {mode === "signup" && (
        <p className="text-[11px] text-ash text-center">By creating an account you agree to the <Link href="/terms" className="underline hover:text-paper">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-paper">Privacy Policy</Link>.</p>
      )}
      <p className="text-xs text-ash text-center">
        {mode === "login" ? (
          <>No account? <Link href="/signup" className="text-paper underline">Sign up</Link></>
        ) : (
          <>Have an account? <Link href="/login" className="text-paper underline">Log in</Link></>
        )}
      </p>
    </form>
  );
}
