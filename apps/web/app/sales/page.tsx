'use client';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  useQuotes, useCreateQuote, useUpdateQuote, useSendQuote, useAcceptQuote,
  useAllClients, useServiceCatalog, useConvertQuoteToInvoice, useDeleteQuote, useRejectQuote
} from '../../src/hooks/queries';
import { api } from '../../src/lib/api';
import { useToast } from '../../src/components/ToastProvider';
import {
  Plus, FileText, Send, CheckCircle, Trash2, ChevronDown, ChevronRight,
  Download, Eye, Search, Filter, IndianRupee, MoreHorizontal, FilePlus, XCircle, Edit3
} from 'lucide-react';
import { PageShell, PageHeader, Button, SearchInput, selectClass } from '../../src/components/ui/page';
import { KpiCard } from '../../src/components/ui/charts';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT:    { label: 'Draft',    cls: 'bg-slate-100 text-slate-600' },
  SENT:     { label: 'Sent',     cls: 'bg-blue-100 text-blue-700' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  EXPIRED:  { label: 'Expired',  cls: 'bg-orange-100 text-orange-700' },
};

const fmt = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── Line item calculator ───────────────────────────────────────────────────
function calcLine(item: any, gstRate: number) {
  const qty = Number(item.quantity ?? 1);
  const price = Number(item.unitPrice ?? 0);
  const disc = Number(item.discountAmount ?? 0);
  const isFree = item.itemType === 'FREE';
  const amount = isFree ? 0 : Math.max(0, qty * price - disc);
  const lineGst = Number(item.gstRate ?? gstRate);
  const gstAmount = isFree ? 0 : Math.round(amount * (lineGst / 100) * 100) / 100;
  return { ...item, amount, gstAmount };
}

function calcTotals(items: any[], discountAmount: number, gstRate: number) {
  const subTotal = items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const gstAmount = items.reduce((s, i) => s + (i.gstAmount ?? 0), 0);
  const disc = Math.min(discountAmount, subTotal);
  const grandTotal = Math.max(0, subTotal + gstAmount - disc);
  return { subTotal, gstAmount, discountAmount: disc, grandTotal };
}

