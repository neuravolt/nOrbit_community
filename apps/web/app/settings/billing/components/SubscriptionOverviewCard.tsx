"use client";

import React from "react";
import {
  Users,
  Server,
  FolderKanban,
  CheckCircle2,
  XCircle,
  Calendar,
  Sparkles,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

export interface CurrentSubscriptionData {
  organization: {
    id: string;
    name: string;
    domain?: string | null;
  };
  subscription: {
    id: string;
    planId: string;
    planName: string;
    planSlug: string;
    status: "ACTIVE" | "TRIAL" | "EXPIRED" | "CANCELLED" | string;
    billingInterval: "MONTHLY" | "YEARLY" | string;
    currency: "INR" | "USD" | string;
    customMaxMembers?: number | null;
    customMaxProjects?: number | null;
    customMaxServers?: number | null;
    expiresAt?: string | null;
    trialExpiresAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  plan: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    priceMonthlyINR: number;
    priceYearlyINR: number;
    priceMonthlyUSD: number;
    priceYearlyUSD: number;
    maxMembers: number;
    maxProjects: number;
    maxServers: number;
    featureProjectsTasks: boolean;
    featureCrm: boolean;
    featureBilling: boolean;
    featureGuardianByovps: boolean;
    featureClientPortal: boolean;
    featureApiAccess: boolean;
  };
  usage: {
    members: number;
    activeMembers: number;
    pendingInvitations: number;
    effectiveMaxMembers: number;
    projects: number;
    effectiveMaxProjects: number;
    servers: number;
    effectiveMaxServers: number;
  };
  effectiveLimits: {
    maxMembers: number;
    maxProjects: number;
    maxServers: number;
  };
}

interface SubscriptionOverviewCardProps {
  data: CurrentSubscriptionData;
  onExplorePlans?: () => void;
}

export function SubscriptionOverviewCard({
  data,
  onExplorePlans,
}: SubscriptionOverviewCardProps) {
  const { organization, subscription, plan, usage } = data;

  const isUnlimited = (val: number | null | undefined) =>
    val === null || val === undefined || val <= 0 || val === -1;

  const renderQuotaBar = (
    label: string,
    icon: React.ReactNode,
    current: number,
    maxLimit: number,
    unit: string
  ) => {
    const unlimited = isUnlimited(maxLimit);
    const percent = unlimited ? 0 : Math.min(Math.round((current / maxLimit) * 100), 100);
    const isFull = !unlimited && current >= maxLimit;
    const isWarning = !unlimited && !isFull && percent >= 80;

    const barColor = isFull
      ? "bg-rose-500"
      : isWarning
      ? "bg-amber-500"
      : "bg-indigo-600";

    return (
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 transition-all hover:bg-slate-50 hover:shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="p-1.5 bg-white border border-slate-200 rounded-lg text-indigo-600 shadow-2xs">
              {icon}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900">{label}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {unlimited ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Unlimited
              </span>
            ) : isFull ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                Limit Reached
              </span>
            ) : isWarning ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                {percent}% used
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-500">
                {percent}% used
              </span>
            )}
          </div>
        </div>

        {/* Meter progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden my-2.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: unlimited ? "100%" : `${Math.max(percent, 4)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            <strong className="text-slate-900 font-bold">{current}</strong>{" "}
            {unlimited ? `${unit} active` : `of ${maxLimit} ${unit}`}
          </span>
          {!unlimited && (
            <span className={isFull ? "text-rose-600 font-semibold" : ""}>
              {maxLimit - current > 0 ? `${maxLimit - current} remaining` : "0 remaining"}
            </span>
          )}
        </div>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Active
          </span>
        );
      case "TRIAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
            Free Trial
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const expiryDate =
    subscription?.expiresAt || subscription?.trialExpiresAt;
  const formattedExpiry = expiryDate
    ? new Date(expiryDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const features = [
    { label: "Projects & Sprints", enabled: plan?.featureProjectsTasks },
    { label: "CRM & Contacts", enabled: plan?.featureCrm },
    { label: "Invoicing & GST Billing", enabled: plan?.featureBilling },
    { label: "Guardian BYOVPS Fleet", enabled: plan?.featureGuardianByovps },
    { label: "White-Label Client Portal", enabled: plan?.featureClientPortal },
    { label: "REST API & Webhooks", enabled: plan?.featureApiAccess },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      {/* Top Banner: Plan info and quick status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-100 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                  {subscription?.planName || plan?.name || "Starter"} Plan
                </h2>
                {getStatusBadge(subscription?.status || "ACTIVE")}
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                  {subscription?.billingInterval || "MONTHLY"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Workspace tenant: <span className="font-semibold text-slate-700">{organization?.name}</span>
                {organization?.domain && ` (${organization.domain})`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Renewal / Expiry
            </span>
            <span className="text-sm font-semibold text-slate-700 flex items-center justify-end gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formattedExpiry || "Auto-renews monthly"}
            </span>
          </div>

          {onExplorePlans && (
            <button
              onClick={onExplorePlans}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-indigo-100 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Change or Upgrade Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Quota Usage Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Resource Quotas &amp; Usage
          </h3>
          <span className="text-xs text-slate-400">
            Calculated in real-time across active tenant resources
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderQuotaBar(
            "Team Members",
            <Users className="w-4 h-4" />,
            usage?.members ?? 0,
            usage?.effectiveMaxMembers ?? plan?.maxMembers ?? 5,
            "members"
          )}

          {renderQuotaBar(
            "Active Projects",
            <FolderKanban className="w-4 h-4" />,
            usage?.projects ?? 0,
            usage?.effectiveMaxProjects ?? plan?.maxProjects ?? 10,
            "projects"
          )}

          {renderQuotaBar(
            "BYOVPS Servers",
            <Server className="w-4 h-4" />,
            usage?.servers ?? 0,
            usage?.effectiveMaxServers ?? plan?.maxServers ?? 1,
            "servers"
          )}
        </div>
      </div>

      {/* Active Feature Capabilities */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Feature Capabilities Included
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {features.map((f, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                f.enabled
                  ? "bg-emerald-50/60 border-emerald-200/80 text-emerald-900"
                  : "bg-slate-50 border-slate-200/60 text-slate-400 opacity-70"
              }`}
            >
              {f.enabled ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="truncate">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
