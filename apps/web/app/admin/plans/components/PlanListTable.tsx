"use client";

import { useState } from "react";
import axios from "axios";
import { Plan } from "../types";
import { Badge, TableCard, td, th } from "@/src/components/ui/page";
import {
  Edit3,
  PowerOff,
  Power,
  Users,
  FolderKanban,
  Server,
  Layers,
  Check,
  Loader2,
  Globe,
  Lock,
} from "lucide-react";
import { api } from "@/src/lib/api";

interface PlanListTableProps {
  plans: Plan[];
  isLoading: boolean;
  onEditPlan: (plan: Plan) => void;
  onRefresh: () => void;
}

export function PlanListTable({
  plans,
  isLoading,
  onEditPlan,
  onRefresh,
}: PlanListTableProps) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleToggleActive = async (plan: Plan) => {
    setActionLoadingId(plan.id);
    try {
      if (plan.isActive) {
        // Deactivate via DELETE /admin/plans/:id
        await api.delete(`/admin/plans/${plan.id}`);
      } else {
        // Reactivate via PATCH /admin/plans/:id
        await api.patch(`/admin/plans/${plan.id}`, { isActive: true });
      }
      onRefresh();
    } catch (err: unknown) {
      let msg = "Failed to update plan status";
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const serverMsg = err.response.data.message;
        msg = Array.isArray(serverMsg) ? serverMsg.join(", ") : String(serverMsg);
      } else if (err instanceof Error) {
        msg = err.message;
      }
      alert(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderLimit = (value: number) => {
    if (value <= 0 || value === -1) {
      return (
        <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
          Unlimited
        </span>
      );
    }
    return <span className="font-semibold text-slate-900">{value}</span>;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading subscription plans...</p>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900">No subscription plans found</h3>
        <p className="text-sm text-slate-500 mt-1">
          Create your first subscription plan to begin provisioning customer organizations.
        </p>
      </div>
    );
  }

  return (
    <TableCard
      title="Configured Subscription Tiers"
      icon={Layers}
      count={plans.length}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className={th}>Plan & Tier</th>
            <th className={th}>Pricing (INR / USD)</th>
            <th className={th}>Resource Quotas</th>
            <th className={th}>Feature Capabilities</th>
            <th className={th}>Visibility & Status</th>
            <th className={`${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {plans.map((plan) => {
            const isProcessing = actionLoadingId === plan.id;

            return (
              <tr key={plan.id} className="hover:bg-slate-50/60 transition">
                {/* 1. Plan Name & Details */}
                <td className={td}>
                  <div className="min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">{plan.name}</span>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {plan.slug}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-slate-500 mt-1 max-w-xs line-clamp-2">
                        {plan.description}
                      </p>
                    )}
                    {plan._count?.subscriptions !== undefined && (
                      <span className="inline-block mt-1 text-[11px] text-slate-500 font-medium">
                        {plan._count.subscriptions}{" "}
                        {plan._count.subscriptions === 1 ? "organization" : "organizations"}
                      </span>
                    )}
                  </div>
                </td>

                {/* 2. Dual Currency Pricing */}
                <td className={td}>
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-slate-900">
                      ₹{plan.priceMonthlyINR.toLocaleString()}/mo{" "}
                      <span className="text-slate-400 font-normal">
                        (₹{plan.priceYearlyINR.toLocaleString()}/yr)
                      </span>
                    </div>
                    <div className="text-slate-600">
                      ${plan.priceMonthlyUSD}/mo{" "}
                      <span className="text-slate-400">(${plan.priceYearlyUSD}/yr)</span>
                    </div>
                  </div>
                </td>

                {/* 3. Resource Quotas */}
                <td className={td}>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-600">Members:</span>
                      {renderLimit(plan.maxMembers)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-600">Projects:</span>
                      {renderLimit(plan.maxProjects)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-600">Servers:</span>
                      {renderLimit(plan.maxServers)}
                    </div>
                  </div>
                </td>

                {/* 4. Feature Badges */}
                <td className={td}>
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {plan.featureProjectsTasks && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3 text-emerald-600" /> Projects
                      </span>
                    )}
                    {plan.featureCrm && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3 text-emerald-600" /> CRM
                      </span>
                    )}
                    {plan.featureBilling && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3 text-emerald-600" /> Billing
                      </span>
                    )}
                    {plan.featureGuardianByovps && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3 text-emerald-600" /> Guardian
                      </span>
                    )}
                    {plan.featureClientPortal && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3 text-emerald-600" /> Portal
                      </span>
                    )}
                    {plan.featureApiAccess && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3 text-emerald-600" /> API
                      </span>
                    )}
                  </div>
                </td>

                {/* 5. Visibility & Active Status */}
                <td className={td}>
                  <div className="space-y-1.5">
                    <div>
                      {plan.isActive ? (
                        <Badge tone="green" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="red" dot>
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div>
                      {plan.isPublic ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <Globe className="w-3 h-3" /> Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Lock className="w-3 h-3" /> Private
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* 6. Actions */}
                <td className={`${td} text-right`}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEditPlan(plan)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      title="Edit Plan Settings"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    {plan.isActive ? (
                      <button
                        onClick={() => handleToggleActive(plan)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition disabled:opacity-50"
                        title="Deactivate this plan"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PowerOff className="w-3.5 h-3.5" />
                        )}
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleActive(plan)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-50"
                        title="Reactivate this plan"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                        Activate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
