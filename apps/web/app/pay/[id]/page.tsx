"use client";

import { use, useEffect, useState } from "react";
import axios from "axios";
import {
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  Download,
  FileText,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  Lock,
  Calendar,
  User,
  Clock,
  Sparkles,
  UploadCloud,
} from "lucide-react";

function getMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/api/")) return url;
  if (url.startsWith("/uploads/")) return `/api${url}`;
  return url.startsWith("/") ? `/api${url}` : `/api/${url}`;
}

export default function PublicInvoicePayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [logoError, setLogoError] = useState(false);

  const [activeTab, setActiveTab] = useState<"online" | "manual">("online");
  const [payingOnline, setPayingOnline] = useState(false);
  const [payError, setPayError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Manual payment submission state
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualMethod, setManualMethod] = useState<"BANK_TRANSFER" | "UPI" | "CHEQUE">("UPI");
  const [manualUtr, setManualUtr] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualNotes, setManualNotes] = useState("");
  const [manualProofFile, setManualProofFile] = useState<File | null>(null);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccessMsg, setManualSuccessMsg] = useState("");
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchInvoice = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get(`/api/payments/public/invoice/${id}?_t=${Date.now()}`);
      setData(res.data);
      if (res.data?.invoice) {
        setManualAmount(Number(res.data.invoice.balanceDue || 0));
        if (
          res.data.invoice.status?.toLowerCase() === "paid" ||
          Number(res.data.invoice.balanceDue || 0) <= 0
        ) {
          setPaymentSuccess(true);
        }
      }
      if (
        res.data?.paymentConfig?.onlinePaymentEnabled === false &&
        res.data?.paymentConfig?.manualPaymentEnabled !== false
      ) {
        setActiveTab("manual");
      }
    } catch (err: any) {
      if (!silent) {
        setFetchError(
          err?.response?.data?.message ||
            "Unable to load invoice details. Please verify your payment link."
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const orderId = searchParams?.get("order_id");

    const init = async () => {
      if (orderId) {
        setVerifyingPayment(true);
        try {
          await axios.post(`/api/payments/public/invoice/${id}/sync/${orderId}`);
        } catch (e) {
          // ignore and proceed to fetch
        } finally {
          setVerifyingPayment(false);
        }
      }
      await fetchInvoice();
    };

    init();

    // Auto-refresh when tab gains focus or every 5 seconds while unpaid
    const onFocus = () => fetchInvoice(true);
    window.addEventListener("focus", onFocus);

    const interval = setInterval(() => {
      if (!paymentSuccess) {
        fetchInvoice(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [id, paymentSuccess]);

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Cashfree SDK dynamic load
  const loadCashfreeSdk = () =>
    new Promise<boolean>((resolve) => {
      if ((window as any).Cashfree) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePayOnlineCashfree = async () => {
    setPayError("");
    setPayingOnline(true);
    try {
      const loaded = await loadCashfreeSdk();
      if (!loaded) {
        throw new Error("Unable to initialize secure Cashfree SDK. Check your internet connection.");
      }

      const { data: session } = await axios.post(`/api/payments/public/invoice/${id}/session`);

      const mode =
        data?.paymentConfig?.cashfreeEnvironment === "production" ? "production" : "sandbox";
      const cashfree = (window as any).Cashfree({ mode });

      await cashfree.checkout({
        paymentSessionId: session.paymentSessionId,
        redirectTarget: "_modal",
      });

      // After modal closes, immediately sync with Cashfree gateway
      if (session?.gatewayOrderId) {
        try {
          await axios.post(`/api/payments/public/invoice/${id}/sync/${session.gatewayOrderId}`);
        } catch (e) {
          // ignore
        }
      }

      // Refresh invoice authoritative state
      await fetchInvoice();
    } catch (err: any) {
      setPayError(
        err?.response?.data?.message || err?.message || "Failed to start payment checkout."
      );
    } finally {
      setPayingOnline(false);
    }
  };

  const handleSubmitManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError("");
    setManualSuccessMsg("");

    if (!manualUtr.trim()) {
      setManualError("Please provide the transaction UTR / Reference ID.");
      return;
    }

    try {
      setSubmittingManual(true);
      const formData = new FormData();
      formData.append("amount", String(manualAmount));
      formData.append("paymentMethod", manualMethod);
      formData.append("utrNumber", manualUtr.trim());
      formData.append("paymentDate", manualDate);
      if (manualNotes) formData.append("notes", manualNotes.trim());
      if (manualProofFile) formData.append("proof", manualProofFile);

      await axios.post(`/api/payments/public/invoice/${id}/manual-payment`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setManualSuccessMsg(
        "Payment verification submitted! Our accounts team will review and settle the invoice shortly."
      );
      setManualUtr("");
      setManualNotes("");
      setManualProofFile(null);
      await fetchInvoice();
    } catch (err: any) {
      setManualError(
        err?.response?.data?.message || "Failed to submit manual payment. Please try again."
      );
    } finally {
      setSubmittingManual(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="inline-block w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 font-mono tracking-wide">
            Loading secure payment gateway…
          </p>
        </div>
      </div>
    );
  }

  if (fetchError || !data?.invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Invoice Link Invalid</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {fetchError || "The invoice you are trying to view does not exist or has expired."}
            </p>
          </div>
          <div className="pt-2">
            <a
              href="mailto:billing@neuravolt.in"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Contact Support: billing@neuravolt.in
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { invoice, company, paymentConfig } = data;
  const isPaid =
    invoice.status?.toLowerCase() === "paid" || Number(invoice.balanceDue || 0) <= 0;
  const isPartial =
    invoice.status?.toLowerCase() === "partial_paid" && Number(invoice.balanceDue || 0) > 0;
  const isOverdue =
    !isPaid && invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now();

  const balanceDue = Number(invoice.balanceDue || 0);
  const grandTotal = Number(invoice.grandTotal || 0);
  const amountPaid = Number(invoice.amountPaid || 0);

  return (
    <div className="min-h-screen bg-slate-50/80 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Branding Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {company.logoUrl && !logoError ? (
              <img
                src={getMediaUrl(company.logoUrl)}
                alt={company.companyName}
                onError={() => setLogoError(true)}
                className="h-10 sm:h-11 max-w-[220px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md">
                  {company.companyName ? company.companyName.substring(0, 2).toUpperCase() : "NV"}
                </div>
                <div>
                  <h1 className="text-base font-bold text-slate-900 leading-tight">
                    {company.companyName}
                  </h1>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {company.gstin ? `GSTIN: ${company.gstin}` : "Official Invoice & Payment Portal"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/payments/public/invoice/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download PDF</span>
            </a>
          </div>
        </div>

        {/* Payment Verification in Progress Banner */}
        {verifyingPayment && !isPaid && (
          <div className="bg-blue-50 border border-blue-200 rounded-3xl p-5 shadow-xs flex items-center gap-3.5">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-blue-900">Confirming Payment with Gateway...</h4>
              <p className="text-xs text-blue-700 mt-0.5">Please wait a moment while we synchronize your transaction confirmation.</p>
            </div>
          </div>
        )}

        {/* Paid Banner if settled */}
        {isPaid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  Invoice Paid & Settled
                </h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Thank you! Payment of ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })} has been received and verified.
                </p>
              </div>
            </div>
            <a
              href={`/api/payments/public/invoice/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 shadow-xs transition"
            >
              Download Paid Receipt
            </a>
          </div>
        )}

        {/* Main 2-Column Checkout Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Invoice Details (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
            {/* Invoice Header Details */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Invoice Number
                </span>
                <h2 className="text-xl font-mono font-black text-slate-900 tracking-tight">
                  {invoice.invoiceNumber}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Issued: {new Date(invoice.issueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>

              {/* Status Pill */}
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Status
                </span>
                {isPaid ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Paid in Full
                  </span>
                ) : isOverdue ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Overdue
                  </span>
                ) : isPartial ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Partial Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Payment Due
                  </span>
                )}
              </div>
            </div>

            {/* Billed To Client Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Billed To
              </span>
              <div className="font-bold text-sm text-slate-900">{invoice.client?.name}</div>
              <div className="text-xs text-slate-500">{invoice.client?.email}</div>
              {invoice.client?.phone && (
                <div className="text-xs text-slate-500 font-mono">{invoice.client?.phone}</div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                Deliverables & Line Items
              </span>
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-3 text-center w-16">Qty</th>
                      <th className="py-2.5 px-3 text-right w-24">Rate</th>
                      <th className="py-2.5 px-4 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(invoice.items || []).map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {item.description}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.quantity}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          ₹{Number(item.unitPrice || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          ₹{Number(item.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Totals */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">₹{Number(invoice.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST ({Number(invoice.taxRate || 0)}%)</span>
                <span className="font-mono">₹{Number(invoice.taxTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-100">
                <span>Grand Total</span>
                <span className="font-mono">₹{grandTotal.toFixed(2)}</span>
              </div>
              {amountPaid > 0 && (
                <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                  <span>Amount Paid</span>
                  <span className="font-mono">₹{amountPaid.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-indigo-700 pt-2 border-t border-indigo-100 bg-indigo-50/50 p-2.5 rounded-xl">
                <span>Balance Due</span>
                <span className="font-mono text-base">₹{balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Action Portal (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Payment Desk
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {isPaid ? "Receipt & Settle Details" : "Complete Your Payment"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isPaid
                  ? "This invoice is settled. No further payment is required."
                  : "Pay securely via online gateway or direct bank transfer."}
              </p>
            </div>

            {!isPaid ? (
              <>
                {/* Payment Method Tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                  {paymentConfig.onlinePaymentEnabled && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("online")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${
                        activeTab === "online"
                          ? "bg-white text-indigo-600 shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Online (Instant)</span>
                    </button>
                  )}
                  {paymentConfig.manualPaymentEnabled && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("manual")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${
                        activeTab === "manual"
                          ? "bg-white text-indigo-600 shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Bank / UPI QR</span>
                    </button>
                  )}
                </div>

                {payError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{payError}</span>
                  </div>
                )}

                {/* Tab 1: Cashfree Instant Checkout */}
                {activeTab === "online" && paymentConfig.onlinePaymentEnabled && (
                  <div className="space-y-4 pt-1">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center space-y-1">
                      <span className="text-xs text-slate-500">Payable Balance</span>
                      <div className="text-3xl font-black font-mono text-slate-900">
                        ₹{balanceDue.toFixed(2)}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Supports UPI (GPay, PhonePe, Paytm), Credit/Debit Cards & NetBanking
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handlePayOnlineCashfree}
                      disabled={payingOnline}
                      className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {payingOnline ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Connecting Gateway...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Pay ₹{balanceDue.toFixed(2)} Now</span>
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Secured by Cashfree Payments · 256-bit Encryption</span>
                    </div>
                  </div>
                )}

                {/* Tab 2: Manual Bank Transfer / UPI Details */}
                {activeTab === "manual" && paymentConfig.manualPaymentEnabled && (
                  <div className="space-y-4 pt-1">
                    {/* Bank Details Display */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-slate-700 font-bold">
                        <span>Company Bank Details</span>
                        <Building className="w-4 h-4 text-slate-400" />
                      </div>

                      {company.bankName && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Bank Name</span>
                          <span className="font-semibold text-slate-800">{company.bankName}</span>
                        </div>
                      )}

                      {company.bankAccountName && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Account Name</span>
                          <span className="font-semibold text-slate-800">{company.bankAccountName}</span>
                        </div>
                      )}

                      {company.bankAccountNumber && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Account No</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900">
                              {company.bankAccountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(company.bankAccountNumber, "acc")}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copy Account Number"
                            >
                              {copiedKey === "acc" ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {company.bankIfsc && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">IFSC Code</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900">{company.bankIfsc}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(company.bankIfsc, "ifsc")}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copy IFSC"
                            >
                              {copiedKey === "ifsc" ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {company.upiId && (
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                          <span className="text-slate-500">UPI ID</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-indigo-700">{company.upiId}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(company.upiId, "upi")}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copy UPI ID"
                            >
                              {copiedKey === "upi" ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* UTR Submission Form */}
                    <form onSubmit={handleSubmitManualPayment} className="space-y-3 pt-2">
                      <span className="text-xs font-bold text-slate-800 block">
                        Already Transferred? Submit UTR
                      </span>

                      {manualSuccessMsg && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                          <span>{manualSuccessMsg}</span>
                        </div>
                      )}

                      {manualError && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{manualError}</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          UTR / Reference ID *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 1465718036270474752"
                          value={manualUtr}
                          onChange={(e) => setManualUtr(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 block">
                            Method
                          </label>
                          <select
                            value={manualMethod}
                            onChange={(e: any) => setManualMethod(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="UPI">UPI</option>
                            <option value="BANK_TRANSFER">Bank IMPS/NEFT</option>
                            <option value="CHEQUE">Cheque</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 block">
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={manualAmount}
                            onChange={(e) => setManualAmount(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Proof Screenshot / Receipt <span className="text-slate-400 font-normal">(optional)</span>
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => setManualProofFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 hover:file:bg-slate-200 cursor-pointer"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingManual}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition disabled:opacity-50"
                      >
                        {submittingManual ? "Submitting..." : "Submit UTR for Verification"}
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              /* Already Paid State in Sidebar */
              <div className="space-y-4 pt-2">
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center space-y-1">
                  <span className="text-xs text-emerald-700 font-semibold">Total Paid</span>
                  <div className="text-3xl font-black font-mono text-emerald-800">
                    ₹{grandTotal.toFixed(2)}
                  </div>
                  <span className="text-[11px] text-emerald-600">Balance Due: ₹0.00</span>
                </div>

                <a
                  href={`/api/payments/public/invoice/${id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Paid Invoice (PDF)</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Trust Badges Footer */}
        <div className="text-center pt-8 border-t border-slate-200 space-y-1 text-slate-400 text-xs">
          <p className="flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>256-Bit SSL Encrypted Transaction · PCI-DSS Compliant Gateway</span>
          </p>
          <p className="text-[11px] text-slate-400">
            Powered by <strong className="text-slate-600 font-bold">NeuraVolt OS</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
