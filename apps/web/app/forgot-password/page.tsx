"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/src/lib/api";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError(null);
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to request password reset. Please verify your email and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 py-12 text-slate-100 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.15),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition">
              N
            </div>
            <span className="text-2xl font-black tracking-tight text-white font-[Space_Grotesk]">
              nORBIT
            </span>
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Reset your password
          </h1>
          <p className="text-sm text-slate-400">
            Enter your verified work email address and we will send you a secure recovery link.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          {submitted ? (
            <div className="text-center space-y-5 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Recovery Link Dispatched
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                If an account exists for{" "}
                <span className="text-indigo-400 font-semibold">{email}</span>, you will
                receive an email with instructions to securely reset your password.
              </p>
              <div className="pt-3 space-y-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30"
                >
                  Return to Sign In <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition py-1"
                >
                  Didn't receive it? Try another email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Work Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Dispatching reset link...
                    </>
                  ) : (
                    <>
                      Send Recovery Link <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-3 border-t border-slate-800">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition font-medium"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>

        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-slate-500" />
          <span>NORBIT Cryptographic Recovery • Token Expiry 1 Hour</span>
        </div>
      </div>
    </div>
  );
}
