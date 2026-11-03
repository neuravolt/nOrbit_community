'use client';
import { useState, use } from 'react';
import {
  useAmcContract,
  useAmcWeeklyReports,
  useGenerateAmcWeeklyReport,
  useInvoices,
} from '../../../src/hooks/queries';
import { FileText, Calendar, Clock, ArrowLeft, Plus, Loader2, Award, ShieldAlert, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide';

export default function AmcContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { data: contract, isLoading: loadingContract } = useAmcContract(id);
  const { data: reports = [], isLoading: loadingReports } = useAmcWeeklyReports(id);
  const generateReportMutation = useGenerateAmcWeeklyReport();
  const { data: invoicesData } = useInvoices({ amcContractId: id, limit: 50 });
  const contractInvoices = invoicesData?.invoices || [];

  // Report Generator Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [includeHours, setIncludeHours] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  if (loadingContract || !contract) {
    return <div className="p-8 text-center text-slate-400">Loading AMC contract details…</div>;
  }

  const used = Number(contract.usedHours ?? 0);
  const total = Number(contract.totalHours ?? 0);
  const remaining = Math.max(0, total - used);
  const percentUsed = total > 0 ? (used / total) * 100 : 0;
  const isHighUsage = percentUsed >= 80;

  const applyPreset = (preset: 'this_week' | 'last_week' | 'this_month') => {
    const today = new Date();
    if (preset === 'this_week') {
      const day = today.getDay();
      const diffToMon = today.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(today.getFullYear(), today.getMonth(), diffToMon);
      const sun = new Date(today.getFullYear(), today.getMonth(), diffToMon + 6);
      setPeriodStart(mon.toISOString().slice(0, 10));
      setPeriodEnd(sun.toISOString().slice(0, 10));
    } else if (preset === 'last_week') {
      const day = today.getDay();
      const diffToMon = today.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const mon = new Date(today.getFullYear(), today.getMonth(), diffToMon);
      const sun = new Date(today.getFullYear(), today.getMonth(), diffToMon + 6);
      setPeriodStart(mon.toISOString().slice(0, 10));
      setPeriodEnd(sun.toISOString().slice(0, 10));
    } else if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setPeriodStart(start.toISOString().slice(0, 10));
      setPeriodEnd(end.toISOString().slice(0, 10));
    }
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodStart || !periodEnd) {
      alert('Please select period dates.');
      return;
    }

    try {
      setReportError(null);
      await generateReportMutation.mutateAsync({
        contractId: id,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        includeHours,
      });
      setShowGenerateModal(false);
      setPeriodStart('');
      setPeriodEnd('');
      setIncludeHours(false);
    } catch (err: any) {
      console.error(err);
      setReportError(err.response?.data?.message || 'Report generation failed');
    }
  };

  const fmtCurrency = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Back Link */}
        <div className="mb-4">
          <Link href="/amc" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={16} /> Back to AMC Contracts
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b pb-6 border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-900">{contract.contractNumber}</h1>
              <span className={`text-xs px-2.5 py-0.5 font-bold rounded-full ${
                contract.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {contract.status}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1 font-mono">ID: {contract.id}</p>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-all"
          >
            <Plus size={16} /> Generate Weekly Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Client Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Client Target</span>
            <span className="text-base font-bold text-slate-800 block">{contract.client?.name}</span>
            <div className="text-xs text-slate-500 space-y-1">
              <div>Email: {contract.client?.email || '—'}</div>
              <div>Phone: {contract.client?.phone || '—'}</div>
            </div>
          </div>

          {/* Active Period */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contract Schedule</span>
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
              <Calendar size={16} className="text-indigo-500" />
              <span>{new Date(contract.startDate).toLocaleDateString()} – {new Date(contract.endDate).toLocaleDateString()}</span>
            </div>
            <div className="text-xs text-slate-400">
              Billing day: {contract.billingDay} of every month
            </div>
          </div>

          {/* Pricing Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valuation</span>
            <div className="text-base font-bold text-slate-800">
              {fmtCurrency(contract.hourlyRate)} <span className="text-xs font-normal text-slate-500">/ hour</span>
            </div>
            <div className="text-xs text-slate-400 space-y-0.5">
              <div>Monthly: {contract.monthlyValue ? fmtCurrency(Number(contract.monthlyValue)) : '—'}</div>
              <div>Annual: {contract.annualValue ? fmtCurrency(Number(contract.annualValue)) : '—'}</div>
            </div>
          </div>
        </div>

        {/* Hours Usage Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8 space-y-4">
          <div className="flex justify-between items-center text-sm font-bold text-slate-700">
            <span>Hours Consumption Utilization</span>
            <span className={isHighUsage ? 'text-amber-600' : 'text-indigo-600'}>
              {used.toFixed(1)} / {total.toFixed(1)} hrs ({percentUsed.toFixed(1)}%)
            </span>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isHighUsage ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${Math.min(100, percentUsed)}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center pt-2">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Hours</span>
              <span className="text-base font-extrabold text-slate-800 font-mono">{total}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Hours Logged</span>
              <span className="text-base font-extrabold text-slate-800 font-mono">{used.toFixed(1)}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Remaining</span>
              <span className="text-base font-extrabold text-indigo-600 font-mono">{remaining.toFixed(1)}</span>
            </div>
          </div>

          {isHighUsage && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs flex items-center gap-2">
              <ShieldAlert size={16} />
              <span>AMC consumption exceeds 80% limit threshold! Auto notification alert has been sent.</span>
            </div>
          )}
        </div>

        {/* Weekly Reports Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <FileText size={16} className="text-indigo-600" /> Compiled Weekly Reports
          </h2>

          {loadingReports ? (
            <div className="text-xs text-slate-400 py-6 text-center">Loading weekly report logs…</div>
          ) : reports.length === 0 ? (
            <div className="text-xs text-slate-400 p-8 border border-dashed border-slate-100 rounded-xl text-center">
              No weekly reports compiled for this contract yet. Use the header button to compile one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-2">Report No.</th>
                    <th className="py-2">Period</th>
                    <th className="py-2 text-right">Hours Logged</th>
                    <th className="py-2 text-right">Resolved Tickets</th>
                    <th className="py-2 text-right">SLA Compliance</th>
                    <th className="py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {reports.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-semibold text-indigo-600">
                        <Link href={`/amc/reports/${r.id}`}>{r.reportNumber}</Link>
                      </td>
                      <td className="py-3 text-slate-600">
                        {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right font-mono font-medium">{Number(r.hoursLogged).toFixed(1)} hrs</td>
                      <td className="py-3 text-right font-mono">{r.ticketsResolved}</td>
                      <td className="py-3 text-right font-semibold text-green-600 font-mono">
                        {r.slaCompliancePercent ? `${Number(r.slaCompliancePercent).toFixed(1)}%` : '100.0%'}
                      </td>
                      <td className="py-3 text-right">
                        {r.clientApproved ? (
                          <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded flex items-center gap-1.5 w-fit ml-auto">
                            <CheckCircle size={10} /> Approved
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded w-fit ml-auto block">Pending Approval</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Linked Assets */}
      {(contract.assets?.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <h2 className="font-bold text-slate-900">🖥️ Covered Assets</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{contract.assets.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Asset', 'Type', 'Guardian Status', 'Renewal Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contract.assets.map((asset: any) => (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{asset.name}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{asset.type}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{asset.guardianStatus || '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{asset.renewalDate ? new Date(asset.renewalDate).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices & Payment Status */}
      {contractInvoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <h2 className="font-bold text-slate-900">💳 Invoices &amp; Payment Status</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{contractInvoices.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Invoice', 'Status', 'Due Date', 'Grand Total', 'Balance Due'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contractInvoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-mono font-medium text-indigo-700">
                      <Link href={`/billing/${inv.id}`} className="hover:underline">{inv.invoiceNumber}</Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.isOverdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {inv.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-xs ${inv.isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-900">{fmtCurrency(inv.grandTotal ?? 0)}</td>
                    <td className={`px-5 py-3 text-sm font-semibold ${Number(inv.balanceDue) > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtCurrency(inv.balanceDue ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Linked Tasks */}
      {(contract.tasks?.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <h2 className="font-bold text-slate-900">🗂 Linked Tasks</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{contract.tasks.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Task Title & Code', 'Status', 'Priority', 'Effort / Hours', 'Due Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contract.tasks.map((task: any) => {
                  const statusCls: Record<string, string> = {
                    TODO: 'bg-slate-100 text-slate-600', todo: 'bg-slate-100 text-slate-600',
                    IN_PROGRESS: 'bg-blue-100 text-blue-700', in_progress: 'bg-blue-100 text-blue-700',
                    REVIEW: 'bg-amber-100 text-amber-700', review: 'bg-amber-100 text-amber-700',
                    DONE: 'bg-green-100 text-green-700', done: 'bg-green-100 text-green-700',
                  };
                  return (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {task.taskCode && (
                            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                              {task.taskCode}
                            </span>
                          )}
                          <a href={`/tasks/${task.id}`} className="hover:text-indigo-600 hover:underline">
                            {task.title}
                          </a>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls[task.status] || 'bg-slate-100 text-slate-600'}`}>
                          {task.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">{task.priority || '—'}</td>
                      <td className="px-5 py-3 text-xs">
                        {task.totalTimeLogged && Number(task.totalTimeLogged) > 0 ? (
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {Number(task.totalTimeLogged).toFixed(1)} hrs
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Timer optional (0h)</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Linked Tickets */}
      {(contract.tickets?.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <h2 className="font-bold text-slate-900">🎫 Client Support Tickets</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{contract.tickets.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Ticket', 'Category', 'Status', 'Priority', 'Raised On'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contract.tickets.map((ticket: any) => {
                  const priCls: Record<string, string> = {
                    CRITICAL: 'bg-red-100 text-red-700',
                    HIGH: 'bg-orange-100 text-orange-700',
                    MEDIUM: 'bg-yellow-100 text-yellow-700',
                    LOW: 'bg-slate-100 text-slate-600',
                  };
                  return (
                    <tr key={ticket.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm font-medium text-blue-700">
                        <a href={`/tickets/${ticket.id}`} className="hover:underline">{ticket.title}</a>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">{ticket.category || '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{ticket.status?.replace('_', ' ')}</td>
                      <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priCls[ticket.priority] || 'bg-slate-100 text-slate-600'}`}>{ticket.priority}</span></td>
                      <td className="px-5 py-3 text-xs text-slate-500">{new Date(ticket.createdAt).toLocaleDateString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGenerateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Compile AMC Service Report</h2>
                <p className="text-xs text-slate-400 mt-0.5">Select reporting cycle and configure options</p>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleGenerateReport} className="p-6 space-y-4">
              {reportError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg">
                  {reportError}
                </div>
              )}

              {/* Quick Presets */}
              <div>
                <label className={labelCls}>Quick Presets</label>
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('this_week')}
                    className="flex-1 py-1.5 px-2 text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg transition-colors border border-slate-200"
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last_week')}
                    className="flex-1 py-1.5 px-2 text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg transition-colors border border-slate-200"
                  >
                    Last Week
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('this_month')}
                    className="flex-1 py-1.5 px-2 text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg transition-colors border border-slate-200"
                  >
                    This Month
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Period Start *</label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className={labelCls}>Period End *</label>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Hours Breakdown Toggle */}
              <div className="pt-1">
                <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeHours}
                    onChange={e => setIncludeHours(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Include Hours Breakdown (Optional)
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                      Default is <strong>OFF</strong> for client-facing reports. When OFF, internal logged hours & time-entry tables are excluded.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateReportMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-1 shadow-sm"
                >
                  {generateReportMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  {generateReportMutation.isPending ? 'Generating…' : 'Generate Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
