'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useInvoices, useInvoice, useAllClients, useConvertQuoteToInvoice,
  useRecordPayment, useQuotes, useCreateInvoice, useAssets, useSendOverdueReminders,
  useOverdueInvoices, useDeleteInvoice, useManualPayments, useApproveManualPayment, useRejectManualPayment
} from '../../src/hooks/queries';
import { api } from '../../src/lib/api';
import {
  Receipt, Plus, Download, CreditCard, CheckCircle, Clock, AlertCircle,
  Search, Eye, Send, IndianRupee, FileText, ChevronRight, RotateCcw, Trash2,
  ShieldCheck, Check, X, ExternalLink
} from 'lucide-react';
import { PageShell, PageHeader, Tabs, Badge, statusTone, Button, SearchInput, selectClass, TableCard, th, dayBuckets } from '../../src/components/ui/page';
import { KpiCard, ChartCard, StackedBars, Donut } from '../../src/components/ui/charts';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:        { label: 'Draft',        cls: 'bg-slate-100 text-slate-600' },
  sent:         { label: 'Sent',         cls: 'bg-blue-100 text-blue-700' },
  paid:         { label: 'Paid',         cls: 'bg-green-100 text-green-700' },
  overdue:      { label: 'Overdue',      cls: 'bg-red-100 text-red-700' },
  partial_paid: { label: 'Partial',      cls: 'bg-amber-100 text-amber-700' },
  cancelled:    { label: 'Cancelled',    cls: 'bg-slate-100 text-slate-500' },
};

