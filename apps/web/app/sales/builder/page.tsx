'use client';
import { useState, useEffect } from 'react';
import {
  useAllClients,
  useServiceCatalog,
  useCreateQuote,
  useCompanyProfile,
} from '../../../src/hooks/queries';
import { Plus, Trash2, Save, FileText, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
    <div className="flex flex-col gap-1 font-sans">
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

interface LineItem {
  serviceId?: string;
  itemType: 'SERVICE' | 'CUSTOM' | 'DISCOUNT' | 'FREE' | 'TAX_ADJUSTMENT';
  description: string;
  longDescription?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  gstRate: number;
  gstAmount: number;
  amount: number;
  isOptional: boolean;
}

interface Milestone {
  name: string;
  percent: number;
  amount: number;
  targetDate: string;
}

export default function QuoteBuilderPage() {
  const router = useRouter();
  const { data: clients = [], isLoading: loadingClients } = useAllClients();
  const { data: catalogData, isLoading: loadingCatalog } = useServiceCatalog({ activeOnly: 'true' });
  const { data: companyProfile } = useCompanyProfile();
  const createQuoteMutation = useCreateQuote();

  const services = catalogData?.services ?? [];

  // Form State
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [quoteType, setQuoteType] = useState('PROJECT');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemType: 'SERVICE', description: '', quantity: 1, unit: 'Project', unitPrice: 0, discountPercent: 0, discountAmount: 0, gstRate: 18, gstAmount: 0, amount: 0, isOptional: false }
  ]);

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // Seed terms from company profile when available
  useEffect(() => {
    if (companyProfile) {
      setTermsConditions(companyProfile.quoteTerms ?? '');
    }
  }, [companyProfile]);

  // Recalculate Quote Totals dynamically
  const calculateTotals = () => {
    let subTotal = 0;
    let totalGst = 0;
    let totalDiscount = 0;

    const items = lineItems.map(item => {
      // Calculate item values
      const rawAmount = item.quantity * item.unitPrice;
      const discPercentVal = (rawAmount * (item.discountPercent / 100));
      const discAmount = item.discountPercent > 0 ? discPercentVal : item.discountAmount;
      const netAmount = rawAmount - discAmount;
      const gstAmount = netAmount * (item.gstRate / 100);
      const finalAmount = netAmount;

      if (!item.isOptional) {
        subTotal += rawAmount;
        totalDiscount += discAmount;
        totalGst += gstAmount;
      }

      return {
        ...item,
        discountAmount: discAmount,
        gstAmount,
        amount: finalAmount,
      };
    });

    // Subtotal after item discounts
    const subTotalNet = subTotal - totalDiscount;
    // Apply overall quote discount percent if any
    const overallDiscount = subTotalNet * (discountPercent / 100);
    const finalSubTotal = subTotalNet - overallDiscount;

    // Recalculate GST on final subtotal if overall discount was applied
    // Or just accumulate total GST minus overall discount percentage
    const finalGst = totalGst * (1 - (discountPercent / 100));
    const grandTotal = finalSubTotal + finalGst;

    return {
      items,
      subTotal: subTotal,
      discountAmount: totalDiscount + overallDiscount,
      gstAmount: finalGst,
      grandTotal: grandTotal,
    };
  };

  const totals = calculateTotals();

  // Handlers
  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { itemType: 'SERVICE', description: '', quantity: 1, unit: 'Project', unitPrice: 0, discountPercent: 0, discountAmount: 0, gstRate: 18, gstAmount: 0, amount: 0, isOptional: false }
    ]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLineItem = (idx: number, fields: Partial<LineItem>) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const merged = { ...item, ...fields };

      // Auto-populate from Service Catalog if serviceId changed
      if (fields.serviceId) {
        const svc = services.find((s: any) => s.id === fields.serviceId);
        if (svc) {
          merged.description = svc.name;
          merged.longDescription = svc.description;
          merged.unitPrice = Number(svc.basePrice);
          merged.gstRate = Number(svc.gstRate);
          merged.unit = svc.unitType;
        }
      }
      return merged;
    }));
  };

  // Milestones Handlers
  const addMilestone = () => {
    setMilestones(prev => [
      ...prev,
      { name: `Milestone ${prev.length + 1}`, percent: 0, amount: 0, targetDate: '' }
    ]);
  };

  const removeMilestone = (idx: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, fields: Partial<Milestone>) => {
    setMilestones(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const merged = { ...m, ...fields };

      // Sync percent and amount
      if (fields.percent !== undefined) {
        merged.amount = Math.round(Number(totals.grandTotal) * (Number(fields.percent) / 100));
      } else if (fields.amount !== undefined) {
        merged.percent = Math.round((Number(fields.amount) / Number(totals.grandTotal)) * 100);
      }
      return merged;
    }));
  };

  const autoGenerateMilestones = () => {
    const defaultMilestones = [
      { name: 'Kickoff (Advance)', percent: 30, amount: Math.round(totals.grandTotal * 0.3), targetDate: '' },
      { name: 'Mid-term Milestone', percent: 40, amount: Math.round(totals.grandTotal * 0.4), targetDate: '' },
      { name: 'Final Handover & Launch', percent: 30, amount: Math.round(totals.grandTotal * 0.3), targetDate: '' },
    ];
    setMilestones(defaultMilestones);
  };

  const handleSaveQuote = async () => {
    if (!clientId) {
      alert('Please select a Client');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a Quote Title');
      return;
    }

    try {
      const payload = {
        clientId,
        title,
        description,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        quoteType,
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        discountPercent,
        gstAmount: totals.gstAmount,
        grandTotal: totals.grandTotal,
        scopeOfWork,
        exclusions,
        termsConditions,
        milestoneSchedule: milestones,
        lineItems: totals.items.map(item => ({
          serviceId: item.serviceId || null,
          itemType: item.itemType,
          description: item.description,
          longDescription: item.longDescription || '',
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          discountPercent: item.discountPercent,
          gstRate: item.gstRate,
          gstAmount: item.gstAmount,
          amount: item.amount,
          isOptional: item.isOptional,
        })),
      };

      const res = await createQuoteMutation.mutateAsync(payload);
      router.push(`/sales/${res.id}`);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to create quotation');
    }
  };

  const fmtCurrency = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <div className="mb-4">
          <Link href="/sales" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={16} /> Back to Sales
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText size={24} className="text-indigo-600" /> Quotation Builder
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Create an itemized proposal with service mappings, tax structures, and milestones.
            </p>
          </div>
          <button
            onClick={handleSaveQuote}
            disabled={createQuoteMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm disabled:opacity-60"
          >
            {createQuoteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {createQuoteMutation.isPending ? 'Saving Quote…' : 'Save & Close'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Builder Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Meta Details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Proposal Meta Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Client *</label>
                  {loadingClients ? (
                    <div className="text-xs text-slate-400 mt-2">Loading clients list…</div>
                  ) : (
                    <select
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      className={`mt-1 ${inputCls}`}
                      required
                    >
                      <option value="">-- Select a Client --</option>
                      {clients.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Quotation Type</label>
                  <select
                    value={quoteType}
                    onChange={e => setQuoteType(e.target.value)}
                    className={`mt-1 ${inputCls}`}
                  >
                    <option value="PROJECT">Project / Standard</option>
                    <option value="AMC">Annual Maintenance Contract (AMC)</option>
                    <option value="ASSET">Asset Subscription (Domain/Hosting/etc.)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Quote Expiry / Valid Until</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={e => setValidUntil(e.target.value)}
                    className={`mt-1 ${inputCls}`}
                  />
                </div>
                <div className="md:col-span-3">
                  <InputField label="Quote Title *" field="title" value={title} onChange={(_, val) => setTitle(val)} placeholder="Custom SaaS Dashboard & API Integrations" />
                </div>
                <div className="md:col-span-3">
                  <InputField label="Executive Summary" field="description" value={description} onChange={(_, val) => setDescription(val)} textarea placeholder="Describe the overview of the project proposal..." />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Itemized Line Items</h2>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus size={14} /> Add Line Item
                </button>
              </div>

              <div className="space-y-4">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="p-4 border border-slate-100 bg-slate-50/30 rounded-xl space-y-3 relative group">
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className={labelCls}>Catalog Service Mapping</label>
                        {loadingCatalog ? (
                          <div className="text-[10px] text-slate-400 mt-2">Loading catalog…</div>
                        ) : (
                          <select
                            value={item.serviceId || ''}
                            onChange={e => updateLineItem(idx, { serviceId: e.target.value })}
                            className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">-- Custom (No Map) --</option>
                            {services.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name} ({s.serviceCode})</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Item Type</label>
                        <select
                          value={item.itemType}
                          onChange={e => updateLineItem(idx, { itemType: e.target.value as any })}
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="SERVICE">Service</option>
                          <option value="CUSTOM">Custom Item</option>
                          <option value="DISCOUNT">Discount</option>
                          <option value="FREE">Free</option>
                          <option value="TAX_ADJUSTMENT">Tax Adjust</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelCls}>Description *</label>
                        <input
                          required
                          value={item.description}
                          onChange={e => updateLineItem(idx, { description: e.target.value })}
                          placeholder="e.g. Design Wireframes / Phase 1 Backend Development"
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div>
                        <label className={labelCls}>Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateLineItem(idx, { quantity: Number(e.target.value) })}
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Unit</label>
                        <input
                          value={item.unit}
                          onChange={e => updateLineItem(idx, { unit: e.target.value })}
                          placeholder="Project/Hour"
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Unit Price (₹)</label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={e => updateLineItem(idx, { unitPrice: Number(e.target.value) })}
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Disc (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercent}
                          onChange={e => updateLineItem(idx, { discountPercent: Number(e.target.value) })}
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>GST (%)</label>
                        <input
                          type="number"
                          value={item.gstRate}
                          onChange={e => updateLineItem(idx, { gstRate: Number(e.target.value) })}
                          className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-1.5 text-xs text-slate-500 select-none cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={item.isOptional}
                            onChange={e => updateLineItem(idx, { isOptional: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span>Optional</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestone Schedule */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Milestone Billing Schedule</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={autoGenerateMilestones}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800"
                  >
                    <Sparkles size={14} /> Auto-Generate (30/40/30)
                  </button>
                  <button
                    type="button"
                    onClick={addMilestone}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus size={14} /> Add Milestone
                  </button>
                </div>
              </div>

              {milestones.length === 0 ? (
                <div className="text-xs text-slate-400 p-4 border border-dashed border-slate-100 rounded-xl text-center bg-slate-50/50">
                  No billing milestones set. Auto-generate or add manual milestones below.
                </div>
              ) : (
                <div className="space-y-3">
                  {milestones.map((m, idx) => (
                    <div key={idx} className="flex gap-3 items-center p-3 border border-slate-100 rounded-xl relative group bg-slate-50/30">
                      <div className="flex-1">
                        <input
                          required
                          value={m.name}
                          onChange={e => updateMilestone(idx, { name: e.target.value })}
                          className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded"
                          placeholder="e.g. Initial Design Approval"
                        />
                      </div>
                      <div className="w-20">
                        <div className="relative">
                          <input
                            type="number"
                            value={m.percent}
                            onChange={e => updateMilestone(idx, { percent: Number(e.target.value) })}
                            className="w-full pl-2 pr-5 py-1 text-xs border border-slate-200 rounded text-right font-mono"
                          />
                          <span className="absolute right-1.5 top-1 text-xs text-slate-400">%</span>
                        </div>
                      </div>
                      <div className="w-28 text-right font-bold text-slate-700 text-xs font-mono">
                        {fmtCurrency(m.amount)}
                      </div>
                      <div>
                        <input
                          type="date"
                          value={m.targetDate}
                          onChange={e => updateMilestone(idx, { targetDate: e.target.value })}
                          className="px-2 py-0.5 text-xs border border-slate-200 rounded"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMilestone(idx)}
                        className="p-1 text-slate-300 hover:text-red-500 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500 border-t pt-3 px-2">
                    <span>Total Allocated Milestones:</span>
                    <span className={milestones.reduce((s, x) => s + x.percent, 0) === 100 ? 'text-green-600 font-bold' : 'text-amber-600 font-bold'}>
                      {milestones.reduce((s, x) => s + x.percent, 0)}% / 100%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Scope, Exclusions, Terms */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Scope, Exclusions & Terms</h2>
              <div className="space-y-4">
                <InputField label="Scope of Work" field="scopeOfWork" value={scopeOfWork} onChange={(_, val) => setScopeOfWork(val)} textarea placeholder="Define features and milestones included in the scope..." />
                <InputField label="Exclusions / Out of Scope" field="exclusions" value={exclusions} onChange={(_, val) => setExclusions(val)} textarea placeholder="Define what is explicitly excluded from this pricing..." />
                <InputField label="Terms & Conditions" field="termsConditions" value={termsConditions} onChange={(_, val) => setTermsConditions(val)} textarea placeholder="Quote validity, invoice schedule, delay interest, etc..." />
              </div>
            </div>
          </div>

          {/* Right Sidebar: Dynamic Breakdown */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 sticky top-6">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Proposal Price Breakdown</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">{fmtCurrency(totals.subTotal)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount (Item level)</span>
                    <span className="font-mono font-medium">- {fmtCurrency(totals.discountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3">
                  <label className={labelCls}>Overall Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={e => setDiscountPercent(Number(e.target.value))}
                    className={`mt-1 ${inputCls}`}
                  />
                </div>
                <div className="flex justify-between text-slate-600 pt-2">
                  <span>Estimated GST (18%)</span>
                  <span className="font-mono font-medium">{fmtCurrency(totals.gstAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-100 pt-3">
                  <span>Grand Total</span>
                  <span className="font-mono text-indigo-600">{fmtCurrency(totals.grandTotal)}</span>
                </div>
              </div>
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-700">
                💡 Optional line items are skipped in total estimations. Milestones calculation is computed based on the Grand Total.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
