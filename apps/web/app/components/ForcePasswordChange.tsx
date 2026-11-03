"use client";

// Shown instead of the app while a new employee is still on the one-time password HR gave them.
import { useState } from "react";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { api } from "@/src/lib/api";
import { useAuthStore } from "@/src/store/auth";

export function ForcePasswordChange() {
  const { logout } = useAuthStore() as { logout?: () => void };
  const [oldPw, setOldPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("The two new passwords do not match.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", { oldPassword: oldPw, newPassword: pw });
      // Changing the password ends every session, this one too: sign in again with the new one.
      logout?.();
      window.location.href = "/login";
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string | string[] } } };
      const m = e2?.response?.data?.message;
      setError((Array.isArray(m) ? m.join(", ") : m) || "Could not change the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 space-y-5">
        <div className="space-y-2">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
          <h1 className="text-xl font-bold text-slate-900">Choose your own password</h1>
          <p className="text-sm text-slate-500">You signed in with the one-time password from HR. Set your own password; then sign in again with it.</p>
        </div>
        {[
          { label: "One-time password from HR", value: oldPw, set: setOldPw, ac: "current-password" },
          { label: "New password", value: pw, set: setPw, ac: "new-password" },
          { label: "Type the new password again", value: pw2, set: setPw2, ac: "new-password" },
        ].map((f) => (
          <label key={f.label} className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">{f.label}</span>
            <input type="password" autoComplete={f.ac} value={f.value} onChange={(e) => f.set(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
        ))}
        {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save and continue
        </button>
        {logout && <button type="button" onClick={() => logout()} className="w-full inline-flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-800"><LogOut className="w-4 h-4" /> Sign out</button>}
      </form>
    </div>
  );
}
