'use client';

import { useState } from 'react';
import {
  useAmcContracts, useAmcRenewalsDue, useAllClients, useCreate, useUpdate,
  useAmcWeeklyReports, useGenerateAmcWeeklyReport, useQuotes, useCreateInvoiceFromAmc,
  useDelete, useAssets
} from '../../src/hooks/queries';
import { api } from '../../src/lib/api';
import {
  Plus, Loader2, AlertTriangle, Clock, FileText,
  Download, ChevronRight, RefreshCw, BarChart3, X, Trash2, ShieldCheck, IndianRupee,
  Eye, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { Modal, FormField, inputCls, selectCls, textareaCls } from '../components/Modal';
import { PageShell, PageHeader, Button, SearchInput, selectClass } from '../../src/components/ui/page';
import { KpiCard } from '../../src/components/ui/charts';
import { useAuthStore } from '../../src/store/auth';

const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmt = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function WeeklyReportsPanel({ contract, onClose }: { contract: any; onClose: () => void }) {
  const { data: reports, isLoading } = useAmcWeeklyReports(contract.id);
  const generateMutation = useGenerateAmcWeeklyReport();
  const [generating, setGenerating] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [forceRegenerate, setForceRegenerate] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateMutation.mutateAsync({ contractId: contract.id });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to generate report');
    } finally { setGenerating(false); }
  };

  const handleGenerateCustom = async () => {
    if (!startDate || !endDate) {
      alert('Please specify both start and end dates.');
      return;
    }
    setGenerating(true);
    try {
      await generateMutation.mutateAsync({
        contractId: contract.id,
        periodStart: startDate,
        periodEnd: endDate,
        forceRegenerate,
      });
      alert('Report generated successfully!');
      setStartDate('');
      setEndDate('');
      setForceRegenerate(false);
      setShowCustom(false);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to generate custom report');
    } finally { setGenerating(false); }
  };

  const handleRegenerateReport = async (pStart: string, pEnd: string) => {
    if (!confirm('Are you sure you want to recalculate and regenerate this report? This will refresh all ticket and hour metrics.')) {
      return;
    }
    setGenerating(true);
    try {
      await generateMutation.mutateAsync({
        contractId: contract.id,
        periodStart: pStart,
        periodEnd: pEnd,
        forceRegenerate: true,
      });
      alert('Report regenerated successfully!');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to regenerate report');
    } finally { setGenerating(false); }
  };

  const handleDownloadPdf = async (reportId: string, reportNumber: string) => {
    try {
      const resp = await api.get(`/amc-contracts/weekly-reports/${reportId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `${reportNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('PDF generation failed'); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Weekly Reports</h2>
            <p className="text-sm text-slate-500">{contract.contractNumber} · {contract.client?.name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCustom(!showCustom)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                showCustom ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Custom / Refresh
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {generating ? 'Generating…' : 'Generate This Week'}
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Custom Period Form */}
        {showCustom && (
          <div className="p-4 bg-slate-50 border-b border-slate-150 space-y-3">
            <div className="font-semibold text-xs uppercase text-slate-500 tracking-wider">Custom Period & Regeneration</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  checked={forceRegenerate}
                  onChange={e => setForceRegenerate(e.target.checked)}
                />
                <span>Force regenerate/overwrite if report exists</span>
              </label>
              <button
                onClick={handleGenerateCustom}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Generate Report
              </button>
            </div>
          </div>
        )}

        {/* Hours summary */}
        <div className="grid grid-cols-3 gap-4 p-4 border-b border-slate-50 bg-slate-50">
          <div className="text-center">
            <div className="text-xl font-bold text-slate-900">{contract.totalHours}h</div>
            <div className="text-xs text-slate-500">Total Hours</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-indigo-700">{contract.usedHours?.toFixed(1) ?? 0}h</div>
            <div className="text-xs text-slate-500">Used</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-700">{(contract.totalHours - (contract.usedHours ?? 0)).toFixed(1)}h</div>
            <div className="text-xs text-slate-500">Remaining</div>
          </div>
        </div>
        <div className="px-4 pb-3 border-b border-slate-50">
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full transition-all ${
                contract.usedHours / contract.totalHours >= 0.9 ? 'bg-red-500' :
                contract.usedHours / contract.totalHours >= 0.8 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min((contract.usedHours / contract.totalHours) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Reports list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /> Loading reports…</div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p className="font-medium">No reports yet</p>
              <p className="text-sm">Click "Generate This Week" to auto-create from logged hours & tickets</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-100">
                  <Link href={`/amc/reports/${r.id}`} className="group flex-1 cursor-pointer pr-3">
                    <div className="font-mono font-bold text-indigo-600 text-sm group-hover:underline flex items-center gap-1.5">
                      <span>{r.reportNumber}</span>
                      <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600" />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {fmtDate(r.periodStart)} — {fmtDate(r.periodEnd)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{r.hoursLogged}h logged</span>
                      <span>{r.ticketsResolved} resolved</span>
                      <span>{r.bugsFixed} bugs fixed</span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-xs text-slate-400 mr-2 hidden sm:block">
                      <div>By: {r.compiledBy?.firstName} {r.compiledBy?.lastName}</div>
                      <div>{fmtDate(r.createdAt)}</div>
                    </div>
                    <Link
                      href={`/amc/reports/${r.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Eye size={12} /> View
                    </Link>
                    <button
                      onClick={() => handleDownloadPdf(r.id, r.reportNumber)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors shadow-2xs"
                    >
                      <Download size={12} /> PDF
                    </button>
                    <button
                      onClick={() => handleRegenerateReport(r.periodStart, r.periodEnd)}
                      disabled={generating}
                      title="Recalculate and update this report"
                      className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AmcPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [showRequestChangeModal, setShowRequestChangeModal] = useState(false);
  const [selectedContractForRequestChange, setSelectedContractForRequestChange] = useState<any>(null);
  const [changeRequestText, setChangeRequestText] = useState('');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role?.toUpperCase() === 'SUPER_ADMIN';
  const [form, setForm] = useState({
    contractNumber: '', clientId: '', startDate: '', endDate: '',
    totalHours: '', hourlyRate: '', terms: '', autoRenew: 'false',
    status: 'ACTIVE', discount: '0', billingCycle: 'MONTHLY',
    quoteId: '', assetIds: [] as string[],
  });
  const [err, setErr] = useState('');

  const { data, isLoading, isError } = useAmcContracts({ search: search || undefined, status: status || undefined });
  const { data: renewalsDue } = useAmcRenewalsDue();
  const { data: clients } = useAllClients();
  const create = useCreate('amc-contracts', 'amc-contracts');
  const update = useUpdate('amc-contracts', 'amc-contracts');
  const deleteMutation = useDelete('amc-contracts', 'amc-contracts');
  const createInvoiceFromAmc = useCreateInvoiceFromAmc();

  const handleDeleteClick = async (id: string, contractNumber: string) => {
    if (!confirm(`Are you sure you want to delete contract ${contractNumber}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
      alert('Contract deleted successfully.');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to delete contract.');
    }
  };

  const { data: quotesData } = useQuotes(form.clientId ? { clientId: form.clientId } : undefined);
  const clientQuotes = quotesData?.quotes || [];
  const { data: clientAssetsData } = useAssets(form.clientId ? { clientId: form.clientId, limit: 100 } : undefined);
  const clientAssets = form.clientId ? (clientAssetsData?.assets || []) : [];
  const filteredQuotes = clientQuotes.filter((q: any) => {
    const isLinkedToOther = (q.amcContract && q.amcContract.id !== editingContract?.id) || q.asset;
    return !isLinkedToOther;
  });

  const handleGenerateInvoice = async (contractId: string) => {
    if (isGeneratingInvoice) return;
    if (!confirm('Are you sure you want to generate the next cycle invoice for this contract manually?')) return;
    try {
      setIsGeneratingInvoice(true);
      await createInvoiceFromAmc.mutateAsync(contractId);
      alert('Invoice generated successfully!');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to generate invoice.');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const contracts = data?.contracts || [];
  const dueCount = Array.isArray(renewalsDue) ? renewalsDue.length : 0;
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Stats
  const totalActive = contracts.filter((c: any) => c.status === 'ACTIVE').length;
  const totalValue = contracts.reduce((s: number, c: any) => s + (c.monthlyValue ?? 0), 0);
  const totalHoursUsed = contracts.reduce((s: number, c: any) => s + (c.usedHours ?? 0), 0);

  const handleEditClick = (c: any) => {
    setEditingContract(c);
    setForm({
      contractNumber: c.contractNumber,
      clientId: c.clientId,
      startDate: c.startDate ? new Date(c.startDate).toISOString().split('T')[0] : '',
      endDate: c.endDate ? new Date(c.endDate).toISOString().split('T')[0] : '',
      totalHours: String(c.totalHours),
      hourlyRate: String(c.hourlyRate),
      terms: c.terms || '',
      autoRenew: String(c.autoRenew),
      status: c.status || 'ACTIVE',
      discount: String(c.discount ?? 0),
      billingCycle: c.billingCycle || 'MONTHLY',
      quoteId: c.quoteId || '',
      assetIds: (c.assets || []).map((a: any) => a.id),
    });
    setErr('');
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContract && !form.contractNumber.trim()) { setErr('Contract number is required.'); return; }
    if (!form.clientId) { setErr('Please select a client.'); return; }
    if (!form.startDate || !form.endDate) { setErr('Start and end dates are required.'); return; }
    if (!form.totalHours || !form.hourlyRate) { setErr('Hours and rate are required.'); return; }
    setErr('');
    try {
      const payload = {
        contractNumber: editingContract ? form.contractNumber.trim() : 'Auto-Generated',
        clientId: form.clientId,
        startDate: form.startDate,
        endDate: form.endDate,
        totalHours: Number(form.totalHours),
        hourlyRate: Number(form.hourlyRate),
        terms: form.terms || undefined,
        autoRenew: form.autoRenew === 'true',
        status: form.status as any,
        discount: Number(form.discount || 0),
        billingCycle: form.billingCycle,
        quoteId: form.quoteId || undefined,
        assetIds: form.assetIds,
      };
      if (editingContract) {
        await update.mutateAsync({ id: editingContract.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      setOpen(false);
      setForm({ contractNumber: '', clientId: '', startDate: '', endDate: '', totalHours: '', hourlyRate: '', terms: '', autoRenew: 'false', status: 'ACTIVE', discount: '0', billingCycle: 'MONTHLY', quoteId: '', assetIds: [] });
      setEditingContract(null);
    } catch (e: any) { setErr(e.response?.data?.message || 'Failed to save contract.'); }
  };

  const getUsageColor = (used: number, total: number) => {
    const p = (used / total) * 100;
    return p >= 90 ? 'bg-red-500' : p >= 80 ? 'bg-amber-500' : 'bg-green-500';
  };
  const getStatusColor = (s: string) => ({
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-slate-100 text-slate-600',
  }[s] || 'bg-slate-100 text-slate-600');

  const openNew = () => {
    setEditingContract(null);
    setForm({ contractNumber: '', clientId: '', startDate: '', endDate: '', totalHours: '', hourlyRate: '', terms: '', autoRenew: 'false', status: 'ACTIVE', discount: '0', billingCycle: 'MONTHLY', quoteId: '', assetIds: [] });
    setErr('');
    setOpen(true);
  };
  const hoursTotal = contracts.reduce((s: number, c: any) => s + Number(c.totalHours || 0), 0);

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={ShieldCheck}
          title="AMC contracts"
          subtitle="Maintenance contracts with hour tracking, weekly reports and billing."
          actions={<Button variant="primary" onClick={openNew}><Plus className="w-4 h-4" /> New contract</Button>}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Active contracts" value={totalActive} icon={ShieldCheck} tone="ok" />
          <KpiCard label="Monthly value" value={fmt(totalValue)} icon={IndianRupee} tone="info" />
          <KpiCard label="Hours used" value={`${totalHoursUsed.toFixed(0)}h`} icon={Clock} tone="violet" delta={hoursTotal ? { text: `of ${hoursTotal.toFixed(0)}h (${Math.round((totalHoursUsed / hoursTotal) * 100)}%)` } : null} />
          <KpiCard label="Ending in 30 days" value={dueCount} icon={AlertTriangle} tone={dueCount > 0 ? 'warning' : 'neutral'} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <SearchInput className="flex-1" placeholder="Search contracts…" value={search} onChange={setSearch} />
          <select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['ACTIVE', 'EXPIRED', 'CANCELLED'].map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
        </div>

        {/* Contract Cards */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
        ) : isError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">Failed to load AMC contracts.</div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-white border border-slate-200 rounded-xl">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No AMC contracts found.</p>
            <p className="text-sm">Create your first maintenance contract.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {contracts.map((c: any) => {
              const usedPct = c.totalHours > 0 ? (c.usedHours / c.totalHours) * 100 : 0;
              const daysLeft = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000);
              return (
                <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/amc/${c.id}`}
                        className="font-bold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1 group"
                      >
                        <span>{c.contractNumber}</span>
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600" />
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{c.client?.name || '—'}</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{c.billingCycle || 'MONTHLY'}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(c.status)}`}>{c.status}</span>
                  </div>

                  {/* Hours bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Hours Used</span>
                      <span className="font-medium">{c.usedHours || 0} / {c.totalHours} hrs ({usedPct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getUsageColor(c.usedHours || 0, c.totalHours)}`}
                        style={{ width: `${Math.min(usedPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /><span>₹{c.hourlyRate}/hr</span></div>
                    <span className={daysLeft <= 30 ? 'text-amber-600 font-medium' : ''}>
                      {daysLeft > 0 ? `Expires in ${daysLeft}d` : 'Expired'} · {fmtDate(c.endDate)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-slate-50">
                    <Link
                      href={`/amc/${c.id}`}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                    >
                      <Eye size={13} /> View Contract
                    </Link>
                    <button
                      onClick={() => setSelectedContract(c)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"
                    >
                      <FileText size={13} /> Weekly Reports
                    </button>
                    {c.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleGenerateInvoice(c.id)}
                        disabled={createInvoiceFromAmc.isPending || isGeneratingInvoice}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                      >
                        Generate Invoice
                      </button>
                    )}
                    {((c.invoiceCount ?? 0) === 0 || isSuperAdmin) ? (
                      <button
                        onClick={() => {
                          if ((c.invoiceCount ?? 0) > 0) {
                            if (confirm("WARNING: This contract has already generated invoices. Editing it might cause mismatch in billing tracking. Do you want to edit anyway?")) {
                              handleEditClick(c);
                            }
                          } else {
                            handleEditClick(c);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedContractForRequestChange(c);
                          setShowRequestChangeModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"
                      >
                        Request Change
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteClick(c.id, c.contractNumber)}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                    <div className="text-xs text-slate-400 text-right ml-auto">
                      {fmt(c.monthlyValue)}/mo
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contract Modal */}
      <Modal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          setEditingContract(null);
        }}
        title={editingContract ? "Edit AMC Contract" : "New AMC Contract"}
        subtitle={editingContract ? "Modify the annual maintenance contract details." : "Create an annual maintenance contract."}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{err}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contract Number">
              <input
                className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-500`}
                disabled={true}
                placeholder="Auto-Generated"
                value={editingContract ? form.contractNumber : 'Auto-Generated'}
                readOnly
              />
            </FormField>
            <FormField label="Client" required>
              <select 
                className={selectCls} 
                value={form.clientId}
                onChange={e => {
                  setForm(f => ({ ...f, clientId: e.target.value, quoteId: '', assetIds: [] }));
                }}
              >
                <option value="">Select client</option>
                {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Linked Quotation">
            <select 
              className={selectCls} 
              value={form.quoteId} 
              onChange={e => set('quoteId', e.target.value)}
              disabled={!form.clientId}
            >
              <option value="">None (Not from quotation)</option>
              {filteredQuotes.map((q: any) => (
                <option key={q.id} value={q.id}>
                  {q.quoteNumber} - {q.title} ({q.status})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Linked Assets (optional)">
            {!form.clientId ? (
              <p className="text-xs text-slate-500">Select a client first to see their assets.</p>
            ) : clientAssets.length === 0 ? (
              <p className="text-xs text-slate-500">This client has no assets on file yet.</p>
            ) : (
              <div className="border border-slate-200 rounded-lg max-h-36 overflow-y-auto divide-y divide-slate-100">
                {clientAssets.map((a: any) => (
                  <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.assetIds.includes(a.id)}
                      onChange={(e) => {
                        setForm(f => ({
                          ...f,
                          assetIds: e.target.checked
                            ? [...f.assetIds, a.id]
                            : f.assetIds.filter((id) => id !== a.id),
                        }));
                      }}
                    />
                    <span className="text-slate-700">{a.name}</span>
                    <span className="text-slate-400 text-xs">({a.type})</span>
                  </label>
                ))}
              </div>
            )}
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Start Date" required><input type="date" className={inputCls} value={form.startDate} onChange={e => set('startDate', e.target.value)} /></FormField>
            <FormField label="End Date" required><input type="date" className={inputCls} value={form.endDate} onChange={e => set('endDate', e.target.value)} /></FormField>
            <FormField label="Billing Cycle" required>
              <select className={selectCls} value={form.billingCycle} onChange={e => set('billingCycle', e.target.value)}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="HALF_YEARLY">Half-Yearly</option>
                <option value="ANNUAL">Annual / One-Time</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Total Hours" required><input type="number" className={inputCls} placeholder="100" value={form.totalHours} onChange={e => set('totalHours', e.target.value)} /></FormField>
            <FormField label="Hourly Rate (₹)" required><input type="number" className={inputCls} placeholder="1500" value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)} /></FormField>
            <FormField label="Discount (₹)"><input type="number" className={inputCls} placeholder="0" value={form.discount} onChange={e => set('discount', e.target.value)} /></FormField>
          </div>
          <FormField label="Terms & Conditions"><textarea className={textareaCls} rows={2} placeholder="Contract terms…" value={form.terms} onChange={e => set('terms', e.target.value)} /></FormField>
          
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Auto Renew">
              <select className={selectCls} value={form.autoRenew} onChange={e => set('autoRenew', e.target.value)}>
                <option value="false">No</option><option value="true">Yes</option>
              </select>
            </FormField>
            {editingContract && (
              <FormField label="Status" required>
                <select className={selectCls} value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </FormField>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditingContract(null);
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || update.isPending}
              className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg"
            >
              {editingContract ? (
                update.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Changes'
              ) : (
                create.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Create Contract'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Weekly Reports Panel */}
      {selectedContract && (
        <WeeklyReportsPanel contract={selectedContract} onClose={() => setSelectedContract(null)} />
      )}

      {/* Request Change Modal */}
      {showRequestChangeModal && selectedContractForRequestChange && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Request Change</h3>
              <button 
                onClick={() => {
                  setShowRequestChangeModal(false);
                  setChangeRequestText('');
                  setSelectedContractForRequestChange(null);
                }} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              Contract <strong>{selectedContractForRequestChange.contractNumber}</strong> has generated active invoices. Only Super Admins can edit it.
              Please describe the changes you want below:
            </p>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe what needs to be changed..."
              value={changeRequestText}
              onChange={e => setChangeRequestText(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowRequestChangeModal(false);
                  setChangeRequestText('');
                  setSelectedContractForRequestChange(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!changeRequestText.trim()) {
                    alert('Please enter change details.');
                    return;
                  }
                  alert('Your change request has been submitted to the Super Admin successfully!');
                  setShowRequestChangeModal(false);
                  setChangeRequestText('');
                  setSelectedContractForRequestChange(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
