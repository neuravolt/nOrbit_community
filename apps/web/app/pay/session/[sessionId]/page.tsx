"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Receipt,
  CreditCard,
  ExternalLink,
} from "lucide-react";

interface SessionInfo {
  appName: string;
  appId: string;
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  environment: "production" | "sandbox";
  status: string;
  paymentSessionId: string;
  returnUrl?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

export default function HostedCollectCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const rawSessionId = params?.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Dynamic Cashfree SDK loader
  const loadCashfreeSdk = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      if ((window as any).Cashfree) return resolve(true);
      const existing = document.getElementById("cashfree-sdk-v3");
      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        return;
      }
      const script = document.createElement("script");
      script.id = "cashfree-sdk-v3";
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  // Fetch session information
  const fetchSessionInfo = useCallback(async () => {
    if (!rawSessionId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(
        `/api/v1/collects/checkout/public/session-info/${rawSessionId}`
      );
      setSession(res.data);
      if (res.data.status === "SUCCESS") {
        setPaySuccess(true);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Unable to load payment session. Please verify the link or contact support."
      );
    } finally {
      setLoading(false);
    }
  }, [rawSessionId]);

  useEffect(() => {
    fetchSessionInfo();
  }, [fetchSessionInfo]);

  // Handle redirect countdown when payment succeeds
  useEffect(() => {
    if (!paySuccess || !session?.returnUrl) return;

    if (redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Redirect back to merchant app
      const separator = session.returnUrl.includes("?") ? "&" : "?";
      const targetUrl = `${session.returnUrl}${separator}order_id=${encodeURIComponent(
        session.orderId
      )}&status=SUCCESS`;
      window.location.href = targetUrl;
    }
  }, [paySuccess, redirectCountdown, session]);

  // Launch Cashfree checkout popup / redirect
  const handleProceedPayment = async () => {
    if (!session || paying) return;
    setPaying(true);
    setError(null);

    try {
      const sdkLoaded = await loadCashfreeSdk();
      if (!sdkLoaded) {
        throw new Error(
          "Failed to load secure payment SDK. Please check your internet connection."
        );
      }

      const mode = session.environment === "sandbox" ? "sandbox" : "production";
      const cashfree = (window as any).Cashfree({ mode });

      await cashfree.checkout({
        paymentSessionId: session.paymentSessionId,
        redirectTarget: "_modal",
      });

      // Modal closed, sync state with gateway
      setVerifying(true);
      try {
        const syncRes = await axios.post(
          `/api/v1/collects/checkout/public/session-sync/${session.paymentSessionId}`
        );
        if (syncRes.data?.status === "SUCCESS") {
          setPaySuccess(true);
        } else {
          // Re-fetch to reflect current status
          fetchSessionInfo();
        }
      } catch (syncErr: any) {
        fetchSessionInfo();
      } finally {
        setVerifying(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate payment. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans antialiased">
      {/* ── Top Security Header ── */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
              N
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm block leading-none">
                NeuraVolt Payments
              </span>
              <span className="text-[10px] text-slate-500 font-medium leading-tight">
                Secure Merchant Gateway
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-semibold">
            <Lock size={12} />
            <span>256-bit Encrypted</span>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {loading ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto animate-spin">
                <RefreshCw size={22} />
              </div>
              <h2 className="text-base font-bold text-slate-800">
                Loading Secure Checkout...
              </h2>
              <p className="text-xs text-slate-500">
                Verifying payment session with NeuraCollect gateway.
              </p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-5 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Payment Session Error
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {error}
                </p>
              </div>
              <button
                type="button"
                onClick={fetchSessionInfo}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : paySuccess ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-5 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                  Payment Verified
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  ₹{Number(session?.amount).toFixed(2)} Paid
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Transaction completed successfully for order #{session?.orderId}
                </p>
              </div>

              {session?.returnUrl ? (
                <div className="pt-2">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-2">
                    <p>
                      Redirecting back to{" "}
                      <strong className="text-slate-900">{session.appName}</strong> in{" "}
                      <span className="font-bold text-indigo-600">
                        {redirectCountdown}s
                      </span>
                      ...
                    </p>
                    <a
                      href={`${session.returnUrl}${
                        session.returnUrl.includes("?") ? "&" : "?"
                      }order_id=${encodeURIComponent(session.orderId)}&status=SUCCESS`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Click here if not redirected automatically <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  You may now close this window safely.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
              {/* Order Merchant Bar */}
              <div className="p-6 pb-5 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-mono text-xs font-black flex items-center justify-center shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Paying To
                      </span>
                      <h1 className="text-sm font-bold text-slate-900 leading-tight">
                        {session?.appName}
                      </h1>
                    </div>
                  </div>

                  {session?.environment === "sandbox" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                      TEST MODE
                    </span>
                  )}
                </div>

                {/* Amount Display */}
                <div className="mt-5 text-center py-2">
                  <span className="text-xs text-slate-400 font-medium block">
                    Amount Payable
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-1 tracking-tight">
                    ₹{Number(session?.amount).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Order Info Rows */}
              <div className="p-6 space-y-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Receipt size={13} /> Order ID
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {session?.orderId}
                    </span>
                  </div>

                  {session?.customerName && (
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">Customer</span>
                      <span className="font-medium text-slate-800">
                        {session.customerName}
                      </span>
                    </div>
                  )}

                  {session?.customerPhone && (
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">Phone</span>
                      <span className="font-mono text-slate-800">
                        {session.customerPhone}
                      </span>
                    </div>
                  )}
                </div>

                {/* Payment Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleProceedPayment}
                    disabled={paying || verifying}
                    className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {paying || verifying ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Processing Payment...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={16} />
                        <span>Pay ₹{Number(session?.amount).toFixed(2)}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>

                {/* Supported Methods Icons & Compliance Tag */}
                <div className="pt-3 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                    <span>UPI</span>
                    <span>•</span>
                    <span>Cards</span>
                    <span>•</span>
                    <span>Netbanking</span>
                    <span>•</span>
                    <span>Wallets</span>
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Authorized NeuraVolt Merchant Checkout • RBI Approved PG
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="py-4 text-center text-[11px] text-slate-400 border-t border-slate-200/60 bg-white">
        Powered by{" "}
        <strong className="text-slate-700">NeuraVolt Technologies</strong> • All rights reserved
      </footer>
    </div>
  );
}
