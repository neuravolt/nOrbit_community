"use client";

import React from "react";
import {
  Check,
  Sparkles,
  Users,
  FolderKanban,
  Server,
  ArrowRight,
  CheckCircle2,
  X,
} from "lucide-react";
import { PlanItem } from "./UpgradeConfirmModal";

interface PlanComparisonGridProps {
  plans: PlanItem[];
  currentPlanId?: string;
  billingInterval: "MONTHLY" | "YEARLY";
  onIntervalChange: (interval: "MONTHLY" | "YEARLY") => void;
  currency: "INR" | "USD";
  onCurrencyChange: (currency: "INR" | "USD") => void;
  onSelectUpgradePlan: (plan: PlanItem) => void;
}

export function PlanComparisonGrid({
  plans,
  currentPlanId,
  billingInterval,
  onIntervalChange,
  currency,
  onCurrencyChange,
  onSelectUpgradePlan,
}: PlanComparisonGridProps) {
  const isINR = currency === "INR";
  const isYearly = billingInterval === "YEARLY";
  const currencySymbol = isINR ? "₹" : "$";

  const formatLimit = (limit: number, unit: string) => {
    if (limit <= 0 || limit === -1) return `Unlimited ${unit}`;
    return `Up to ${limit} ${unit}`;
  };

  return (
    <div className="space-y-6">
      {/* Controls: Billing interval toggle & Currency selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Available Subscription Tiers
          </h3>
          <p className="text-xs text-slate-500">
            Choose the best plan for your team size and infrastructure needs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Switcher */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => onCurrencyChange("INR")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                currency === "INR"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              INR (₹)
            </button>
            <button
              type="button"
              onClick={() => onCurrencyChange("USD")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                currency === "USD"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              USD ($)
            </button>
          </div>

          {/* Billing Interval Switcher */}
          <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => onIntervalChange("MONTHLY")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                !isYearly
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onIntervalChange("YEARLY")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isYearly
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Yearly</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isPro = plan.slug?.toLowerCase().includes("pro");
          const isEnterprise = plan.slug?.toLowerCase().includes("enterprise");

          const price = isINR
            ? isYearly
              ? plan.priceYearlyINR
              : plan.priceMonthlyINR
            : isYearly
            ? plan.priceYearlyUSD
            : plan.priceMonthlyUSD;

          const monthlyEquivalent = isYearly && price > 0 ? Math.round(price / 12) : price;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 transition-all duration-200 bg-white border ${
                isCurrent
                  ? "border-emerald-300 ring-2 ring-emerald-100 shadow-md"
                  : isPro
                  ? "border-indigo-400 ring-2 ring-indigo-100 shadow-md shadow-indigo-100"
                  : "border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md"
              }`}
            >
              {/* Top Badges */}
              <div className="flex items-center justify-between gap-2 min-h-[28px] mb-3">
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Current Plan
                  </span>
                ) : isPro ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    Most Popular
                  </span>
                ) : isEnterprise ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    Enterprise Scale
                  </span>
                ) : (
                  <span />
                )}
              </div>

              {/* Plan Header & Pricing */}
              <div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">
                  {plan.name}
                </h4>
                {plan.description && (
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px] leading-relaxed">
                    {plan.description}
                  </p>
                )}

                <div className="mt-4 mb-6 pb-6 border-b border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                      {price > 0
                        ? `${currencySymbol}${price.toLocaleString("en-IN")}`
                        : "Free"}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {isYearly ? "/ year" : "/ month"}
                    </span>
                  </div>

                  {isYearly && price > 0 && (
                    <p className="text-[11px] font-semibold text-emerald-600 mt-1">
                      Equivalent to {currencySymbol}
                      {monthlyEquivalent.toLocaleString("en-IN")}/mo billed annually
                    </p>
                  )}
                </div>

                {/* Quotas Section */}
                <div className="space-y-2.5 mb-6">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Resource Quotas
                  </span>

                  <div className="flex items-center gap-2.5 text-xs text-slate-700">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold">
                      {formatLimit(plan.maxMembers, "team members")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-slate-700">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <FolderKanban className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold">
                      {formatLimit(plan.maxProjects, "projects")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-slate-700">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Server className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold">
                      {formatLimit(plan.maxServers, "BYOVPS servers")}
                    </span>
                  </div>
                </div>

                {/* Included Features */}
                <div className="space-y-2.5 mb-8">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Feature Inclusions
                  </span>

                  {[
                    { label: "Projects & Tasks", val: plan.featureProjectsTasks },
                    { label: "CRM & Contacts", val: plan.featureCrm },
                    { label: "Invoicing & GST Billing", val: plan.featureBilling },
                    { label: "Guardian BYOVPS", val: plan.featureGuardianByovps },
                    { label: "Client Portal", val: plan.featureClientPortal },
                    { label: "API & Webhooks", val: plan.featureApiAccess },
                  ].map((feat, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 text-xs ${
                        feat.val ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {feat.val ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className={feat.val ? "font-medium" : "line-through opacity-75"}>
                        {feat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-100">
                {isCurrent ? (
                  <button
                    disabled
                    type="button"
                    className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed text-center"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectUpgradePlan(plan)}
                    className={`w-full py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer hover:scale-[1.02] ${
                      isPro
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-indigo-100"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    <span>Upgrade to {plan.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
