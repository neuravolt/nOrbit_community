'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuditLogs } from '../../../src/hooks/queries';
import { ArrowLeft, Clock, RefreshCw, User, Cpu, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<'ALL' | 'SYSTEM' | 'USER'>('ALL');
  const [resourceIdFilter, setResourceIdFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch logs based on filters
  const params: any = {
    page,
    limit: 15,
  };
  
  if (filterType === 'SYSTEM') {
    params.resourceType = 'SystemScheduler';
  }

  const { data, isLoading, isError, refetch } = useAuditLogs(params);
  
  const logsData = data?.logs || [];
  const totalPages = data?.totalPages || 1;

  // Filter logs locally for search and system actions types
  const filteredLogs = logsData.filter((log: any) => {
    // If filterType is USER, exclude SystemScheduler logs
    if (filterType === 'USER' && log.resourceType === 'SystemScheduler') {
      return false;
    }
    
    // Filter by specific Cron Job Name if selected
    if (filterType === 'SYSTEM' && resourceIdFilter && log.resourceId !== resourceIdFilter) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const actionMatch = log.action?.toLowerCase().includes(q);
      const resourceMatch = log.resourceType?.toLowerCase().includes(q);
      const messageMatch = JSON.stringify(log.metadata || {}).toLowerCase().includes(q);
      const userMatch = (log.user?.firstName + ' ' + log.user?.lastName).toLowerCase().includes(q);
      return actionMatch || resourceMatch || messageMatch || userMatch;
    }

    return true;
  });

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (log: any) => {
    const metadata = log.metadata || {};
    const status = metadata.status || 'SUCCESS';
    
    if (status === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          <CheckCircle size={12} /> Success
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <AlertCircle size={12} /> Failed
        </span>
      );
    }
  };

  const getLogDetails = (log: any) => {
    const metadata = log.metadata || {};
    
    if (log.resourceType === 'SystemScheduler') {
      return metadata.message || metadata.error || 'System scheduler executed.';
    }
    
    // Handle standard user action metadata descriptions
    if (log.action === 'CREATE') {
      return `Created new ${log.resourceType} (ID: ${log.resourceId.slice(0, 8)}...)`;
    }
    if (log.action === 'UPDATE') {
      return `Updated ${log.resourceType} details.`;
    }
    if (log.action === 'DELETE') {
      return `Deleted ${log.resourceType} record.`;
    }

    return `Performed action ${log.action} on ${log.resourceType}.`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Back navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
              <ArrowLeft size={14} /> Back to Settings
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="text-indigo-600" size={24} /> System Audit Logs
            </h1>
            <p className="text-slate-500 text-sm">
              Monitor automated cron jobs scheduler status and administrative user audit trails.
            </p>
          </div>
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm cursor-pointer self-start md:self-center"
          >
            <RefreshCw size={13} /> Refresh logs
          </button>
        </div>

        {/* Filters Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-100 p-1 bg-slate-50 rounded-xl w-full lg:w-fit">
            {[
              { id: 'ALL', label: 'All Logs' },
              { id: 'SYSTEM', label: 'System Cron Jobs (9 AM / 10 AM)' },
              { id: 'USER', label: 'User Actions' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterType(tab.id as any);
                  setResourceIdFilter('');
                  setPage(1);
                }}
                className={`flex-1 lg:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterType === tab.id 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Subfilters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {filterType === 'SYSTEM' && (
              <select
                value={resourceIdFilter}
                onChange={e => setResourceIdFilter(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Scheduled Tasks</option>
                <option value="flagOverdueInvoices">Flag Overdue Invoices (9 AM)</option>
                <option value="generateAssetInvoices">Generate Asset Invoices (9:30 AM)</option>
                <option value="checkAmcExpiry">Check AMC Expiry (8 AM)</option>
                <option value="checkAmcHours">Check AMC Hours (10 AM)</option>
                <option value="generateAmcInvoices">Generate AMC Invoices (10 AM)</option>
                <option value="generateAmcWeeklyReports">Weekly AMC Reports (Mon 9 AM)</option>
              </select>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search action, message, actor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50/50 focus:bg-white border border-slate-250 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="text-xs font-medium">Fetching run history...</p>
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-red-500 space-y-2">
              <AlertCircle className="mx-auto" size={28} />
              <p className="text-sm font-bold">Failed to load system logs.</p>
              <p className="text-xs text-slate-400">Please make sure the API server is reachable.</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <AlertCircle className="mx-auto text-slate-300" size={28} />
              <p className="text-sm font-bold">No logs found.</p>
              <p className="text-xs text-slate-400">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Timestamp</th>
                    <th className="px-6 py-3.5">Actor</th>
                    <th className="px-6 py-3.5">Event Type</th>
                    <th className="px-6 py-3.5">Task / Module</th>
                    <th className="px-6 py-3.5">Details</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLogs.map((log: any) => {
                    const isSystem = log.resourceType === 'SystemScheduler';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isSystem ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-[10px] uppercase">
                              <Cpu size={11} /> System Engine
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                              <User size={12} className="text-slate-400" />
                              {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Administrator'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-mono text-[10px] font-bold uppercase ${
                            log.action === 'CRON_RUN' ? 'text-teal-600' : 'text-slate-500'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-semibold">
                          {log.resourceType === 'SystemScheduler' ? log.resourceId : log.resourceType}
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium max-w-md break-words">
                          {getLogDetails(log)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(log)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !isError && totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Page <span className="font-bold text-slate-700">{page}</span> of <span className="font-bold text-slate-700">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-white bg-slate-50 transition-all disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-white bg-slate-50 transition-all disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
