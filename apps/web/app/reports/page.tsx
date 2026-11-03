"use client";

import { useWeeklyReport, useTeamProductivity, useAmcHealthReport } from "../../src/hooks/queries";
import { Loader2, BarChart3, Ticket, Clock, Send, FolderKanban, Receipt, ShieldCheck } from "lucide-react";
import { PageShell, PageHeader, TableCard, th, td, EmptyBlock } from "../../src/components/ui/page";
import { KpiCard, ChartCard, BarList } from "../../src/components/ui/charts";

const n = (v: unknown) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("en-IN"));
const inr = (v: unknown) => (v === null || v === undefined ? "—" : `₹${Math.round(Number(v)).toLocaleString("en-IN")}`);
const hrs = (v: unknown) => (v === null || v === undefined ? "—" : `${Math.round(Number(v) * 10) / 10}h`);

export default function ReportsPage() {
  const { data: weekly, isLoading: weeklyLoading, isError: weeklyError } = useWeeklyReport();
  const { data: month, isLoading: monthLoading } = useTeamProductivity();
  const { data: amc, isLoading: amcLoading } = useAmcHealthReport();

  const loading = weeklyLoading || monthLoading || amcLoading;
  const people: { userName: string; hours: number }[] = Array.isArray(weekly?.teamProductivity) ? weekly.teamProductivity : [];

  return (
    <PageShell>
      <PageHeader icon={BarChart3} title="Reports" subtitle="This week across tickets, projects, time and billing, plus the last 30 days of team output." />

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>
      ) : weeklyError || !weekly ? (
        <EmptyBlock icon={BarChart3} title="Reports could not be loaded" hint="Try again in a moment." />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">This week</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Tickets opened" value={n(weekly.tickets?.created ?? weekly.newTickets)} icon={Ticket} tone="info" delta={{ text: `${n(weekly.tickets?.resolved ?? weekly.resolvedTickets)} resolved` }} />
              <KpiCard label="Hours logged" value={hrs(weekly.hoursLogged)} icon={Clock} tone="violet" delta={{ text: `${people.length} people logged time` }} />
              <KpiCard label="Invoices sent" value={n(weekly.invoicesSent)} icon={Send} tone="ok" />
              <KpiCard label="Projects started" value={n(weekly.projects?.started)} icon={FolderKanban} tone="warning" delta={{ text: `${n(weekly.projects?.completed)} completed` }} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Hours by person this week" className="lg:col-span-2">
              <BarList items={people.map((p) => ({ label: p.userName, value: Number(p.hours) || 0 }))} empty="No time logged this week." format={(v) => `${Math.round(v * 10) / 10}h`} />
            </ChartCard>
            <ChartCard title="Money waiting">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm"><span className="text-slate-500 flex items-center gap-2"><Receipt className="w-4 h-4" /> Overdue invoices</span><span className="font-semibold text-slate-900">{n(weekly.overdueInvoices?.count)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Overdue amount</span><span className="font-semibold text-rose-600">{inr(weekly.overdueInvoices?.totalAmount)}</span></div>
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm"><span className="text-slate-500 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Active AMCs</span><span className="font-semibold text-slate-900">{n(weekly.amcContracts?.active)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Ending in 30 days</span><span className="font-semibold text-amber-600">{n(weekly.amcContracts?.expiringNext30Days)}</span></div>
              </div>
            </ChartCard>
          </div>

          {month && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last 30 days</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard label="Tasks completed" value={n(month.tasksCompleted)} tone="ok" />
                <KpiCard label="Hours logged" value={hrs(month.hoursLogged)} tone="violet" />
                <KpiCard label="Tickets resolved" value={n(month.ticketsResolved)} tone="info" />
              </div>
            </section>
          )}

          {amc && (
            <TableCard title="AMC portfolio" icon={ShieldCheck}>
              <table className="min-w-full divide-y divide-slate-100">
                <thead><tr>{["Active", "Ending soon", "Expired", "Hours used", "Hours left", "Contract value"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr>
                    <td className={td}>{n(amc.activeContracts)}</td>
                    <td className={td}>{n(amc.expiringSoon)}</td>
                    <td className={td}>{n(amc.expired)}</td>
                    <td className={td}>{amc.avgUsagePercent === null || amc.avgUsagePercent === undefined ? "—" : `${Number(amc.avgUsagePercent).toFixed(1)}%`}</td>
                    <td className={td}>{hrs(amc.totalHoursRemaining)}</td>
                    <td className={td}>{inr(amc.totalContractValue)}</td>
                  </tr>
                </tbody>
              </table>
            </TableCard>
          )}
        </>
      )}
    </PageShell>
  );
}
