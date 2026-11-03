'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Save,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Lock,
  Receipt,
} from 'lucide-react';
import { useCompanyProfile, useUpsertCompanyProfile } from '../../../src/hooks/queries';

const inputCls =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm';
const labelCls = 'text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 block';

export default function PaymentSettingsPage() {
  const { data: profile, isLoading } = useCompanyProfile();
  const upsertMutation = useUpsertCompanyProfile();

  const [saved, setSaved] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Form state
  const [form, setForm] = useState({
    onlinePaymentEnabled: true,
    manualPaymentEnabled: true,
    cashfreeEnvironment: 'sandbox' as 'sandbox' | 'production',
    cashfreeSandboxAppId: '',
    cashfreeSandboxSecretKey: '',
    cashfreeSandboxWebhookSecret: '',
    cashfreeProductionAppId: '',
    cashfreeProductionSecretKey: '',
    cashfreeProductionWebhookSecret: '',
  });

  useEffect(() => {
    if (profile && !hydrated) {
      const p = profile as any;
      setForm({
        onlinePaymentEnabled: p.onlinePaymentEnabled ?? true,
        manualPaymentEnabled: p.manualPaymentEnabled ?? true,
        cashfreeEnvironment: (p.cashfreeEnvironment === 'production' ? 'production' : 'sandbox'),
        cashfreeSandboxAppId: p.cashfreeSandboxAppId ?? (p.cashfreeAppId?.startsWith('TEST') ? p.cashfreeAppId : ''),
        cashfreeSandboxSecretKey: '',
        cashfreeSandboxWebhookSecret: '',
        cashfreeProductionAppId: p.cashfreeProductionAppId ?? (!p.cashfreeAppId?.startsWith('TEST') ? (p.cashfreeAppId || '') : ''),
        cashfreeProductionSecretKey: '',
        cashfreeProductionWebhookSecret: '',
      });
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const update = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile) return;

    await upsertMutation.mutateAsync({
      companyName: profile.companyName ?? 'NeuraVolt',
      legalName: profile.legalName,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
      country: profile.country,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      gstNumber: profile.gstNumber,
      panNumber: profile.panNumber,
      cinNumber: profile.cinNumber,
      msmeRegistration: profile.msmeRegistration,
      defaultGstRate: Number(profile.defaultGstRate ?? 18),
      defaultCurrency: profile.defaultCurrency ?? 'INR',
      defaultPaymentTerms: Number(profile.defaultPaymentTerms ?? 7),
      bankName: profile.bankName,
      accountHolderName: profile.accountHolderName,
      accountNumber: profile.accountNumber,
      ifscCode: profile.ifscCode,
      upiId: profile.upiId,
      invoicePrefix: profile.invoicePrefix,
      quotePrefix: profile.quotePrefix,
      amcPrefix: profile.amcPrefix,
      amcReportPrefix: profile.amcReportPrefix,
      invoiceTerms: profile.invoiceTerms,
      quoteTerms: profile.quoteTerms,
      amcTerms: profile.amcTerms,
      // Payment Settings
      onlinePaymentEnabled: Boolean(form.onlinePaymentEnabled),
      manualPaymentEnabled: Boolean(form.manualPaymentEnabled),
      activeOnlineGateway: 'CASHFREE',
      cashfreeEnvironment: form.cashfreeEnvironment,
      cashfreeSandboxAppId: form.cashfreeSandboxAppId.trim(),
      cashfreeProductionAppId: form.cashfreeProductionAppId.trim(),
      cashfreeAppId: form.cashfreeEnvironment === 'production'
        ? form.cashfreeProductionAppId.trim()
        : form.cashfreeSandboxAppId.trim(),
      ...(form.cashfreeSandboxSecretKey.trim() ? { cashfreeSandboxSecretKey: form.cashfreeSandboxSecretKey.trim() } : {}),
      ...(form.cashfreeSandboxWebhookSecret.trim() ? { cashfreeSandboxWebhookSecret: form.cashfreeSandboxWebhookSecret.trim() } : {}),
      ...(form.cashfreeProductionSecretKey.trim() ? { cashfreeProductionSecretKey: form.cashfreeProductionSecretKey.trim() } : {}),
      ...(form.cashfreeProductionWebhookSecret.trim() ? { cashfreeProductionWebhookSecret: form.cashfreeProductionWebhookSecret.trim() } : {}),
    });

    update('cashfreeSandboxSecretKey', '');
    update('cashfreeSandboxWebhookSecret', '');
    update('cashfreeProductionSecretKey', '');
    update('cashfreeProductionWebhookSecret', '');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getWebhookUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/payments/cashfree/webhook`;
    }
    return 'https://teams.neuravolt.in/api/payments/cashfree/webhook';
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const isSandboxConfigured = Boolean(
    (profile as any)?.cashfreeSandboxSecretConfigured ||
    ((profile as any)?.cashfreeEnvironment === 'sandbox' && (profile as any)?.cashfreeSecretConfigured) ||
    form.cashfreeSandboxSecretKey
  );
  const isProductionConfigured = Boolean(
    (profile as any)?.cashfreeProductionSecretConfigured ||
    ((profile as any)?.cashfreeEnvironment === 'production' && (profile as any)?.cashfreeSecretConfigured) ||
    form.cashfreeProductionSecretKey
  );

  const isConfigured = form.cashfreeEnvironment === 'production' ? isProductionConfigured : isSandboxConfigured;
  const currentAppId = form.cashfreeEnvironment === 'production' ? form.cashfreeProductionAppId : form.cashfreeSandboxAppId;
  const hasAppId = Boolean(currentAppId);
  const isOperational = form.onlinePaymentEnabled && isConfigured && hasAppId;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link & Header */}
        <div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            Back to System Settings Hub
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Payment Gateway & Methods
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure Cashfree online checkout credentials, webhook reconciliation, and client manual payment verification.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/billing"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
              >
                <Receipt size={14} className="text-indigo-600" />
                <span>Verification Queue</span>
              </Link>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={upsertMutation.isPending || isLoading}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm hover:shadow transition-all"
              >
                {saved ? (
                  <>
                    <CheckCircle size={15} />
                    <span>Saved!</span>
                  </>
                ) : upsertMutation.isPending ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Operational Status Banner */}
        {isOperational ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-sm">
            <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-emerald-900 block">
                Cashfree Online Checkout is Operational
              </span>
              <span className="text-xs text-emerald-700 leading-relaxed block mt-0.5">
                Valid credentials are saved and online checkout is active in Client Portal. Clients can securely pay invoices with automatic reconciliation into accounting ledger.
              </span>
            </div>
          </div>
        ) : form.onlinePaymentEnabled ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-sm">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-amber-900 block">
                Effective State: Inactive (Credentials Missing)
              </span>
              <span className="text-xs text-amber-700 leading-relaxed block mt-0.5">
                Online payments toggle is enabled, but Cashfree App ID or Secret Key is missing. Online checkout will remain safely disabled in Client Portal until valid credentials are saved below.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-start gap-3">
            <Lock size={18} className="text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Online Payments are Disabled
              </span>
              <span className="text-xs text-slate-500 leading-relaxed block mt-0.5">
                Invoices will not display online checkout buttons. Clients can only pay using manual payment methods if enabled.
              </span>
            </div>
          </div>
        )}

        {/* Section 1: Payment Methods Toggles */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Payment Methods Availability</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Control what payment methods your clients see when viewing their invoices in the Client Portal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Online Payments Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-800 block">
                  Online Payments (Cashfree)
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Instant card, UPI, & netbanking checkout
                </span>
              </div>
              <button
                type="button"
                onClick={() => update('onlinePaymentEnabled', !form.onlinePaymentEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.onlinePaymentEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.onlinePaymentEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Manual Payments Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-800 block">
                  Manual Payments & Verification
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Bank wire, NEFT, Cheque & proof uploads
                </span>
              </div>
              <button
                type="button"
                onClick={() => update('manualPaymentEnabled', !form.manualPaymentEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.manualPaymentEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.manualPaymentEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Gateway Status Indicators */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Active Online Gateway:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <ShieldCheck size={14} className="text-emerald-600" />
                Cashfree Payments (Active)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Razorpay:</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[11px] font-semibold">
                Disabled / Locked
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Cashfree Credentials */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Cashfree API Credentials</h2>
              <a
                href="https://merchant.cashfree.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-600 font-bold hover:underline"
              >
                <span>Merchant Dashboard</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your Cashfree API keys. All keys are encrypted at rest using AES-256-GCM.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Environment Toggle */}
            <div className="md:col-span-2">
              <label className={labelCls}>Active Gateway Environment</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => update('cashfreeEnvironment', 'sandbox')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    form.cashfreeEnvironment === 'sandbox'
                      ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Sandbox (Test Mode)</span>
                    {isSandboxConfigured && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Configured</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Safe testing with simulated payments
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => update('cashfreeEnvironment', 'production')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    form.cashfreeEnvironment === 'production'
                      ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Production (Live Mode)</span>
                    {isProductionConfigured && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Configured</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Real client payments and settlements
                  </span>
                </button>
              </div>
            </div>

            {/* Active Mode Notice */}
            <div className="md:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                Active Setting: <span className="font-bold text-slate-900 uppercase">{form.cashfreeEnvironment === 'production' ? 'Live Production Mode' : 'Sandbox Test Mode'}</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">
                ✓ Sandbox and Production keys are saved independently.
              </span>
            </div>

            {/* Conditional fields based on active environment */}
            {form.cashfreeEnvironment === 'production' ? (
              <>
                {/* Production App ID */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Cashfree Production App ID</label>
                  <input
                    type="text"
                    value={form.cashfreeProductionAppId}
                    onChange={e => update('cashfreeProductionAppId', e.target.value)}
                    placeholder="CF_APP_xxxxxxxx (From Cashfree Live Dashboard)"
                    className={inputCls}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Found on Cashfree Live Dashboard under <em>Developers → API Keys</em>. (Does not start with TEST).
                  </span>
                </div>

                {/* Production Secret Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Production Secret Key
                    </label>
                    {isProductionConfigured && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={12} /> Saved (••••••••)
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={form.cashfreeProductionSecretKey}
                    onChange={e => update('cashfreeProductionSecretKey', e.target.value)}
                    placeholder={
                      isProductionConfigured
                        ? 'Leave blank to keep existing key'
                        : 'Enter Live Production Secret Key'
                    }
                    className={inputCls}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Never logged or returned in plain text.
                  </span>
                </div>

                {/* Production Webhook Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Production Webhook Secret <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    {(profile as any)?.cashfreeProductionWebhookSecretConfigured && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={12} /> Saved (••••••••)
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={form.cashfreeProductionWebhookSecret}
                    onChange={e => update('cashfreeProductionWebhookSecret', e.target.value)}
                    placeholder={
                      (profile as any)?.cashfreeProductionWebhookSecretConfigured
                        ? 'Leave blank to keep existing key'
                        : 'Optional: Leave blank to use API Secret Key'
                    }
                    className={inputCls}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Cashfree PG v2023-08-01 automatically signs webhooks using your API Secret Key.
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Sandbox App ID */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Cashfree Sandbox App ID</label>
                  <input
                    type="text"
                    value={form.cashfreeSandboxAppId}
                    onChange={e => update('cashfreeSandboxAppId', e.target.value)}
                    placeholder="TEST100xxxxxxx"
                    className={inputCls}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Found on Cashfree Sandbox Dashboard under <em>Developers → API Keys</em>.
                  </span>
                </div>

                {/* Sandbox Secret Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Sandbox Secret Key
                    </label>
                    {isSandboxConfigured && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={12} /> Saved (••••••••)
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={form.cashfreeSandboxSecretKey}
                    onChange={e => update('cashfreeSandboxSecretKey', e.target.value)}
                    placeholder={
                      isSandboxConfigured
                        ? 'Leave blank to keep existing key'
                        : 'Enter Sandbox Secret Key'
                    }
                    className={inputCls}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Never logged or returned in plain text.
                  </span>
                </div>

                {/* Sandbox Webhook Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Sandbox Webhook Secret <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    {(profile as any)?.cashfreeSandboxWebhookSecretConfigured && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={12} /> Saved (••••••••)
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={form.cashfreeSandboxWebhookSecret}
                    onChange={e => update('cashfreeSandboxWebhookSecret', e.target.value)}
                    placeholder={
                      (profile as any)?.cashfreeSandboxWebhookSecretConfigured
                        ? 'Leave blank to keep existing key'
                        : 'Optional: Leave blank to use API Secret Key'
                    }
                    className={inputCls}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Cashfree Sandbox test webhook signing secret.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section 3: Webhook Endpoint Instructions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cashfree Webhook Endpoint Setup</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Copy this URL into your Cashfree Merchant Dashboard to enable real-time automatic payment reconciliation.
            </p>
          </div>

          <div className="bg-slate-900 rounded-xl p-3.5 flex items-center justify-between gap-3 text-slate-200">
            <code className="text-xs font-mono text-emerald-400 select-all truncate">
              {getWebhookUrl()}
            </code>
            <button
              type="button"
              onClick={handleCopyWebhook}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors shrink-0"
            >
              {copiedWebhook ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">1. Subscribe Events</span>
              <span className="text-slate-500 text-[11px]">
                Subscribe to <code>PAYMENT_SUCCESS_WEBHOOK</code> and <code>PAYMENT_FAILED_WEBHOOK</code>.
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">2. Auto-Reconciliation</span>
              <span className="text-slate-500 text-[11px]">
                Payments automatically trigger <code>BillingService.recordPayment()</code> and update invoice balances.
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">3. Asset Auto-Renewal</span>
              <span className="text-slate-500 text-[11px]">
                Fully paid asset renewal invoices automatically advance asset expiration dates.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
