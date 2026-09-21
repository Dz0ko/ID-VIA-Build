"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ name, avatarUrl, hasPassword }: { name: string; avatarUrl: string; hasPassword: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name, avatarUrl });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(payload: Record<string, string>) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Could not save." });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <form className="card p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); save({ name: form.name, avatarUrl: form.avatarUrl }); }}>
        <h2 className="text-sm font-medium">Profile</h2>
        <label className="block text-sm"><span className="label">Display name</span><input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={2} maxLength={60} required /></label>
        <label className="block text-sm"><span className="label">Avatar URL</span><input className="input mt-1" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} placeholder="https://… (leave empty for initials)" /></label>
        <div className="flex items-center gap-3"><button disabled={busy} className="btn btn-primary btn-sm">Save profile</button>{msg && <span className={`text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</span>}</div>
      </form>

      <form className="card p-5 space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (pw.newPassword !== pw.confirm) return setMsg({ ok: false, text: "Passwords do not match." });
        save({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }).then(() => setPw({ currentPassword: "", newPassword: "", confirm: "" }));
      }}>
        <h2 className="text-sm font-medium">{hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="text-xs text-ash">{hasPassword ? "Use at least 8 characters." : "You signed up with a social account. Add a password to also log in with email."}</p>
        {hasPassword && <label className="block text-sm"><span className="label">Current password</span><input type="password" className="input mt-1" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" required /></label>}
        <label className="block text-sm"><span className="label">New password</span><input type="password" className="input mt-1" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} minLength={8} autoComplete="new-password" required /></label>
        <label className="block text-sm"><span className="label">Confirm</span><input type="password" className="input mt-1" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} minLength={8} autoComplete="new-password" required /></label>
        <button disabled={busy} className="btn btn-outline btn-sm">{hasPassword ? "Update password" : "Set password"}</button>
      </form>
    </div>
  );
}