const fmt = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function PaymentModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const recordPayment = useRecordPayment();
  const [form, setForm] = useState({ amount: invoice.balanceDue ?? invoice.grandTotal, method: 'BANK_TRANSFER', transactionId: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recordPayment.mutateAsync({ id: invoice.id, ...form, amount: Number(form.amount) });
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Payment failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
          <p className="text-sm text-slate-500 mt-1">Invoice: <span className="font-mono font-medium text-indigo-700">{invoice.invoiceNumber}</span></p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount (₹) *</label>
            <input required type="number" min="1" max={invoice.balanceDue} step="0.01"
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-400 mt-1">Balance due: {fmt(invoice.balanceDue)}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Method</label>
            <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'CREDIT_CARD', 'RAZORPAY'].map(m => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Transaction ID / UTR</label>
            <input value={form.transactionId} onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))}
              placeholder="Bank reference / UTR number"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional payment note…"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              <CreditCard size={14} className="inline mr-1.5" />
              {submitting ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceDetailPanel({
  invoiceId,
  onClose,
  hasPendingManual,
  onReviewManual,
}: {
  invoiceId: string;
  onClose: () => void;
  hasPendingManual?: boolean;
  onReviewManual?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const [showPayment, setShowPayment] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await api.patch(`/invoices/${invoiceId}/send`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to send invoice');
    } finally { setSending(false); }
  };

  const handleResend = async () => {
    if (!confirm('Are you sure you want to resend this invoice email to the client?')) return;
    setResending(true);
    try {
      await api.patch(`/invoices/${invoiceId}/send`);
      alert('Invoice email resent successfully.');
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to resend invoice');
    } finally { setResending(false); }
  };

  const handleRollback = async () => {
    if (!confirm('Reverting to Draft will delete the generated PDF and allow editing line items again. Are you sure?')) return;
    setRollingBack(true);
    try {
      await api.patch(`/invoices/${invoiceId}/rollback`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to rollback invoice');
    } finally { setRollingBack(false); }
  };

  const handleDownload = async () => {
    try {
      const resp = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      // Check if server returned an error (JSON blob)
      const contentType = String(resp.headers['content-type'] ?? '');

      if (!contentType.includes('pdf')) {
        const text = await (resp.data as Blob).text();
        const errJson = JSON.parse(text);
        throw new Error(errJson.message ?? 'PDF generation failed');
      }
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `${invoice?.invoiceNumber ?? invoiceId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`PDF Error: ${err?.message ?? 'Failed to generate PDF. Check API logs.'}`);
    }
  };

  if (isLoading) return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-12 text-slate-400">Loading invoice…</div>
    </div>
  );

  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Pending Manual Payment Alert */}
        {hasPendingManual && (
          <div className="m-5 mb-0 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-600 shrink-0" />
              <span><strong>Manual Payment Pending:</strong> A client payment proof is awaiting admin review.</span>
            </div>
            {onReviewManual && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReviewManual();
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shrink-0 ml-2 cursor-pointer transition-colors"
              >
                Review
              </button>
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-indigo-700 text-lg">{invoice.invoiceNumber}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[invoice.status]?.cls ?? 'bg-slate-100 text-slate-600'}`}>
                {STATUS_CONFIG[invoice.status]?.label ?? invoice.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{invoice.client?.name}</p>
          </div>
          <div className="flex gap-2">
            {invoice.status === 'draft' && (
              <button onClick={handleSend} disabled={sending || resending || rollingBack}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                <Send size={14} /> {sending ? 'Sending…' : 'Send'}
              </button>
            )}
            {invoice.status !== 'draft' && (
              <button onClick={handleResend} disabled={sending || resending || rollingBack}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 font-semibold bg-white">
                <Send size={14} /> {resending ? 'Sending...' : 'Resend'}
              </button>
            )}
            {['sent', 'overdue'].includes(invoice.status) && Number(invoice.amountPaid || 0) === 0 && (!invoice.payments || invoice.payments.length === 0) && (
              <button onClick={handleRollback} disabled={sending || resending || rollingBack}
                className="flex items-center gap-1.5 px-3 py-2 border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 font-semibold bg-white cursor-pointer">
                <RotateCcw size={14} /> {rollingBack ? 'Reverting...' : 'Revert to Draft'}
              </button>
            )}
            {['sent', 'overdue', 'partial_paid'].includes(invoice.status) && (
              <button onClick={() => setShowPayment(true)} disabled={sending || resending || rollingBack}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                <CreditCard size={14} /> Record Payment
              </button>
            )}
            <button onClick={handleDownload} disabled={sending || resending || rollingBack}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              <Download size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-3 gap-4 p-5 border-b border-slate-50">
          <div><div className="text-xs text-slate-400">Issue Date</div><div className="text-sm font-medium text-slate-900 mt-0.5">{fmtDate(invoice.issueDate)}</div></div>
          <div><div className="text-xs text-slate-400">Due Date</div><div className={`text-sm font-medium mt-0.5 ${invoice.isOverdue ? 'text-red-600 font-bold' : 'text-slate-900'}`}>{fmtDate(invoice.dueDate)}</div></div>
          {invoice.quote && <div><div className="text-xs text-slate-400">From Quote</div><div className="text-sm font-medium text-indigo-700 mt-0.5">{invoice.quote.quoteNumber}</div></div>}
        </div>

        {/* Line Items */}
        <div className="p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Line Items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left pb-2 text-xs text-slate-500 font-medium">Description</th>
                <th className="text-right pb-2 text-xs text-slate-500 font-medium">Qty</th>
                <th className="text-right pb-2 text-xs text-slate-500 font-medium">Unit Price</th>
                <th className="text-right pb-2 text-xs text-slate-500 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lineItems ?? []).map((item: any) => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-800">{item.description}</td>
                  <td className="py-2 text-right text-slate-600">{item.quantity} {item.unit}</td>
                  <td className="py-2 text-right text-slate-600">{fmt(item.unitPrice)}</td>
                  <td className="py-2 text-right font-medium text-slate-900">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-5 border-t border-slate-100 bg-slate-50">
          <div className="flex justify-end">
            <div className="w-56 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{fmt(invoice.subTotal)}</span></div>
              {Number(invoice.discountAmount) > 0 && <div className="flex justify-between text-sm text-red-600"><span>Discount</span><span>−{fmt(invoice.discountAmount)}</span></div>}
              <div className="flex justify-between text-sm text-slate-600"><span>GST @ {invoice.gstRate}%</span><span>{fmt(invoice.gstAmount)}</span></div>
              <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-200 pt-2 mt-2"><span>Grand Total</span><span>{fmt(invoice.grandTotal)}</span></div>
              <div className="flex justify-between text-sm text-green-700"><span>Amount Paid</span><span>{fmt(invoice.amountPaid)}</span></div>
              <div className={`flex justify-between text-sm font-bold ${Number(invoice.balanceDue) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                <span>Balance Due</span><span>{fmt(invoice.balanceDue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payments */}
        {(invoice.payments ?? []).length > 0 && (
          <div className="p-5 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Payment History</h3>
            {invoice.payments.map((p: any) => (
              <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-900">{fmt(p.amount)}</div>
                  <div className="text-xs text-slate-400">{p.method?.replace('_', ' ')} · {fmtDate(p.paidAt)}</div>
                  {p.transactionId && <div className="text-xs text-slate-400 font-mono">{p.transactionId}</div>}
                </div>
                <CheckCircle size={16} className="text-green-500" />
              </div>
            ))}
          </div>
        )}
      </div>

      {showPayment && invoice && <PaymentModal invoice={invoice} onClose={() => setShowPayment(false)} />}
    </div>
  );
}

function CreateInvoiceModal({ onClose }: { onClose: () => void }) {
  const createInvoice = useCreateInvoice();
  const { data: clientsData } = useAllClients();
  const clients = clientsData ?? [];

  const [clientId, setClientId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [gstRate, setGstRate] = useState(18);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ description: string; quantity: number; unitPrice: number; unit: string }>>([
    { description: '', quantity: 1, unitPrice: 0, unit: 'Project' }
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch client assets
  const { data: assetsData } = useAssets(clientId ? { clientId, limit: 100 } : { clientId: 'NONE' });
  const assets = assetsData?.assets ?? [];

  const addItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, unit: 'Project' }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const subTotal = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
  const gstAmount = Math.round(subTotal * (gstRate / 100) * 100) / 100;
  const grandTotal = Math.max(0, subTotal + gstAmount - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      alert('Please select a client');
      return;
    }
    if (items.some(item => !item.description.trim())) {
      alert('All items must have a description');
      return;
    }
    setSubmitting(true);
    try {
      await createInvoice.mutateAsync({
        clientId,
        assetId: assetId || undefined,
        gstRate,
        discountAmount: Number(discountAmount),
        notes,
        items: items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        }))
      });
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create Direct Invoice</h2>
            <p className="text-sm text-slate-500 mt-1">Generate a manual bill from scratch without a quote.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Client & GST Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client *</label>
              <select required value={clientId} onChange={e => {
                setClientId(e.target.value);
                setAssetId('');
              }}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a client...</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Linked Asset (Renewal)</label>
              <select value={assetId} onChange={e => {
                const val = e.target.value;
                setAssetId(val);
                if (val) {
                  const matchedAsset = assets.find((a: any) => a.id === val);
                  if (matchedAsset) {
                    setItems([
                      {
                        description: `${matchedAsset.name} Renewal / Support`,
                        quantity: 1,
                        unitPrice: matchedAsset.cost || 0,
                        unit: matchedAsset.billingCycle || 'Year'
                      }
                    ]);
                  }
                }
              }}
                disabled={!clientId}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">None (General Invoice)</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">GST Rate (%)</label>
              <input required type="number" min="0" max="100"
                value={gstRate} onChange={e => setGstRate(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Line Items</h3>
              <button type="button" onClick={addItem}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                <Plus size={12} /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex-1">
                    <input required type="text" placeholder="Description (e.g. Server hosting, domain renewal)"
                      value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="w-20">
                    <input required type="number" min="1" placeholder="Qty"
                      value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="w-24">
                    <input required type="number" min="0" step="0.01" placeholder="Price"
                      value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="w-20">
                    <input required type="text" placeholder="Unit"
                      value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md mt-0.5">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Discount & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Payment terms, bank details, or generic notes..."
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Discount (₹)</label>
                <input type="number" min="0" max={subTotal + gstAmount}
                  value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Total calculations */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between"><span>Subtotal:</span><span className="font-semibold text-slate-900">₹{subTotal.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span>GST ({gstRate}%):</span><span className="font-semibold text-slate-900">₹{gstAmount.toLocaleString('en-IN')}</span></div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-red-600"><span>Discount:</span><span>-₹{discountAmount.toLocaleString('en-IN')}</span></div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
                  <span>Grand Total:</span><span>₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {submitting ? 'Generating Invoice…' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [params, setParams] = useState({ page: 1, limit: 20, status: '', search: '' });
  const { data, isLoading } = useInvoices(params);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sendingReminders, setSendingReminders] = useState(false);
  const sendOverdueReminders = useSendOverdueReminders();
  const deleteInvoiceMutation = useDeleteInvoice();
  const { data: overdueInvoices } = useOverdueInvoices();

  // Manual payment review state
  const [activeTab, setActiveTab] = useState<'invoices' | 'manual-payments'>('invoices');
  const [manualStatusFilter, setManualStatusFilter] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [reviewingSub, setReviewingSub] = useState<any | null>(null);
  const { data: manualData, isLoading: isLoadingManual } = useManualPayments({ status: manualStatusFilter });
  const approveManualMutation = useApproveManualPayment();
  const rejectManualMutation = useRejectManualPayment();
  const [rejectingSub, setRejectingSub] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const manualSubmissions = manualData?.data ?? [];
  const pendingManualCount = manualSubmissions.filter((s: any) => s.status === 'PENDING').length;
  const pendingInvoiceIds = new Set(
    manualSubmissions
      .filter((s: any) => s.status === 'PENDING')
      .map((s: any) => s.invoice?.id || s.invoiceId)
  );

  const filteredSubmissions = manualSubmissions.filter((sub: any) => {
    if (!manualSearch.trim()) return true;
    const q = manualSearch.toLowerCase();
    return (
      (sub.client?.name && sub.client.name.toLowerCase().includes(q)) ||
      (sub.client?.email && sub.client.email.toLowerCase().includes(q)) ||
      (sub.invoice?.invoiceNumber && sub.invoice.invoiceNumber.toLowerCase().includes(q)) ||
      (sub.utrNumber && sub.utrNumber.toLowerCase().includes(q)) ||
      (sub.paymentMethod && sub.paymentMethod.toLowerCase().includes(q))
    );
  });

  const handleApproveManual = async (sub: any) => {
    if (!confirm(`Are you sure you want to approve this manual payment of ₹${Number(sub.amount).toLocaleString('en-IN')} (UTR: ${sub.utrNumber})? This will immediately record the payment in accounting.`)) return;
    try {
      await approveManualMutation.mutateAsync(sub.id);
      alert('Manual payment approved successfully.');
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to approve payment');
    }
  };

  const handleRejectManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }
    try {
      await rejectManualMutation.mutateAsync({ id: rejectingSub.id, rejectionReason: rejectReason.trim() });
      setRejectingSub(null);
      setRejectReason('');
      alert('Payment submission rejected.');
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to reject payment');
    }
  };

  const handleViewProof = async (subId: string) => {
    try {
      const res = await api.get(`/billing/manual-payments/${subId}/proof`, { responseType: 'blob' });
      const contentType = (res.headers['content-type'] as string) || 'application/octet-stream';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
      window.open(url, '_blank');
    } catch (err: any) {
      alert('Failed to load proof document.');
    }
  };

  const handleDeleteInvoice = async (id: string, number: string) => {
    if (!confirm(`Are you sure you want to delete invoice ${number}?`)) return;
    try {
      await deleteInvoiceMutation.mutateAsync(id);
      alert('Invoice deleted successfully.');
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to delete invoice');
    }
  };

  const invoices = data?.invoices ?? [];
  const overdueCountGlobal = overdueInvoices?.length ?? 0;

  // Computed stats
  const totalRevenue = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.grandTotal ?? 0), 0);
  const outstanding = invoices.filter((i: any) => ['sent', 'partial_paid'].includes(i.status)).reduce((s: number, i: any) => s + Number(i.balanceDue ?? 0), 0);
  const overdueCount = invoices.filter((i: any) => i.status === 'overdue').length;
  const overdueAmount = invoices.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + Number(i.balanceDue ?? 0), 0);

  const handleSendOverdueReminders = async () => {
    if (!confirm(`Are you sure you want to send email reminders to all clients with overdue invoices? (Total: ${overdueCountGlobal})`)) return;
    setSendingReminders(true);
    try {
      const res = await sendOverdueReminders.mutateAsync();
      alert(`Successfully queued/sent reminders for ${res.count ?? overdueCountGlobal} overdue invoices.`);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to send overdue reminders');
    } finally {
      setSendingReminders(false);
    }
  };

  const invoiceTrend = dayBuckets(invoices, (i: any) => new Date(i.issueDate || i.createdAt).getTime()).map((b) => ({
    label: b.label,
    values: {
      paid: b.items.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.grandTotal ?? 0), 0),
      open: b.items.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled').reduce((s: number, i: any) => s + Number(i.grandTotal ?? 0), 0),
    },
  }));
  const statusCounts = invoices.reduce((acc: Record<string, number>, i: any) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc; }, {});
  const STATUS_COLOR: Record<string, string> = { paid: '#10b981', sent: '#3b82f6', overdue: '#ef4444', partial_paid: '#8b5cf6', draft: '#94a3b8', cancelled: '#cbd5e1' };

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={Receipt}
          title="Billing & Invoices"
          subtitle="Manage invoices, record payments, and track revenue"
          actions={<>
            <Button onClick={handleSendOverdueReminders} disabled={sendingReminders || overdueCountGlobal === 0}>
              <Send size={15} /> {sendingReminders ? 'Sending...' : `Remind all overdue (${overdueCountGlobal})`}
            </Button>
            <a href="/sales"><Button><FileText size={15} /> Create from quote</Button></a>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}><Plus size={15} /> Create direct invoice</Button>
          </>}
        />

        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { key: 'invoices', label: 'All invoices', icon: Receipt, count: data?.total ?? invoices.length },
            { key: 'manual-payments', label: 'Manual payments verification', icon: ShieldCheck, count: pendingManualCount },
          ]}
        />

        {activeTab === 'invoices' ? (
          <>
            {/* Stats (from the invoices loaded on this page) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <KpiCard tone="ok" icon={CheckCircle} value={fmt(totalRevenue)} label="Revenue (paid)" series={invoiceTrend.map((b) => b.values.paid)} />
              <KpiCard tone="info" icon={Clock} value={fmt(outstanding)} label="Outstanding" delta={{ text: 'sent and part-paid' }} series={invoiceTrend.map((b) => b.values.open)} />
              <KpiCard tone="critical" icon={AlertCircle} value={fmt(overdueAmount)} label="Overdue" delta={overdueCount > 0 ? { text: `${overdueCount} invoice${overdueCount > 1 ? 's' : ''}` } : null} onClick={() => { setStatusFilter('overdue'); setParams(p => ({ ...p, status: 'overdue' })); }} />
              <KpiCard tone="neutral" icon={Receipt} value={data?.total ?? invoices.length} label="Total invoices" />
            </div>

            {invoices.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard title="Invoiced value (14 days)" className="lg:col-span-2">
                  <StackedBars buckets={invoiceTrend} labelEvery={3} series={[{ key: 'paid', label: 'Paid (₹)', color: '#10b981' }, { key: 'open', label: 'Not yet paid (₹)', color: '#3b82f6' }]} />
                </ChartCard>
                <ChartCard title="Invoices by status">
                  <Donut centerLabel="Invoices" segments={Object.entries(statusCounts).map(([k, v]) => ({ label: STATUS_CONFIG[k]?.label ?? k, value: v as number, color: STATUS_COLOR[k] || '#94a3b8' }))} />
                </ChartCard>
              </div>
            )}

            {/* Invoice Table */}
            <TableCard title="Invoices" icon={Receipt} count={data?.total ?? invoices.length} toolbar={<>
              <SearchInput className="flex-1 md:w-72" placeholder="Search invoice number or client…" value={search}
                onChange={v => { setSearch(v); setParams(p => ({ ...p, search: v })); }} />
              <select value={statusFilter} className={selectClass}
                onChange={e => { setStatusFilter(e.target.value); setParams(p => ({ ...p, status: e.target.value })); }}>
                <option value="">All status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </>}>
              <table className="w-full">
                <thead className="border-b border-slate-100">
                  <tr>
                    <th className={`${th} text-left`}>Invoice #</th>
                    <th className={`${th} text-left`}>Client</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={`${th} text-right`}>Paid / Due</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-center`}>Due Date</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading invoices…</td></tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16">
                        <Receipt size={40} className="mx-auto mb-3 text-slate-200" />
                        <p className="text-slate-400 font-medium">No invoices yet</p>
                        <p className="text-slate-300 text-sm">Convert an accepted quotation to an invoice from the Quotations page</p>
                      </td>
                    </tr>
                  ) : invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <button onClick={() => setSelectedInvoiceId(inv.id)}
                          className="font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                          {inv.invoiceNumber}
                        </button>
                        <div className="text-xs text-slate-400 mt-0.5">{fmtDate(inv.issueDate)}</div>
                        {pendingInvoiceIds.has(inv.id) && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock size={10} />
                              Manual Payment Pending
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-800">{inv.client?.name ?? '—'}</div>
                        <div className="text-xs text-slate-400">{inv.client?.email ?? ''}</div>
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-slate-800">{fmt(inv.grandTotal)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="text-sm text-green-700 font-medium">{fmt(inv.amountPaid)}</div>
                        {Number(inv.balanceDue) > 0 && <div className="text-xs text-slate-400">Due: {fmt(inv.balanceDue)}</div>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Badge tone={statusTone(inv.status)}>{STATUS_CONFIG[inv.status]?.label ?? inv.status}</Badge>
                      </td>
                      <td className="px-5 py-4 text-center text-sm">
                        <span className={inv.isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'}>
                          {fmtDate(inv.dueDate)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setSelectedInvoiceId(inv.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View">
                            <Eye size={14} />
                          </button>
                          {['sent', 'overdue', 'partial_paid'].includes(inv.status) && (
                            <button onClick={() => setSelectedInvoiceId(inv.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                              <CreditCard size={12} /> Pay
                            </button>
                          )}
                          {['draft', 'cancelled'].includes(inv.status) && (
                            <button onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                              disabled={deleteInvoiceMutation.isPending}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </>
        ) : (
          /* MANUAL PAYMENTS SUBMISSIONS TAB */
          <div>
            <TableCard title="Payment proofs from clients" icon={ShieldCheck} count={filteredSubmissions.length} toolbar={<>
              <SearchInput className="flex-1 md:w-72" placeholder="Search by client, invoice, UTR, or method..." value={manualSearch} onChange={setManualSearch} />
              <select value={manualStatusFilter} onChange={e => setManualStatusFilter(e.target.value)} className={selectClass}>
                <option value="">All statuses</option>
                <option value="PENDING">Pending verification</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </>}>
              <table className="w-full">
                <thead className="border-b border-slate-100">
                  <tr>
                    <th className={`${th} text-left`}>Submitted</th>
                    <th className={`${th} text-left`}>Invoice</th>
                    <th className={`${th} text-left`}>Client</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={`${th} text-left`}>Method / UTR</th>
                    <th className={`${th} text-center`}>Proof</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingManual ? (
                    <tr><td colSpan={8} className="text-center py-12 text-slate-400">Loading payment submissions…</td></tr>
                  ) : filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-slate-400">
                        <ShieldCheck size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-medium">No manual payment submissions found</p>
                      </td>
                    </tr>
                  ) : filteredSubmissions.map((sub: any) => (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors text-xs">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{fmtDate(sub.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">Paid: {fmtDate(sub.paymentDate)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedInvoiceId(sub.invoice?.id)}
                          className="font-mono font-bold text-indigo-600 hover:underline"
                        >
                          {sub.invoice?.invoiceNumber || '—'}
                        </button>
                        <div className="text-[10px] text-slate-400">Due: {fmt(sub.invoice?.balanceDue)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">{sub.client?.name || '—'}</div>
                        <div className="text-[10px] text-slate-400">{sub.client?.email || ''}</div>
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-sm text-slate-900">
                        {fmt(sub.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-700">{sub.paymentMethod}</div>
                        <div className="font-mono text-[10px] text-slate-500">UTR: {sub.utrNumber}</div>
                        {sub.notes && <div className="text-[10px] text-slate-400 italic">"{sub.notes}"</div>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => handleViewProof(sub.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <ExternalLink size={12} /> View Proof
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          sub.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : sub.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {sub.status === 'PENDING' && <Clock size={10} />}
                          {sub.status === 'APPROVED' && <CheckCircle size={10} />}
                          {sub.status === 'REJECTED' && <AlertCircle size={10} />}
                          {sub.status}
                        </span>
                        {sub.rejectionReason && (
                          <div className="text-[10px] text-red-600 mt-1 max-w-[150px] truncate" title={sub.rejectionReason}>
                            {sub.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setReviewingSub(sub)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                            title="Review Submission Details"
                          >
                            <Eye size={12} /> Review
                          </button>
                          {sub.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveManual(sub)}
                                disabled={approveManualMutation.isPending}
                                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Approve & Record in Ledger"
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                onClick={() => { setRejectingSub(sub); setRejectReason(''); }}
                                disabled={rejectManualMutation.isPending}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Reject"
                              >
                                <X size={12} /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
        )}
      </div>

      {/* Review Submission Modal */}
      {reviewingSub && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setReviewingSub(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ShieldCheck size={18} className="text-indigo-600" /> Manual Payment Verification
                </h3>
                <span className="text-xs text-slate-400">
                  Submitted on {fmtDate(reviewingSub.createdAt)}
                </span>
              </div>
              <button onClick={() => setReviewingSub(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Invoice & Client Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Client</span>
                <span className="font-bold text-slate-800">{reviewingSub.client?.name || '—'}</span>
                <span className="text-[10px] text-slate-400 block">{reviewingSub.client?.email || ''}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Invoice</span>
                <span className="font-mono font-bold text-indigo-700">{reviewingSub.invoice?.invoiceNumber || '—'}</span>
                <span className="text-[10px] text-slate-500 block">
                  Balance Due: <strong className="text-slate-800">{fmt(reviewingSub.invoice?.balanceDue)}</strong>
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Invoice Value</span>
                <span className="font-semibold text-slate-700">{fmt(reviewingSub.invoice?.grandTotal)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Current Amount Paid</span>
                <span className="font-semibold text-slate-700">{fmt(reviewingSub.invoice?.amountPaid)}</span>
              </div>
            </div>

            {/* Payment Claim Details */}
            <div className="p-4 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Claimed Amount:</span>
                <span className="text-base font-extrabold text-slate-900">{fmt(reviewingSub.amount)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-bold text-slate-800">{reviewingSub.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">UTR / Reference:</span>
                <span className="font-mono font-bold text-slate-800">{reviewingSub.utrNumber}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Payment Date:</span>
                <span className="font-medium text-slate-800">{fmtDate(reviewingSub.paymentDate)}</span>
              </div>
              {reviewingSub.notes && (
                <div className="py-1 text-slate-600 bg-slate-50 p-2 rounded-lg italic">
                  Note: "{reviewingSub.notes}"
                </div>
              )}
              {reviewingSub.rejectionReason && (
                <div className="py-1 text-red-700 bg-red-50 p-2 rounded-lg">
                  Rejection Reason: {reviewingSub.rejectionReason}
                </div>
              )}
            </div>

            {/* Proof Document Action */}
            <div className="flex items-center justify-between p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <div className="text-xs">
                <span className="font-bold text-indigo-950 block">Payment Proof Document</span>
                <span className="text-slate-500 text-[11px]">Private authenticated proof attachment</span>
              </div>
              <button
                type="button"
                onClick={() => handleViewProof(reviewingSub.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <ExternalLink size={13} /> View Proof
              </button>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReviewingSub(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              {reviewingSub.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const s = reviewingSub;
                      setReviewingSub(null);
                      setRejectingSub(s);
                      setRejectReason('');
                    }}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <X size={14} /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const s = reviewingSub;
                      setReviewingSub(null);
                      await handleApproveManual(s);
                    }}
                    disabled={approveManualMutation.isPending}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} /> {approveManualMutation.isPending ? 'Approving…' : 'Approve & Record'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingSub && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Reject Manual Payment</h3>
              <button onClick={() => setRejectingSub(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Provide a clear reason for rejecting submission <span className="font-mono font-bold text-slate-700">{rejectingSub.utrNumber}</span> (₹{rejectingSub.amount}).
            </p>
            <form onSubmit={handleRejectManual} className="space-y-3">
              <textarea
                required
                rows={3}
                placeholder="e.g. UTR not found in company bank account or invalid receipt..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingSub(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectManualMutation.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {rejectManualMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedInvoiceId && (
        <InvoiceDetailPanel
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          hasPendingManual={pendingInvoiceIds.has(selectedInvoiceId)}
          onReviewManual={() => setActiveTab('manual-payments')}
        />
      )}

      {showCreateModal && (
        <CreateInvoiceModal onClose={() => setShowCreateModal(false)} />
      )}
    </PageShell>
  );
}
