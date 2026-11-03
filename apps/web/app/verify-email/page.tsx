"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/src/lib/api";
import { ArrowRight, CheckCircle2, Loader2, XCircle, ShieldCheck, Mail, RotateCw } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState<string>(
    token ? "Verifying your security token..." : "Missing verification token in URL.",
  );

  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.trim()) {
      setResendMessage("Please enter your registered email address.");
      return;
    }
    setResending(true);
    setResendMessage("");
    try {
      const res = await api.post("/auth/resend-verification", {
        email: resendEmail.trim(),
      });
      setResendMessage(
        res.data?.message || "A fresh verification link has been dispatched! Please check your inbox and Spam folder."
      );
      setResendCooldown(60);
    } catch (err: any) {
      setResendMessage(
        err.response?.data?.message || "Failed to resend verification link. Please check the email address."
      );
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    let isSubscribed = true;
    api
      .post("/auth/verify-email", { token })
      .then((res) => {
        if (!isSubscribed) return;
        setStatus("success");
        setMessage(res.data?.message || "Your email address has been verified successfully!");
      })
      .catch((err) => {
        if (!isSubscribed) return;
        setStatus("error");
        setMessage(
          err.response?.data?.message ||
            "The verification link is invalid or has expired. Please request a fresh one.",
        );
      });

    return () => {
      isSubscribed = false;
    };
  }, [token]);

  return (
    <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-xl shadow-slate-200/50">
      {status === "loading" && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600 shadow-sm">
            <Loader2 size={32} className="animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Verifying Your Email</h2>
          <p className="text-slate-500 text-sm">{message}</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
            <CheckCircle2 size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Email Verified Successfully!
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-md shadow-blue-600/25 active:scale-[0.99]"
            >
              Sign In to Your Workspace <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-sm">
            <XCircle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Verification Failed
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
          </div>

          {/* Resend Verification Link Form */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-left space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Mail size={15} className="text-blue-600" />
              <span>Resend Verification Link</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              If your link has expired, enter your registered email below to receive a fresh verification link instantly:
            </p>

            <form onSubmit={handleResend} className="space-y-2.5">
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
              <button
                type="submit"
                disabled={resending || resendCooldown > 0}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RotateCw size={13} className={resending ? "animate-spin" : ""} />
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : resending
                  ? "Dispatching..."
                  : "Send Fresh Verification Link"}
              </button>
            </form>

            {resendMessage && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium leading-relaxed">
                {resendMessage}
              </div>
            )}
          </div>

          <div className="pt-1 flex flex-col gap-2.5">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition shadow-sm"
            >
              Back to Sign In
            </Link>
            <Link
              href="/register"
              className="text-xs text-blue-600 hover:text-blue-700 font-bold transition hover:underline pt-1"
            >
              Need a new account? Register here →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FBFBFD] px-4 py-12 text-slate-900 font-[Inter]">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <Link href="/" className="inline-block group">
          <img
            src="/brand/norbit-logo.png"
            alt="nORBIT"
            className="h-9 w-auto object-contain mx-auto"
          />
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
            Loading verification...
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>

      <p className="mt-8 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
        <ShieldCheck size={14} className="text-slate-400" />
        nORBIT Sovereign Enterprise Operations
      </p>
    </div>
  );
}
