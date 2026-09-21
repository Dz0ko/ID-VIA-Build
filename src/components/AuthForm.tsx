"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export function AuthForm({ mode, whopEnabled }: { mode: "login" | "signup"; whopEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? `Whop sign-in failed (${params.get("error")}).` : null);
  const [loading, setLoading] = useState(false);

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
    router.push(params.get("next") ?? "/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-8 w-full max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-ash mt-1">{mode === "login" ? "Log in to your workspace." : "Free plan. No card required."}</p>
      </div>
      {whopEnabled ? (
        <a href="/api/auth/whop" className="btn btn-primary w-full">Continue with Whop</a>
      ) : (
        <div className="text-xs text-ash border border-dashed border-graphite rounded-lg p-3">
          Whop login appears here once <code className="font-mono">WHOP_APP_ID</code> is set. Use email below.
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-ash"><span className="h-px flex-1 bg-graphite" />or<span className="h-px flex-1 bg-graphite" /></div>
      {mode === "signup" && (
        <label className="block text-sm"><span className="label">Name</span><input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>
      )}
      <label className="block text-sm"><span className="label">Email</span><input required type="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
      <label className="block text-sm"><span className="label">Password</span><input required type="password" minLength={8} className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" /></label>
      {error && <div className="text-sm text-error">{error}</div>}
      <button disabled={loading} className="btn btn-primary w-full">{loading ? "…" : mode === "login" ? "Log in" : "Create account"}</button>
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
