"use client";

// Public page a new employee opens from their invite email to choose their own password.
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { api } from "../../src/lib/api";

function SetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneFor, setDoneFor] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/set-password", { token, newPassword: pw });
      setDoneFor(data?.email || "your account");
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      setError(e2?.response?.data?.message || "Could not set the password. Ask HR for a new link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <div className="text-center space-y-3">
          <img src="/norbit-logo.png" alt="nORBIT" className="h-10 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">{doneFor ? "Password set" : "Set your password"}</h1>
          <p className="text-sm text-slate-500">{doneFor ? `You can now sign in as ${doneFor}.` : "Choose the password you will use to sign in to nORBIT."}</p>
        </div>
        {doneFor ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <Link href="/login" className="inline-flex justify-center w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Go to sign in</Link>
          </div>
        ) : !token ? (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">This link is incomplete. Open the link from your invite email again, or ask HR for a new one.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-600">New password</span>
              <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-600">Type it again</span>
              <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </label>
            {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Set password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return <Suspense fallback={null}><SetPasswordForm /></Suspense>;
}
