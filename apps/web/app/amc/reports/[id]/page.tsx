'use client';
import { useState, useEffect, use } from 'react';
import {
  useAmcWeeklyReport,
  useUpdateAmcReport,
} from '../../../../src/hooks/queries';
import {
  FileText,
  Download,
  Save,
  CheckCircle2,
  ArrowLeft,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Clock,
  RefreshCw,
  ListOrdered,
  Check,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../../../src/lib/api';

const inputCls =
  'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500';

function getInitials(name?: string) {
  if (!name) return 'AT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AmcWeeklyReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { data: report, isLoading, refetch } = useAmcWeeklyReport(id);
  const updateMutation = useUpdateAmcReport();

  const [saved, setSaved] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [declaration, setDeclaration] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [includeHours, setIncludeHours] = useState(false);

  // Accordion toggle states
  const [collapseCompleted, setCollapseCompleted] = useState(false);
  const [collapseReview, setCollapseReview] = useState(false);
  const [collapseProgress, setCollapseProgress] = useState(false);
  const [collapseBacklog, setCollapseBacklog] = useState(false);

  useEffect(() => {
    if (report && !hydrated) {
      setExecutiveSummary(report.executiveSummary ?? '');
      setDeclaration(report.declaration ?? '');
      const monData =
        typeof report.monitoringData === 'string'
          ? JSON.parse(report.monitoringData)
          : report.monitoringData || {};
      setIncludeHours(Boolean(monData?.includeHours));
      setHydrated(true);
    }
  }, [report, hydrated]);

  if (isLoading || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        Loading AMC service report details…
      </div>
    );
  }

  // Parse structured scopeExecuted
  let scopeData: any = report.scopeExecuted;
  if (typeof scopeData === 'string') {
    try {
      scopeData = JSON.parse(scopeData);
    } catch {
      scopeData = {};
    }
  }

  // Normalize items
  let completedItems: any[] = [];
  let inReviewItems: any[] = [];
  let inProgressItems: any[] = [];
  let backlogItems: any[] = [];

  if (Array.isArray(scopeData)) {
    completedItems = scopeData.filter((i: any) =>
      ['DONE', 'RESOLVED', 'Completed'].includes(i.status || i.statusCode),
    );
    inReviewItems = scopeData.filter((i: any) =>
      ['REVIEW', 'In Review'].includes(i.status || i.statusCode),
    );
    inProgressItems = scopeData.filter((i: any) =>
      ['IN_PROGRESS', 'In Progress'].includes(i.status || i.statusCode),
    );
    backlogItems = scopeData.filter((i: any) =>
      ['TODO', 'BACKLOG', 'Backlog', 'OPEN'].includes(i.status || i.statusCode),
    );
  } else if (scopeData) {
    completedItems = scopeData.completedDeliverables || scopeData.completed || [];
    inReviewItems = scopeData.inReview || [];
    inProgressItems = scopeData.ongoingWork || scopeData.inProgress || [];
    backlogItems = scopeData.upcomingPriorities || scopeData.backlog || [];
  }

  const overviewCounts = {
    completed: completedItems.length,
    inReview: inReviewItems.length,
    inProgress: inProgressItems.length,
    backlog: backlogItems.length,
  };

  const handleToggleHours = async () => {
    const nextVal = !includeHours;
    setIncludeHours(nextVal);
    const existingMon =
      typeof report.monitoringData === 'string'
        ? JSON.parse(report.monitoringData)
        : report.monitoringData || {};

    await updateMutation.mutateAsync({
      reportId: id,
      monitoringData: {
        ...existingMon,
        includeHours: nextVal,
      },
    });
    refetch();
  };

  const handleSave = async () => {
    const existingMon =
      typeof report.monitoringData === 'string'
        ? JSON.parse(report.monitoringData)
        : report.monitoringData || {};

    await updateMutation.mutateAsync({
      reportId: id,
      executiveSummary,
      declaration,
      monitoringData: {
        ...existingMon,
        includeHours,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDownloadPdf = async () => {
    try {
      const resp = await api.get(
        `/amc-contracts/weekly-reports/${id}/pdf`,
        { responseType: 'blob' },
      );
      const contentType = String(resp.headers['content-type'] ?? '');
      if (!contentType.includes('pdf')) {
        const text = await (resp.data as Blob).text();
        throw new Error(JSON.parse(text).message ?? 'PDF generation failed');
      }
      const url = URL.createObjectURL(
        new Blob([resp.data], { type: 'application/pdf' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `amc-report-${report?.reportNumber || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message ?? 'Failed to generate PDF');
    }
  };

  const clientName = report.contract?.client?.name || 'Dewstream';
  const periodStart = new Date(report.periodStart).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const periodEnd = new Date(report.periodEnd).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const contractNumber = report.contract?.contractNumber || 'AMCDE-22102026-30';

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Top Navigation & Action Controls Bar */}
        <div className="flex items-center justify-between">
          <Link
            href={`/amc/${report.contractId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={16} /> Back to AMC Contract ({contractNumber})
          </Link>

          <div className="flex items-center gap-2.5">
            {/* Hours Toggle Button */}
            <button
              type="button"
              onClick={handleToggleHours}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                includeHours
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm'
              }`}
            >
              {includeHours ? <Eye size={14} /> : <EyeOff size={14} className="text-slate-400" />}
              Hours Breakdown: <span className="font-bold underline">{includeHours ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg font-semibold text-xs transition-all shadow-sm"
            >
              <Download size={14} /> Download PDF
            </button>

            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-all shadow-sm disabled:opacity-60"
            >
              {saved ? <CheckCircle2 size={14} className="text-green-300" /> : <Save size={14} />}
              {saved ? 'Saved!' : updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Header Card (Exact Replica of Dashboard Screenshot) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Client & Period */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-600 rounded border border-indigo-100 uppercase tracking-wider">
                  Weekly AMC Service Report
                </span>
                <span className="text-xs font-mono font-medium text-slate-400">
                  {report.reportNumber}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Client: {clientName}
              </h1>
              <div className="text-sm font-semibold text-slate-700">
                {periodStart} – {periodEnd}
              </div>
              <div className="text-xs text-slate-500 pt-0.5">
                Generated: <span className="font-medium text-slate-700">{new Date(report.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span> | Compiled by: <span className="font-medium text-slate-700">{report.compiledBy?.firstName || 'System'} {report.compiledBy?.lastName || 'Admin'}</span>
              </div>
            </div>

            {/* Middle: Client Logo */}
            <div className="flex items-center justify-center py-2 px-6 bg-slate-50/50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                  d
                </div>
                <div>
                  <div className="text-base font-extrabold text-blue-900 leading-none tracking-tight">
                    Dewstream
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium tracking-wide">
                    Pure Water. Zero Hassle.
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Meta Key-Value Box */}
            <div className="text-xs space-y-1.5 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-6 text-slate-600">
              <div className="grid grid-cols-2 gap-4">
                <span className="text-slate-400">Client</span>
                <span className="font-semibold text-slate-900 text-right">{clientName}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <span className="text-slate-400">Contract</span>
                <span className="font-mono font-medium text-slate-700 text-right">{contractNumber}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <span className="text-slate-400">Report Type</span>
                <span className="font-semibold text-slate-900 text-right">Weekly AMC Service Report</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Delivery Overview Cards */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Completed */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                  <span className="text-xs font-bold text-slate-600">Completed</span>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                  {overviewCounts.completed}
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">Delivered & Closed</span>
              </div>
              <div className="w-full h-1 bg-emerald-500 rounded-full mt-3" />
            </div>

            {/* In Review */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                    <Clock size={12} />
                  </span>
                  <span className="text-xs font-bold text-slate-600">In Review</span>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                  {overviewCounts.inReview}
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">Awaiting Validation</span>
              </div>
              <div className="w-full h-1 bg-purple-500 rounded-full mt-3" />
            </div>

            {/* In Progress */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                    <RefreshCw size={12} />
                  </span>
                  <span className="text-xs font-bold text-slate-600">In Progress</span>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                  {overviewCounts.inProgress}
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">Active Engineering</span>
              </div>
              <div className="w-full h-1 bg-blue-500 rounded-full mt-3" />
            </div>

            {/* Backlog */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                    <ListOrdered size={12} />
                  </span>
                  <span className="text-xs font-bold text-slate-600">Backlog</span>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                  {overviewCounts.backlog}
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">Upcoming Priorities</span>
              </div>
              <div className="w-full h-1 bg-slate-300 rounded-full mt-3" />
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400 mt-2 pr-1">
            Real-time work item status for this reporting cycle
          </div>
        </div>

        {/* 4 Structured Table Sections */}
        <div className="space-y-4">
          {/* Section 1: Completed Deliverables Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setCollapseCompleted(!collapseCompleted)}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/70 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  ✓
                </span>
                <span className="text-sm font-bold text-slate-900">
                  1. Completed Deliverables
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                  {completedItems.length} item{completedItems.length !== 1 ? 's' : ''}
                </span>
                {collapseCompleted ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
              </div>
            </button>

            {!collapseCompleted && (
              <div className="border-t border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Title / Description</th>
                      <th className="py-2.5 px-4 w-32">Ticket ID</th>
                      <th className="py-2.5 px-4 w-44">Assignee</th>
                      <th className="py-2.5 px-4 w-36">Status</th>
                      <th className="py-2.5 px-4 w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No completed deliverables closed in this reporting cycle.
                        </td>
                      </tr>
                    ) : (
                      completedItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{item.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-indigo-600">
                              {item.ticketId || item.id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                                {getInitials(item.assignedTo)}
                              </span>
                              <span className="font-medium text-slate-700">{item.assignedTo || 'Ajay Pratap Tomar'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                              Completed
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400 hover:text-slate-600 cursor-pointer">
                            <MoreVertical size={16} className="mx-auto" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: In Review Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setCollapseReview(!collapseReview)}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/70 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  <Clock size={12} />
                </span>
                <span className="text-sm font-bold text-slate-900">
                  2. In Review
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
                  {inReviewItems.length} items
                </span>
                {collapseReview ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
              </div>
            </button>

            {!collapseReview && (
              <div className="border-t border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Title / Description</th>
                      <th className="py-2.5 px-4 w-32">Ticket ID</th>
                      <th className="py-2.5 px-4 w-44">Assignee</th>
                      <th className="py-2.5 px-4 w-48">Status</th>
                      <th className="py-2.5 px-4 w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inReviewItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No deliverables currently awaiting review.
                        </td>
                      </tr>
                    ) : (
                      inReviewItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{item.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-indigo-600">
                              {item.ticketId || item.id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                                {getInitials(item.assignedTo)}
                              </span>
                              <span className="font-medium text-slate-700">{item.assignedTo || 'Ajay Pratap Tomar'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold text-[11px]">
                              In Review
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">Awaiting Client / QA Sign-off</div>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400 hover:text-slate-600 cursor-pointer">
                            <MoreVertical size={16} className="mx-auto" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Ongoing Work Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setCollapseProgress(!collapseProgress)}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/70 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  <RefreshCw size={12} />
                </span>
                <span className="text-sm font-bold text-slate-900">
                  3. In Progress
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                  {inProgressItems.length} items
                </span>
                {collapseProgress ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
              </div>
            </button>

            {!collapseProgress && (
              <div className="border-t border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Title / Description</th>
                      <th className="py-2.5 px-4 w-32">Ticket ID</th>
                      <th className="py-2.5 px-4 w-44">Assignee</th>
                      <th className="py-2.5 px-4 w-48">Status</th>
                      <th className="py-2.5 px-4 w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inProgressItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No ongoing active tasks in this cycle.
                        </td>
                      </tr>
                    ) : (
                      inProgressItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{item.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-indigo-600">
                              {item.ticketId || item.id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                                {getInitials(item.assignedTo)}
                              </span>
                              <span className="font-medium text-slate-700">{item.assignedTo || 'Ajay Pratap Tomar'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[11px]">
                              In Progress
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">Active Engineering</div>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400 hover:text-slate-600 cursor-pointer">
                            <MoreVertical size={16} className="mx-auto" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 4: Upcoming Priorities Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setCollapseBacklog(!collapseBacklog)}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/70 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-slate-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  <ListOrdered size={12} />
                </span>
                <span className="text-sm font-bold text-slate-900">
                  4. Backlog
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  {backlogItems.length} items
                </span>
                {collapseBacklog ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
              </div>
            </button>

            {!collapseBacklog && (
              <div className="border-t border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Title / Description</th>
                      <th className="py-2.5 px-4 w-32">Ticket ID</th>
                      <th className="py-2.5 px-4 w-44">Priority</th>
                      <th className="py-2.5 px-4 w-36">Status</th>
                      <th className="py-2.5 px-4 w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backlogItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          Prioritized backlog items planned for the next reporting period.
                        </td>
                      </tr>
                    ) : (
                      backlogItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{item.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-indigo-600">
                              {item.ticketId || item.id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-700">{item.priority || 'MEDIUM'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold text-[11px]">
                              Backlog
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400 hover:text-slate-600 cursor-pointer">
                            <MoreVertical size={16} className="mx-auto" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Effort Breakdown (Conditional on includeHours) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Effort Breakdown</h3>
            <span
              className={`text-xs px-2.5 py-0.5 font-bold rounded-full ${
                includeHours
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {includeHours ? 'ON · Detailed Hours' : 'OFF · Client Mode'}
            </span>
          </div>

          {!includeHours ? (
            <div className="p-4 border border-dashed border-slate-200 bg-slate-50/70 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className="text-slate-400 shrink-0" />
                <span className="text-xs text-slate-600 font-medium">
                  Hidden in this configuration. No logged hours or time-entry tables.
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleHours}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline shrink-0"
              >
                Switch to Detailed View
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Hours Logged</span>
                  <span className="text-lg font-extrabold text-slate-800 font-mono">
                    {Number(report.hoursLogged).toFixed(1)}h
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Tickets Resolved</span>
                  <span className="text-lg font-extrabold text-slate-800 font-mono">{report.ticketsResolved}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Compliance Rate</span>
                  <span className="text-lg font-extrabold text-green-600 font-mono">
                    {report.slaCompliancePercent ? `${Number(report.slaCompliancePercent).toFixed(1)}%` : '100.0%'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Open Tickets</span>
                  <span className="text-lg font-extrabold text-slate-800 font-mono">{report.ticketsOpen}</span>
                </div>
              </div>

              {Array.isArray(report.effortSummary) && report.effortSummary.length > 0 && (
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                      <tr>
                        <th className="p-3">Activity</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.effortSummary.map((effort: any, idx: number) => (
                        <tr key={idx} className={effort.isTotal ? 'bg-slate-50 font-bold' : ''}>
                          <td className="p-3">{effort.activity}</td>
                          <td className="p-3 text-slate-500">{effort.category || '—'}</td>
                          <td className="p-3 text-right font-mono">{Number(effort.hours).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Executive Summary & Formal Declaration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Executive Work Summary
            </h3>
            <textarea
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              rows={4}
              placeholder="Highlight key accomplishments and metrics for this period..."
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Declaration Statement
            </h3>
            <textarea
              value={declaration}
              onChange={(e) => setDeclaration(e.target.value)}
              rows={4}
              placeholder="Formal declaration of rendered services..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
