'use client';
import { useState, useEffect } from 'react';
import {
  useCompanyProfile,
  useUpsertCompanyProfile,
  useUploadCompanyLogo,
  useUploadCompanySignature,
  useUploadCompanyStamp,
  useUploadCompanyFavicon,
} from '../../../src/hooks/queries';
import { Building2, CreditCard, FileText, Save, CheckCircle, Upload, ArrowLeft, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide';

interface FieldProps {
  label: string;
  field: string;
  value: string;
  onChange: (field: string, val: string) => void;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}

function InputField({ label, field, value, onChange, type = 'text', placeholder = '', textarea = false }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea
          rows={4}
          value={value}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
      )}
    </div>
  );
}

export default function CompanySettingsPage() {
  const { data: profile, isLoading } = useCompanyProfile();
  const upsertMutation = useUpsertCompanyProfile();
  const uploadLogoMutation = useUploadCompanyLogo();
  const uploadSignatureMutation = useUploadCompanySignature();
  const uploadStampMutation = useUploadCompanyStamp();
  const uploadFaviconMutation = useUploadCompanyFavicon();

  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'contact' | 'legal' | 'bank' | 'templates'>('branding');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'bank' || tabParam === 'payments' || tabParam === 'payment') {
        setActiveTab('bank');
      } else if (tabParam === 'legal' || tabParam === 'contact' || tabParam === 'templates') {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  // Local form state
  const [form, setForm] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profile && !hydrated) {
      setForm({
        companyName:      profile.companyName      ?? '',
        legalName:        profile.legalName        ?? '',
        tagline:          profile.tagline          ?? '',
        logoUrl:          profile.logoUrl          ?? '',
        faviconUrl:       profile.faviconUrl       ?? '',
        signatureUrl:     profile.signatureUrl     ?? '',
        stampUrl:         profile.stampUrl         ?? '',
        address:          profile.address          ?? '',
        city:             profile.city             ?? '',
        state:            profile.state            ?? '',
        zip:              profile.zip              ?? '',
        country:          profile.country          ?? '',
        phone:            profile.phone            ?? '',
        email:            profile.email            ?? '',
        website:          profile.website          ?? '',
        gstNumber:        profile.gstNumber        ?? '',
        panNumber:        profile.panNumber        ?? '',
        cinNumber:        profile.cinNumber        ?? '',
        msmeRegistration: profile.msmeRegistration ?? '',
        defaultGstRate:   String(profile.defaultGstRate   ?? '18'),
        defaultCurrency:  profile.defaultCurrency  ?? 'INR',
        defaultPaymentTerms: String(profile.defaultPaymentTerms ?? '7'),
        bankName:         profile.bankName         ?? '',
        accountHolderName:profile.accountHolderName ?? '',
        accountNumber:    profile.accountNumber    ?? '',
        ifscCode:         profile.ifscCode         ?? '',
        upiId:            profile.upiId            ?? '',
        paymentGateway:   'CASHFREE',
        onlinePaymentEnabled: profile.onlinePaymentEnabled ?? true,
        manualPaymentEnabled: profile.manualPaymentEnabled ?? true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId:    profile.cashfreeAppId    ?? '',
        cashfreeSecretKey: '', // write-only
        cashfreeWebhookSecret: '', // write-only
        cashfreeEnvironment: profile.cashfreeEnvironment ?? 'sandbox',
        razorpayKeyId:    profile.razorpayKeyId    ?? '',
        razorpayKeySecret: '', // write-only — never populated from server
        invoicePrefix:    profile.invoicePrefix    ?? 'NVLT',
        quotePrefix:      profile.quotePrefix      ?? 'QUO',
        amcPrefix:        profile.amcPrefix        ?? 'AMC',
        amcReportPrefix:  profile.amcReportPrefix  ?? 'AMCR',
        invoiceTerms:     profile.invoiceTerms     ?? '',
        quoteTerms:       profile.quoteTerms       ?? '',
        amcTerms:         profile.amcTerms         ?? '',
      });
      setHydrated(true);
    }
  }, [profile, hydrated]);

  // Sync URLs if mutated
  useEffect(() => {
    if (profile && hydrated) {
      setForm(prev => ({
        ...prev,
        logoUrl: profile.logoUrl ?? prev.logoUrl ?? '',
        faviconUrl: profile.faviconUrl ?? prev.faviconUrl ?? '',
        signatureUrl: profile.signatureUrl ?? prev.signatureUrl ?? '',
        stampUrl: profile.stampUrl ?? prev.stampUrl ?? '',
      }));
    }
  }, [profile?.logoUrl, profile?.faviconUrl, profile?.signatureUrl, profile?.stampUrl, hydrated]);

  const update = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const { razorpayKeySecret, cashfreeSecretKey, cashfreeWebhookSecret, ...rest } = form;
    await upsertMutation.mutateAsync({
      ...rest,
      onlinePaymentEnabled: Boolean(form.onlinePaymentEnabled),
      manualPaymentEnabled: Boolean(form.manualPaymentEnabled),
      activeOnlineGateway: 'CASHFREE',
      // Only send secret if entered
      ...(cashfreeSecretKey ? { cashfreeSecretKey } : {}),
      ...(cashfreeWebhookSecret ? { cashfreeWebhookSecret } : {}),
      ...(razorpayKeySecret ? { razorpayKeySecret } : {}),
      defaultGstRate: Number(form.defaultGstRate),
      defaultPaymentTerms: Number(form.defaultPaymentTerms),
    });
    update('cashfreeSecretKey', '');
    update('cashfreeWebhookSecret', '');
    update('razorpayKeySecret', '');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature' | 'stamp' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (type === 'logo') {
        const res = await uploadLogoMutation.mutateAsync(file);
        update('logoUrl', res.logoUrl);
      } else if (type === 'favicon') {
        const res = await uploadFaviconMutation.mutateAsync(file);
        update('faviconUrl', res.faviconUrl);
      } else if (type === 'signature') {
        const res = await uploadSignatureMutation.mutateAsync(file);
        update('signatureUrl', res.signatureUrl);
      } else if (type === 'stamp') {
        const res = await uploadStampMutation.mutateAsync(file);
        update('stampUrl', res.stampUrl);
      }
    } catch (err) {
      console.error('File upload failed', err);
      alert('Upload failed. Please try again.');
    }
  };

  const getFullUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || '/api');
    return `${base}${url}`;
  };

  const f = (field: string) => form[field] ?? '';

  const tabs = [
    { id: 'branding',   label: 'Branding & Assets',    icon: Building2  },
    { id: 'contact',    label: 'Contact & Address',    icon: FileText   },
    { id: 'legal',      label: 'Legal & Tax',          icon: FileText   },
    { id: 'bank',       label: 'Bank & Payment Gateway', icon: CreditCard },
    { id: 'templates',  label: 'Templates & Prefixes', icon: FileText   },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <div className="mb-4">
          <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Company Profile</h1>
            <p className="text-slate-500 text-sm mt-1">
              Configure your company profile and upload visual branding assets for PDF generation
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {saved ? <CheckCircle size={16} className="text-green-300" /> : <Save size={16} />}
            {saved ? 'Saved!' : upsertMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-slate-400">Loading profile…</div>
          ) : (
            <>
              {/* ── Branding ── */}
              {activeTab === 'branding' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <h2 className="text-base font-bold text-slate-800 mb-4">Company Branding & Assets</h2>
                  </div>
                  <InputField label="Company Name"  field="companyName"  value={f('companyName')}  onChange={update} placeholder="Neuravolt Technology" />
                  <InputField label="Legal Name"    field="legalName"    value={f('legalName')}    onChange={update} placeholder="Neuravolt Technology LLP" />
                  <div className="md:col-span-2">
                    <InputField label="Tagline" field="tagline" value={f('tagline')} onChange={update} placeholder="Innovative Software Solutions" />
                  </div>

                  {/* Logo Upload */}
                  <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <span className="text-sm font-bold text-slate-700 block mb-1">Company Logo</span>
                      <p className="text-xs text-slate-400 mb-4">Upload logo to be displayed on top of invoices and quotes.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {f('logoUrl') ? (
                        <img src={getFullUrl(f('logoUrl'))} alt="Logo Preview" className="h-16 w-16 rounded-lg border border-slate-200 object-contain p-1 bg-white" />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300 bg-white font-semibold text-xs">No Logo</div>
                      )}
                      <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer shadow-sm transition-colors">
                        <Upload size={14} />
                        {uploadLogoMutation.isPending ? 'Uploading…' : 'Upload File'}
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'logo')} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {/* Favicon Upload */}
                  <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <span className="text-sm font-bold text-slate-700 block mb-1">Company Favicon</span>
                      <p className="text-xs text-slate-400 mb-4">Upload favicon (.ico, .png) for browser tab branding.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {f('faviconUrl') ? (
                        <img src={getFullUrl(f('faviconUrl'))} alt="Favicon Preview" className="h-12 w-12 rounded-lg border border-slate-200 object-contain p-1 bg-white" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300 bg-white font-semibold text-[10px]">No Favicon</div>
                      )}
                      <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer shadow-sm transition-colors">
                        <Upload size={14} />
                        {uploadFaviconMutation.isPending ? 'Uploading…' : 'Upload File'}
                        <input type="file" accept="image/*,.ico" onChange={e => handleFileUpload(e, 'favicon')} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {/* Signature Upload */}
                  <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <span className="text-sm font-bold text-slate-700 block mb-1">Authorized Signature</span>
                      <p className="text-xs text-slate-400 mb-4">Upload authorized signature with transparent background.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {f('signatureUrl') ? (
                        <img src={getFullUrl(f('signatureUrl'))} alt="Signature Preview" className="h-16 w-32 rounded-lg border border-slate-200 object-contain p-1 bg-white" />
                      ) : (
                        <div className="h-16 w-32 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300 bg-white font-semibold text-xs">No Signature</div>
                      )}
                      <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer shadow-sm transition-colors">
                        <Upload size={14} />
                        {uploadSignatureMutation.isPending ? 'Uploading…' : 'Upload File'}
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'signature')} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {/* Stamp Upload */}
                  <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col justify-between md:col-span-2">
                    <div>
                      <span className="text-sm font-bold text-slate-700 block mb-1">Company Stamp / Seal</span>
                      <p className="text-xs text-slate-400 mb-2">Upload company official stamp/seal image for letterhead documents.</p>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      {f('stampUrl') ? (
                        <img src={getFullUrl(f('stampUrl'))} alt="Stamp Preview" className="h-20 w-20 rounded-lg border border-slate-200 object-contain p-1 bg-white" />
                      ) : (
                        <div className="h-20 w-20 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300 bg-white font-semibold text-xs">No Stamp</div>
                      )}
                      <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer shadow-sm transition-colors">
                        <Upload size={14} />
                        {uploadStampMutation.isPending ? 'Uploading…' : 'Upload File'}
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'stamp')} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Contact ── */}
              {activeTab === 'contact' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <h2 className="text-base font-bold text-slate-800 mb-4">Contact & Address</h2>
                  </div>
                  <div className="md:col-span-2">
                    <InputField label="Address" field="address" value={f('address')} onChange={update} placeholder="Office address line" />
                  </div>
                  <InputField label="City"        field="city"    value={f('city')}    onChange={update} placeholder="Mumbai" />
                  <InputField label="State"       field="state"   value={f('state')}   onChange={update} placeholder="Maharashtra" />
                  <InputField label="ZIP / PIN"   field="zip"     value={f('zip')}     onChange={update} placeholder="400001" />
                  <InputField label="Country"     field="country" value={f('country')} onChange={update} placeholder="India" />
                  <InputField label="Phone"       field="phone"   value={f('phone')}   onChange={update} placeholder="+91 98765 43210" />
                  <InputField label="Email"       field="email"   value={f('email')}   onChange={update} type="email" placeholder="billing@neuravolt.com" />
                  <InputField label="Website"     field="website" value={f('website')} onChange={update} type="url"   placeholder="https://neuravolt.com" />
                </div>
              )}

              {/* ── Legal ── */}
              {activeTab === 'legal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <h2 className="text-base font-bold text-slate-800 mb-4">Legal & Tax Information</h2>
                  </div>
                  <InputField label="GST Number"                  field="gstNumber"           value={f('gstNumber')}           onChange={update} placeholder="27AABCU9603R1ZX" />
                  <InputField label="PAN Number"                  field="panNumber"           value={f('panNumber')}           onChange={update} placeholder="AABCU9603R" />
                  <InputField label="CIN Number"                  field="cinNumber"           value={f('cinNumber')}           onChange={update} placeholder="U74999MH2020OPC…" />
                  <InputField label="MSME Registration"           field="msmeRegistration"    value={f('msmeRegistration')}    onChange={update} placeholder="UDYAM-…" />
                  <InputField label="Default GST Rate (%)"        field="defaultGstRate"      value={f('defaultGstRate')}      onChange={update} type="number" placeholder="18" />
                  <InputField label="Default Currency"            field="defaultCurrency"     value={f('defaultCurrency')}     onChange={update} placeholder="INR" />
                  <InputField label="Payment Terms (days)"        field="defaultPaymentTerms" value={f('defaultPaymentTerms')} onChange={update} type="number" placeholder="7" />
                </div>
              )}

              {/* ── Bank ── */}
              {activeTab === 'bank' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <h2 className="text-base font-bold text-slate-800 mb-4">Bank & Payment Details</h2>
                    <p className="text-sm text-slate-500 mb-4">These details appear on invoices in the Payment Information section.</p>
                  </div>
                  <InputField label="Bank Name"             field="bankName"          value={f('bankName')}          onChange={update} placeholder="HDFC Bank" />
                  <InputField label="Account Holder Name"   field="accountHolderName" value={f('accountHolderName')} onChange={update} placeholder="Neuravolt Technology LLP" />
                  <InputField label="Account Number"        field="accountNumber"     value={f('accountNumber')}     onChange={update} placeholder="00000123456789" />
                  <InputField label="IFSC Code"             field="ifscCode"          value={f('ifscCode')}          onChange={update} placeholder="HDFC0001234" />
                  <div className="md:col-span-2">
                    <InputField label="UPI ID" field="upiId" value={f('upiId')} onChange={update} placeholder="neuravolt@hdfcbank" />
                  </div>

                  <div className="md:col-span-2 border-t border-slate-100 mt-2 pt-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <h2 className="text-base font-bold text-slate-800">Payment Methods & Gateways</h2>
                      <Link
                        href="/settings/payments"
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 w-fit"
                      >
                        <span>Open Dedicated Payment Gateway Settings</span>
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                      Configure invoice payment availability for your Client Portal. Razorpay is disabled in favor of verified Cashfree Online Checkout and audited Manual Payment submissions.
                    </p>
                  </div>

                  {/* Payment Availability Toggles */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm text-slate-800 block">Online Payments (Cashfree)</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Enable Cashfree checkout on client invoices</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('onlinePaymentEnabled', !form.onlinePaymentEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          form.onlinePaymentEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            form.onlinePaymentEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm text-slate-800 block">Manual Payments & Proof</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Allow Bank Wire, UPI & Cheque proof uploads</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('manualPaymentEnabled', !form.manualPaymentEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          form.manualPaymentEnabled ? 'bg-indigo-600' : 'bg-slate-300'
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

                  {/* Active Online Gateway Info */}
                  <div className="md:col-span-2 bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-indigo-900 block">Active Online Gateway</span>
                      <span className="text-xs text-indigo-700 mt-0.5 block">
                        Locked to <strong>Cashfree Payments</strong>. Legacy Razorpay gateway is disabled.
                      </span>
                    </div>
                    <span className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs shadow-sm">
                      CASHFREE
                    </span>
                  </div>

                  {/* Cashfree Credentials Configuration */}
                  {form.onlinePaymentEnabled && (
                    <>
                      {(!((profile as any)?.cashfreeSecretConfigured || form.cashfreeSecretKey) || !(form.cashfreeAppId || (profile as any)?.cashfreeAppId)) ? (
                        <div className="md:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                          <AlertCircle size={16} className="text-amber-600 shrink-0" />
                          <span>
                            <strong>Effective State: Inactive</strong> — Online payments are toggled ON, but Cashfree credentials (App ID and Secret Key) are incomplete. Online checkout in Client Portal will safely remain disabled until valid credentials are saved.
                          </span>
                        </div>
                      ) : (
                        <div className="md:col-span-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-600 shrink-0" />
                          <span>
                            <strong>Effective State: Operational</strong> — Cashfree credentials configured. Clients can pay invoices online securely.
                          </span>
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <h3 className="text-sm font-bold text-slate-800 mb-1">Cashfree API Credentials</h3>
                        <p className="text-xs text-slate-400">
                          Credentials stored securely using AES-256 encryption. Environment variables override these database values if present.
                        </p>
                      </div>

                      <InputField
                        label="Cashfree App ID"
                        field="cashfreeAppId"
                        value={f('cashfreeAppId')}
                        onChange={update}
                        placeholder="CF_APP_xxxxxxxx"
                      />

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cashfree Environment</label>
                        <select
                          value={f('cashfreeEnvironment') || 'sandbox'}
                          onChange={(e) => update('cashfreeEnvironment', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="sandbox">Sandbox (Testing / Pre-production)</option>
                          <option value="production">Production (Live Payments)</option>
                        </select>
                      </div>

                      <InputField
                        label={`Cashfree Secret Key${(profile as any)?.cashfreeSecretConfigured ? ' (configured — leave blank to keep it)' : ''}`}
                        field="cashfreeSecretKey"
                        value={f('cashfreeSecretKey')}
                        onChange={update}
                        type="password"
                        placeholder={(profile as any)?.cashfreeSecretConfigured ? '••••••••••••' : 'Enter Cashfree secret key'}
                      />

                      <InputField
                        label={`Cashfree Webhook Secret (Optional)${(profile as any)?.cashfreeWebhookSecretConfigured ? ' (configured — leave blank to keep it)' : ''}`}
                        field="cashfreeWebhookSecret"
                        value={f('cashfreeWebhookSecret')}
                        onChange={update}
                        type="password"
                        placeholder={(profile as any)?.cashfreeWebhookSecretConfigured ? '••••••••••••' : 'Optional: Leave blank to use API Secret Key'}
                      />

                      <div className="md:col-span-2 text-xs text-slate-400">
                        Webhook endpoint URL: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono text-[11px]">/payments/cashfree/webhook</code>. Cashfree will send raw webhook notifications with timestamp signature verification.
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Templates ── */}
              {activeTab === 'templates' && (
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 mb-4">Document Prefixes</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <InputField label="Invoice Prefix"    field="invoicePrefix"   value={f('invoicePrefix')}   onChange={update} placeholder="NVLT" />
                      <InputField label="Quote Prefix"      field="quotePrefix"     value={f('quotePrefix')}     onChange={update} placeholder="QUO" />
                      <InputField label="AMC Prefix"        field="amcPrefix"       value={f('amcPrefix')}       onChange={update} placeholder="AMC" />
                      <InputField label="AMC Report Prefix" field="amcReportPrefix" value={f('amcReportPrefix')} onChange={update} placeholder="AMCR" />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Example: {f('invoicePrefix') || 'NVLT'}-2026-06-00001, {f('quotePrefix') || 'QUO'}-2026-06-00001
                    </p>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 mb-4 mt-2">Terms & Conditions Templates</h2>
                    <div className="grid grid-cols-1 gap-4">
                      <InputField label="Invoice Terms"    field="invoiceTerms" value={f('invoiceTerms')} onChange={update} textarea placeholder="Payment due within 7 days. Late payments subject to 2% monthly interest…" />
                      <InputField label="Quotation Terms"  field="quoteTerms"   value={f('quoteTerms')}   onChange={update} textarea placeholder="This quotation is valid for 30 days. Prices may change after the validity period…" />
                      <InputField label="AMC Terms"        field="amcTerms"     value={f('amcTerms')}     onChange={update} textarea placeholder="Annual Maintenance Contract. Hours are non-transferable and expire monthly…" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Hint */}
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700 flex items-center gap-2">
          <span>💡</span>
          <span>Company profile is used as letterhead on all generated PDFs (Invoices, Quotations, AMC Reports). Save changes to update all future documents.</span>
        </div>
      </div>
    </div>
  );
}
