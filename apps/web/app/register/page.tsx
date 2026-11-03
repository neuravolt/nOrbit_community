"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/src/lib/api";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Building2,
  User,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Inbox
} from "lucide-react";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Resend verification state
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/auth/customer/register", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        organizationName: organizationName.trim(),
      });
      setSuccess(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Registration failed. Please check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setResendMessage(null);
    try {
      await api.post("/auth/resend-verification", {
        email: email.trim().toLowerCase(),
      });
      setResendMessage("Verification email has been resent! Please check your inbox.");
      setResendCooldown(60);
    } catch (err: any) {
      setResendMessage(
        err.response?.data?.message ||
          "Failed to resend. Please wait a moment and try again.",
      );
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFBFD] p-4 text-slate-900 font-[Inter]">
        <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-xl shadow-slate-200/50">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
            <CheckCircle2 size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Verify Your Email
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              We sent a verification link to{" "}
              <strong className="text-blue-600 font-semibold">{email}</strong>.
              Please check your inbox and click the link to activate your nORBIT account.
            </p>
          </div>

          {resendMessage && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium leading-relaxed">
              {resendMessage}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-md shadow-blue-600/20 active:scale-[0.99]"
            >
              Return to Sign In <ArrowRight size={16} />
            </Link>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCw size={14} className={resending ? "animate-spin" : ""} />
              {resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : resending
                ? "Resending..."
                : "Didn't receive it? Resend Email"}
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 text-left flex items-start gap-2.5">
            <Inbox size={16} className="text-slate-400 shrink-0 mt-0.5" />
            <span>
              Tip: If you do not see the email within 1–2 minutes, please check your <strong>Spam</strong> or <strong>Promotions</strong> folder.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#FBFBFD] px-4 py-12 text-slate-900 font-[Inter]">
      <div className="w-full max-w-lg space-y-8 relative z-10">
        {/* Header with official logo */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block group">
            <div className="h-10 relative flex items-center justify-center mx-auto mb-2">
              <img
                src="/brand/norbit-logo.png"
                alt="nORBIT"
                className="h-9 w-auto object-contain"
              />
            </div>
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Create your enterprise account
          </h1>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            One platform for your projects, CRM, billing, and autonomous operations.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/50">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  First Name
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ajay"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tomar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password (min 8 characters)
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Company / Organization Name
              </label>
              <div className="relative">
                <Building2
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="NeuraVolt Technologies"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50/60 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-sm transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Creating account...
                </>
              ) : (
                <>
                  Start 14-Day Free Trial <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200/80 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-700 font-bold transition hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-slate-400" />
          Protected by NeuraVolt sovereign enterprise encryption.
        </p>
      </div>
    </div>
  );
}
