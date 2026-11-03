"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/store/auth";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  Fingerprint,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [step, setStep] = useState<"LOGIN" | "2FA">("LOGIN");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isTouchIdLoading, setIsTouchIdLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
      _honeypot: "",
    },
  });

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const onPasswordSubmit = async (data: any) => {
    try {
      setError("");
      setInfo("");

      // Anti-bot honeypot check
      if (data._honeypot) {
        setError("Automated bot activity detected.");
        return;
      }

      const response = await api.post("/auth/login", {
        email: data.email,
        password: data.password,
      });

      // Check if 2FA is required
      if (response.data?.challenge) {
        setResendCooldown(60);
        setMaskedEmail(response.data?.targetEmail || data.email);
        setStep("2FA");
        return;
      }

      // Direct login (if 2FA not enforced for this role)
      const { accessToken, refreshToken, user } = response.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push("/");
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to log in. Please check your credentials.",
      );
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    setError("");

    try {
      const response = await api.post("/auth/verify-2fa", {
        otp: otp.trim(),
      });

      const { accessToken, refreshToken, user } = response.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push("/");
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Invalid or expired verification code. Please try again.",
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const onResendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      setError("");
      setInfo("");
      const email = getValues("email");
      const password = getValues("password");

      const response = await api.post("/auth/login", { email, password });
      if (response.data?.challenge) {
        setResendCooldown(60);
        const target = response.data?.targetEmail || email;
        setMaskedEmail(target);
        setInfo(`A new verification code has been dispatched to ${target}.`);
      }
    } catch (err: any) {
      setError("Failed to resend verification code. Please sign in again.");
    }
  };

  const onResendVerification = async () => {
    const email = getValues("email");
    if (!email || !email.trim()) {
      setError("Please enter your registered email address above first.");
      return;
    }
    try {
      setError("");
      setInfo("Dispatching fresh verification email...");
      const res = await api.post("/auth/resend-verification", {
        email: email.trim(),
      });
      setInfo(
        res.data?.message ||
          "A fresh verification link has been dispatched to your email! Please check your inbox and Spam folder.",
      );
      setResendCooldown(60);
    } catch (err: any) {
      setInfo("");
      setError(
        err.response?.data?.message ||
          "Failed to dispatch verification email. Please check the email address.",
      );
    }
  };

  const onTouchIdLogin = async () => {
    const email = getValues("email");
    if (!email) {
      setError("Please enter your corporate email address first to use Touch ID / Passkey.");
      return;
    }

    setIsTouchIdLoading(true);
    setError("");
    setInfo("");

    try {
      // 1. Get authentication options from server
      const optionsRes = await api.post("/auth/webauthn/login-options", { email });
      const { options, challengeToken } = optionsRes.data;

      // 2. Prompt native Touch ID / Passkey sensor on Mac/Device
      const credential = await startAuthentication({ optionsJSON: options });

      // 3. Verify assertion with server
      const verifyRes = await api.post("/auth/webauthn/login-verify", {
        challengeToken,
        credential,
      });

      const { accessToken, refreshToken, user } = verifyRes.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push("/");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Touch ID prompt was cancelled or timed out.");
      } else {
        setError(
          err.response?.data?.message ||
            "No Passkey / Touch ID enrolled on this device yet. Please sign in with your email and password first.",
        );
      }
    } finally {
      setIsTouchIdLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-blue-100 selection:text-blue-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center">
          <div className="mb-6 flex items-center justify-center">
            <img
              src="/norbit-logo.png"
              alt="nORBIT"
              className="h-10 sm:h-11 w-auto object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {step === "LOGIN" ? "Sign in to your account" : "Two-factor verification"}
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 text-center max-w-sm">
            {step === "LOGIN"
              ? "Enter your corporate credentials to access nORBIT"
              : `Enter the 6-digit security code dispatched to ${maskedEmail || "your email"}`}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 rounded-lg bg-rose-50 border border-rose-200 p-3.5 space-y-2.5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-rose-700 leading-relaxed">{error}</p>
              </div>
              {error.toLowerCase().includes("verify your email") && (
                <div className="pt-2 border-t border-rose-200/70 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onResendVerification}
                    disabled={resendCooldown > 0}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw size={12} />
                    {resendCooldown > 0
                      ? `Resend link available in ${resendCooldown}s`
                      : "Resend Verification Link"}
                  </button>
                </div>
              )}
            </div>
          )}

          {info && (
            <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-emerald-700 leading-relaxed">{info}</p>
            </div>
          )}

          {step === "LOGIN" ? (
            <form className="space-y-5" onSubmit={handleSubmit(onPasswordSubmit)}>
              {/* Invisible Bot Honeypot */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                className="opacity-0 absolute -z-10 h-0 w-0 pointer-events-none"
                {...register("_honeypot")}
              />

              <div>
                <label
                  htmlFor="email-address"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Corporate Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="email-address"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-slate-400"
                    placeholder="name@neuravolt.com"
                    {...register("email")}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-slate-400"
                    placeholder="••••••••••••"
                    {...register("password")}
                  />
                </div>
              </div>

              <div className="pt-1 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition shadow-sm cursor-pointer"
                >
                  {isSubmitting ? "Authenticating..." : "Sign in"}
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-slate-400 font-medium text-[11px] tracking-wider">
                      or hardware authentication
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onTouchIdLogin}
                  disabled={isTouchIdLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 disabled:opacity-50 transition shadow-sm cursor-pointer"
                >
                  <Fingerprint className="w-4 h-4 text-slate-600" />
                  <span>
                    {isTouchIdLoading ? "Verifying Sensor..." : "Sign in with Touch ID / Passkey"}
                  </span>
                </button>

                <div className="pt-2 text-center text-xs text-slate-600">
                  Need a customer workspace?{" "}
                  <Link
                    href="/register"
                    className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Create an account
                  </Link>
                </div>
              </div>
            </form>
          ) : (
            /* Step 2: 2FA Verification */
            <form className="space-y-6" onSubmit={onVerifyOtp}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">
                  Enter 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full text-center text-3xl tracking-[12px] font-mono py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-slate-300"
                />
                <p className="mt-2.5 text-center text-[11px] text-slate-500">
                  Security code expires in 5 minutes • Single-use only
                </p>
              </div>

              <div className="space-y-4">
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otp.length !== 6}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
                >
                  {isVerifyingOtp ? "Verifying..." : "Verify & Continue"}
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("LOGIN");
                      setOtp("");
                      setError("");
                      setInfo("");
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={onResendCode}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-slate-500">
            NeuraVolt Operational &amp; Resource Business Intelligence Technology
          </p>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Enterprise-Grade Security • End-to-End Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
