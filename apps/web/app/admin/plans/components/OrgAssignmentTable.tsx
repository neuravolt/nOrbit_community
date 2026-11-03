"use client";

import { AdminOrganizationRow, Plan } from "../types";
import { Badge, TableCard, SearchInput, selectClass, td, th } from "@/src/components/ui/page";
import {
  Building2,
  Sliders,
  Calendar,
  Sparkles,
  Loader2,
} from "lucide-react";

interface OrgAssignmentTableProps {
  organizations: AdminOrganizationRow[];
  plans: Plan[];
  isLoading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  selectedPlanFilter: string;
  onPlanFilterChange: (planId: string) => void;
  onManageOrg: (org: AdminOrganizationRow) => void;
}

export function OrgAssignmentTable({
  organizations,
  plans,
  isLoading,
  search,
  onSearchChange,
  selectedPlanFilter,
  onPlanFilterChange,
  onManageOrg,
}: OrgAssignmentTableProps) {
  const renderUsageBar = (current: number, limit: number) => {
    const isUnlimited = limit <= 0 || limit === -1;
    const percentage = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
    const isNearLimit = !isUnlimited && percentage >= 80 && percentage < 100;
    const isAtLimit = !isUnlimited && percentage >= 100;

    let barColor = "bg-indigo-600";
    if (isAtLimit) barColor = "bg-rose-500";
    else if (isNearLimit) barColor = "bg-amber-500";

    return (
      <div className="space-y-1 min-w-[120px]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-800">
            {current} <span className="text-slate-400 font-normal">/</span>{" "}
            {isUnlimited ? (
              <span className="text-emerald-700 font-semibold">∞</span>
            ) : (
              limit
            )}
          </span>
          {!isUnlimited && (
            <span
              className={`text-[10px] font-semibold ${
                isAtLimit
                  ? "text-rose-600"
                  : isNearLimit
                  ? "text-amber-600"
                  : "text-slate-500"
              }`}
            >
              {percentage}%
            </span>
          )}
        </div>
        {!isUnlimited && (
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge tone="green" dot>Active</Badge>;
      case "TRIAL":
        return <Badge tone="blue" dot>Trial</Badge>;
      case "EXPIRED":
        return <Badge tone="red" dot>Expired</Badge>;
      case "CANCELLED":
        return <Badge tone="slate" dot>Cancelled</Badge>;
      default:
        return <Badge tone="slate">{status}</Badge>;
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return <span className="text-slate-400">—</span>;
    const d = new Date(isoString);
    return (
      <span className="font-medium text-slate-700">
        {d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search by organization name or domain..."
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            className={selectClass}
            value={selectedPlanFilter}
            onChange={(e) => onPlanFilterChange(e.target.value)}
          >
            <option value="">All Plan Tiers</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} Tier
              </option>
            ))}
          </select>
          {(search || selectedPlanFilter) && (
            <button
              onClick={() => {
                onSearchChange("");
                onPlanFilterChange("");
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading customer organizations...</p>
        </div>
      ) : organizations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No organizations found</h3>
          <p className="text-sm text-slate-500 mt-1">
            {search || selectedPlanFilter
              ? "No customer organizations matched your search filter criteria."
              : "No customer organizations registered on norbit.neuravolt.in yet."}
          </p>
        </div>
      ) : (
        <TableCard
          title="Customer Organizations & Subscription Allocations"
          icon={Building2}
          count={organizations.length}
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={th}>Organization & Domain</th>
                <th className={th}>Active Plan</th>
                <th className={th}>Members (Usage/Limit)</th>
                <th className={th}>Servers (Usage/Limit)</th>
                <th className={th}>Projects (Usage/Limit)</th>
                <th className={th}>Subscription Status</th>
                <th className={th}>Expiry / Renewal Date</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {organizations.map((org) => {
                const sub = org.subscription;
                const hasCustomOverrides =
                  sub.customMaxMembers !== null ||
                  sub.customMaxProjects !== null ||
                  sub.customMaxServers !== null;

                return (
                  <tr key={org.id} className="hover:bg-slate-50/60 transition">
                    {/* Organization details */}
                    <td className={td}>
                      <div className="min-w-[170px]">
                        <span className="font-bold text-slate-900 text-sm block">
                          {org.name}
                        </span>
                        {org.domain ? (
                          <span className="text-xs text-slate-500 font-mono">
                            {org.domain}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No domain set</span>
                        )}
                      </div>
                    </td>

                    {/* Active Plan */}
                    <td className={td}>
                      <div className="min-w-[130px] space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 text-sm">
                            {sub.planName}
                          </span>
                        </div>
                        {hasCustomOverrides && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <Sparkles className="w-3 h-3" /> Custom Quota
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Members usage */}
                    <td className={td}>
                      {renderUsageBar(
                        org.usage.members,
                        org.usage.effectiveMaxMembers
                      )}
                    </td>

                    {/* Servers usage */}
                    <td className={td}>
                      {renderUsageBar(
                        org.usage.servers,
                        org.usage.effectiveMaxServers
                      )}
                    </td>

                    {/* Projects usage */}
                    <td className={td}>
                      {renderUsageBar(
                        org.usage.projects,
                        org.usage.effectiveMaxProjects
                      )}
                    </td>

                    {/* Subscription Status */}
                    <td className={td}>
                      <div className="space-y-1">
                        {getStatusBadge(sub.status)}
                        <span className="text-[11px] text-slate-400 block">
                          {sub.billingInterval} ({sub.currency})
                        </span>
                      </div>
                    </td>

                    {/* Expiry Date */}
                    <td className={td}>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(sub.expiresAt || sub.trialExpiresAt)}
                        </div>
                        {sub.trialExpiresAt && (
                          <span className="text-[10px] text-blue-600 font-medium block">
                            Trial Ends
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className={`${td} text-right`}>
                      <button
                        onClick={() => onManageOrg(org)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        Assign & Override
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}