// ── Quotation Builder ──────────────────────────────────────────────────────
function QuotationBuilder({ onClose, existingQuote }: { onClose: () => void; existingQuote?: any }) {
  const { data: clients } = useAllClients();
  const { data: catalogData } = useServiceCatalog();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const { success, error } = useToast();

  const [form, setForm] = useState({
    clientId: existingQuote?.clientId ?? '',
    title: existingQuote?.title ?? '',
    description: existingQuote?.description ?? '',
    validUntil: existingQuote?.validUntil ? existingQuote.validUntil.split('T')[0] : '',
    gstRate: existingQuote?.gstRate ?? 18,
    discountAmount: existingQuote?.discountAmount ?? 0,
    scopeOfWork: existingQuote?.scopeOfWork ?? '',
    exclusions: existingQuote?.exclusions ?? '',
    termsConditions: existingQuote?.termsConditions ?? '',
    quoteType: existingQuote?.quoteType ?? 'PROJECT',
  });

  const [items, setItems] = useState<any[]>(existingQuote?.lineItems ?? [
    { description: '', itemType: 'SERVICE', quantity: 1, unit: 'Project', unitPrice: 0, discountAmount: 0, gstRate: 18, amount: 0, gstAmount: 0, sortOrder: 0 }
  ]);

  const [milestones, setMilestones] = useState<any[]>(existingQuote?.milestoneSchedule ?? []);
  const [activeSection, setActiveSection] = useState<string>('items');
  const [saving, setSaving] = useState(false);

  const services = catalogData?.services ?? [];

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = calcLine({ ...next[idx], [field]: value }, Number(form.gstRate));
      return next;
    });
  };

  const selectService = (idx: number, svc: any) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = calcLine({
        ...next[idx],
        serviceId: svc.id,
        description: svc.name,
        unitPrice: svc.basePrice,
        unit: svc.unitType === 'Hour' ? 'Hour' : 'Project',
        gstRate: svc.gstRate,
        itemType: 'SERVICE',
      }, Number(form.gstRate));
      return next;
    });
  };

  const addItem = (type: 'SERVICE' | 'CUSTOM' | 'DISCOUNT' | 'FREE') => {
    setItems(prev => [...prev, {
      description: type === 'DISCOUNT' ? 'Discount' : type === 'FREE' ? 'Complimentary Service' : '',
      itemType: type,
      quantity: 1,
      unit: 'Project',
      unitPrice: 0,
      discountAmount: 0,
      gstRate: Number(form.gstRate),
      amount: 0,
      gstAmount: 0,
      sortOrder: prev.length,
    }]);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const addMilestone = () => setMilestones(prev => [...prev, { milestone: '', percentage: 0, dueDate: '' }]);
  const updateMilestone = (idx: number, field: string, value: any) => setMilestones(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });
  const removeMilestone = (idx: number) => setMilestones(prev => prev.filter((_, i) => i !== idx));

  const calcedItems = items.map(i => calcLine(i, Number(form.gstRate)));
  const totals = calcTotals(calcedItems, Number(form.discountAmount), Number(form.gstRate));

  const handleSave = async () => {
    if (!form.clientId || !form.title) return error('Validation Error', 'Client and title are required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        gstRate: Number(form.gstRate),
        discountAmount: Number(form.discountAmount),
        milestoneSchedule: milestones.length > 0 ? milestones : undefined,
        items: calcedItems,
      };
      if (existingQuote) {
        await updateMutation.mutateAsync({ id: existingQuote.id, ...payload });
        success('Quote Updated', 'Quotation was updated successfully.');
      } else {
        await createMutation.mutateAsync(payload);
        success('Quote Created', 'New quotation generated successfully.');
      }
      onClose();
    } catch (e: any) {
      error('Save Failed', e?.response?.data?.message ?? 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  const SectionBtn = ({ id, label }: { id: string; label: string }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeSection === id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-stretch overflow-hidden">
      <div className="flex flex-col w-full max-w-7xl mx-auto bg-slate-50 shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Quotation Builder</h2>
              <p className="text-xs text-slate-500">{existingQuote ? existingQuote.quoteNumber : 'New Quote'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              <CheckCircle size={15} /> {saving ? 'Saving…' : 'Save Quote'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Main editor */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Client + Meta */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client *</label>
                  <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Client…</option>
                    {(clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quote Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. CityDekho Mobile App Development"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quotation Type</label>
                  <select value={form.quoteType} onChange={e => setForm(f => ({ ...f, quoteType: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PROJECT">Project / Standard</option>
                    <option value="AMC">Annual Maintenance Contract (AMC)</option>
                    <option value="ASSET">Asset Subscription</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valid Until</label>
                  <input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">GST Rate (%)</label>
                  <input type="number" value={form.gstRate} onChange={e => setForm(f => ({ ...f, gstRate: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Global Discount (₹)</label>
                  <input type="number" min="0" value={form.discountAmount} onChange={e => setForm(f => ({ ...f, discountAmount: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
              {[
                { id: 'items', label: '📋 Line Items' },
                { id: 'milestones', label: '💰 Milestones' },
                { id: 'scope', label: '📝 Scope & Terms' },
              ].map(s => <SectionBtn key={s.id} id={s.id} label={s.label} />)}
            </div>

            {/* Line Items */}
            {activeSection === 'items' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-800 grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  <div className="col-span-4">Description</div>
                  <div className="col-span-1">Qty</div>
                  <div className="col-span-1">Unit</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-1 text-right">Disc</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1"></div>
                </div>
                {calcedItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-50 hover:bg-slate-50/50 items-center">
                    <div className="col-span-4">
                      {item.itemType === 'SERVICE' ? (
                        <select
                          value={item.serviceId ?? ''}
                          onChange={e => {
                            const svc = services.find((s: any) => s.id === e.target.value);
                            if (svc) selectService(idx, svc);
                            else updateItem(idx, 'serviceId', e.target.value);
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        >
                          <option value="">Custom / Select Service…</option>
                          {services.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.category} › {s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            item.itemType === 'FREE' ? 'bg-green-100 text-green-700' :
                            item.itemType === 'DISCOUNT' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{item.itemType}</span>
                        </div>
                      )}
                      <input
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        placeholder="Description…"
                        className="mt-1 w-full px-2 py-1 text-sm border-0 border-b border-slate-200 focus:outline-none focus:border-indigo-400 bg-transparent"
                      />
                    </div>
                    <div className="col-span-1">
                      <input type="number" min="0" step="0.5" value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right"
                        disabled={item.itemType === 'FREE'}
                      />
                    </div>
                    <div className="col-span-1">
                      <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        {['Project', 'Hour', 'Sprint', 'Page', 'Month'].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="0" value={item.unitPrice}
                        onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right"
                        disabled={item.itemType === 'FREE'}
                      />
                    </div>
                    <div className="col-span-1">
                      <input type="number" min="0" value={item.discountAmount}
                        onChange={e => updateItem(idx, 'discountAmount', Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right text-red-600"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <div className={`font-semibold text-sm ${item.itemType === 'FREE' ? 'text-green-600' : 'text-slate-900'}`}>
                        {item.itemType === 'FREE' ? 'FREE' : fmt(item.amount)}
                      </div>
                      {item.gstAmount > 0 && (
                        <div className="text-xs text-slate-400">+{fmt(item.gstAmount)} GST</div>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => removeItem(idx)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 p-4">
                  <button onClick={() => addItem('SERVICE')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                    <Plus size={13} /> Add Service
                  </button>
                  <button onClick={() => addItem('CUSTOM')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                    <Plus size={13} /> Custom Line
                  </button>
                  <button onClick={() => addItem('DISCOUNT')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                    <Plus size={13} /> Add Discount
                  </button>
                  <button onClick={() => addItem('FREE')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                    <Plus size={13} /> Add FREE
                  </button>
                </div>
              </div>
            )}

            {/* Milestones */}
            {activeSection === 'milestones' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Milestone Payment Schedule</h3>
                {milestones.length === 0 && (
                  <p className="text-sm text-slate-400 mb-4">No milestones defined. Add milestone-based payment schedule.</p>
                )}
                {milestones.map((m, idx) => (
                  <div key={idx} className="flex gap-3 mb-3 items-center">
                    <span className="text-xs font-bold text-slate-400 w-6 text-right">{idx + 1}</span>
                    <input value={m.milestone} onChange={e => updateMilestone(idx, 'milestone', e.target.value)}
                      placeholder="e.g. Design Approval" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <input type="number" min="0" max="100" value={m.percentage} onChange={e => updateMilestone(idx, 'percentage', Number(e.target.value))}
                      placeholder="%" className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right"
                    />
                    <span className="text-xs text-slate-500">%</span>
                    <input type="date" value={m.dueDate} onChange={e => updateMilestone(idx, 'dueDate', e.target.value)}
                      className="w-36 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button onClick={() => removeMilestone(idx)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 mt-4">
                  <button onClick={addMilestone} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                    <Plus size={13} /> Add Milestone
                  </button>
                  <div className="text-xs text-slate-400 self-center">
                    Total: {milestones.reduce((s, m) => s + Number(m.percentage || 0), 0)}% of {fmt(totals.grandTotal)}
                  </div>
                </div>
              </div>
            )}

            {/* Scope & Terms */}
            {activeSection === 'scope' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scope of Work (Included)</label>
                  <textarea value={form.scopeOfWork} onChange={e => setForm(f => ({ ...f, scopeOfWork: e.target.value }))}
                    rows={6} placeholder="List everything included in this quote, one item per line…"
                    className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Exclusions (Not Included)</label>
                  <textarea value={form.exclusions} onChange={e => setForm(f => ({ ...f, exclusions: e.target.value }))}
                    rows={4} placeholder="Third-party services, licenses, content not specified above…"
                    className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Terms & Conditions</label>
                  <textarea value={form.termsConditions} onChange={e => setForm(f => ({ ...f, termsConditions: e.target.value }))}
                    rows={4} placeholder="Payment terms, validity, dispute resolution…"
                    className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Totals panel */}
          <div className="w-72 bg-white border-l border-slate-200 p-5 flex flex-col gap-4 overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-800">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">{fmt(totals.subTotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span className="font-medium">−{fmt(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>GST @ {form.gstRate}%</span>
                <span className="font-medium text-slate-900">{fmt(totals.gstAmount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="font-bold text-slate-900">Grand Total</span>
                <span className="font-bold text-indigo-700 text-lg">{fmt(totals.grandTotal)}</span>
              </div>
            </div>

            {/* Line items breakdown */}
            <div className="mt-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Line Items</h4>
              <div className="space-y-1">
                {calcedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-slate-600 truncate max-w-36">{item.description || `Item ${idx + 1}`}</span>
                    <span className={item.itemType === 'FREE' ? 'text-green-600 font-medium' : 'text-slate-900 font-medium'}>
                      {item.itemType === 'FREE' ? 'FREE' : fmt(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Sales Page ────────────────────────────────────────────────────────
export default function SalesPage() {
  const [params, setParams] = useState({ page: 1, limit: 20, status: '', search: '' });
  const { data, isLoading } = useQuotes(params);
  const sendMutation = useSendQuote();
  const acceptMutation = useAcceptQuote();
  const rejectMutation = useRejectQuote();
  const deleteMutation = useDeleteQuote();
  const convertMutation = useConvertQuoteToInvoice();
  const { success, error } = useToast();

  const [showBuilder, setShowBuilder] = useState(false);
  const [editQuote, setEditQuote] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const quotes = data?.quotes ?? [];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('edit');
      if (editId && quotes.length > 0 && !editQuote) {
        const q = quotes.find((x: any) => x.id === editId);
        if (q && q.status === 'DRAFT') {
          setEditQuote(q);
          setShowBuilder(true);
          // Clear query param so it doesn't reopen next time
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', window.location.pathname);
            }
          }, 500);
        }
      }
    }
  }, [quotes, editQuote]);

  const handleDownloadPdf = async (id: string, qNumber: string) => {
    try {
      const resp = await api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });
      const contentType = String(resp.headers['content-type'] ?? '');
      if (!contentType.includes('pdf')) {
        const text = await (resp.data as Blob).text();
        throw new Error(JSON.parse(text).message ?? 'PDF generation failed');
      }
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `${qNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { error('PDF Error', e.message ?? 'Failed to generate PDF'); }
  };

  const handleAction = async (action: any, id: string, name: string, isDelete = false) => {
    if (isDelete && !confirm(`Are you sure you want to delete quote ${name}?`)) return;
    try {
      await action.mutateAsync(id);
      success('Success', `Quote ${name} updated successfully.`);
    } catch (e: any) {
      error('Action Failed', e?.response?.data?.message ?? 'Failed to process request');
    }
  };

  const pageValue = (st?: string) => quotes.filter((q: any) => !st || q.status === st).reduce((s: number, q: any) => s + Number(q.grandTotal || 0), 0);
  const decided = quotes.filter((q: any) => q.status === 'ACCEPTED' || q.status === 'REJECTED').length;
  const winRate = decided ? Math.round((quotes.filter((q: any) => q.status === 'ACCEPTED').length / decided) * 100) : null;

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={FileText}
          title="Quotations"
          subtitle="Build quotes from the service catalog, send them and turn accepted ones into invoices."
          actions={<Button variant="primary" onClick={() => { setEditQuote(null); setShowBuilder(true); }}><Plus size={16} /> New quotation</Button>}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Quotations" value={data?.total ?? quotes.length} icon={FileText} tone="info" />
          <KpiCard label="Waiting on client" value={quotes.filter((q: any) => q.status === 'SENT').length} icon={Send} tone="warning" delta={{ text: fmt(pageValue('SENT')) }} />
          <KpiCard label="Accepted" value={quotes.filter((q: any) => q.status === 'ACCEPTED').length} icon={CheckCircle} tone="ok" delta={{ text: fmt(pageValue('ACCEPTED')) }} />
          <KpiCard label="Win rate" value={winRate === null ? '—' : `${winRate}%`} icon={IndianRupee} tone="violet" delta={{ text: decided ? `of ${decided} decided` : 'No decisions yet' }} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <SearchInput
            className="flex-1"
            placeholder="Search by quote number or title…"
            value={search}
            onChange={v => { setSearch(v); setParams(p => ({ ...p, search: v })); }}
          />
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setParams(p => ({ ...p, status: e.target.value })); }}
            className={selectClass}
          >
            <option value="">All statuses</option>
            {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        </div>

        {/* Quotes Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quote #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client / Title</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valid Until</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading quotations…</td></tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <FileText size={40} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-slate-400 font-medium">No quotations yet</p>
                    <p className="text-slate-300 text-sm">Click "New Quotation" to create your first quote</p>
                  </td>
                </tr>
              ) : quotes.map((q: any) => (
                <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/sales/${q.id}`} className="font-mono text-sm font-medium text-indigo-700 hover:underline">{q.quoteNumber}</Link>
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/sales/${q.id}`} className="font-medium text-slate-900 text-sm hover:underline block">{q.title}</Link>
                    <div className="text-xs text-slate-400">{q.clientName}</div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="font-bold text-slate-900">{fmt(q.grandTotal)}</div>
                    <div className="text-xs text-slate-400">{q.lineItemCount} item{q.lineItemCount !== 1 ? 's' : ''}</div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[q.status]?.cls ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_CONFIG[q.status]?.label ?? q.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`text-sm ${q.isExpired ? 'text-red-500 font-medium' : 'text-slate-600'}`}>
                      {fmtDate(q.validUntil)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/sales/${q.id}`}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Details">
                        <Eye size={14} />
                      </Link>
                      {q.status === 'DRAFT' && (
                        <button onClick={() => { setEditQuote(q); setShowBuilder(true); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                          <Edit3 size={14} />
                        </button>
                      )}
                      {q.status === 'DRAFT' && (
                        <button onClick={() => handleAction(sendMutation, q.id, q.quoteNumber)}
                          disabled={sendMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50">
                          <Send size={12} /> Send
                        </button>
                      )}
                      {q.status === 'SENT' && (
                        <button onClick={() => handleAction(acceptMutation, q.id, q.quoteNumber)}
                          disabled={acceptMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50">
                          <CheckCircle size={12} /> Accept
                        </button>
                      )}
                      {q.status === 'SENT' && (
                        <button onClick={() => handleAction(rejectMutation, q.id, q.quoteNumber)}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
                          <XCircle size={12} /> Reject
                        </button>
                      )}
                      {q.status === 'ACCEPTED' && (
                        q.invoices && q.invoices.length > 0 ? (
                          <Link href={`/billing/${q.invoices[0].id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                            <Eye size={12} /> Invoice
                          </Link>
                        ) : (
                          <button onClick={() => handleAction(convertMutation, q.id, q.quoteNumber)}
                            disabled={convertMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50">
                            <FilePlus size={12} /> → Invoice
                          </button>
                        )
                      )}
                      <button onClick={() => handleDownloadPdf(q.id, q.quoteNumber)}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Download PDF">
                        <Download size={14} />
                      </button>
                      {['DRAFT', 'REJECTED'].includes(q.status) && (
                        <button onClick={() => handleAction(deleteMutation, q.id, q.quoteNumber, true)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Builder Modal */}
      {showBuilder && (
        <QuotationBuilder
          onClose={() => { setShowBuilder(false); setEditQuote(null); }}
          existingQuote={editQuote}
        />
      )}
    </PageShell>
  );
}
