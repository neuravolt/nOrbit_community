"use client";

import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Receipt,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { PageShell, PageHeader } from "@/src/components/ui/page";
import { api } from "@/src/lib/api";
import {
  SubscriptionOverviewCard,
  CurrentSubscriptionData,
} from "./components/SubscriptionOverviewCard";
import { PlanComparisonGrid } from "./components/PlanComparisonGrid";
import {
  UpgradeConfirmModal,
  PlanItem,
  UpgradeResult,
} from "./components/UpgradeConfirmModal";
import { LimitExceededBanner } from "@/app/components/LimitExceededBanner";

export default function CustomerBillingPage() {
  const qc = useQueryClient();
  const plansSectionRef = useRef<HTMLDivElement>(null);

  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<PlanItem | null>(null);
  const [successBannerMsg, setSuccessBannerMsg] = useState<string | null>(null);

  // 1. Fetch current organization subscription and usage quotas
  const {
    data: currentSubData,
    isLoading: isSubLoading,
    isError: isSubError,
    error: subError,
    refetch: refetchCurrentSub,
  } = useQuery<CurrentSubscriptionData>({
    queryKey: ["customer-subscription-current"],
    queryFn: async () => {
      const res = await api.get("/plans/current");
      return res.data;
    },
    staleTime: 15_000,
  });

  // 2. Fetch active public plans
  const {
    data: publicPlans = [],
    isLoading: isPlansLoading,
    refetch: refetchPlans,
  } = useQuery<PlanItem[]>({
    queryKey: ["customer-public-plans"],
    queryFn: async () => {
      const res = await api.get("/plans/public");
      return res.data;
    },
    staleTime: 60_000,
  });

  const handleScrollToPlans = () => {
    plansSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleUpgradeSuccess = (result: UpgradeResult) => {
    qc.invalidateQueries({ queryKey: ["customer-subscription-current"] });
    if (result.amount <= 0) {
      setSuccessBannerMsg(
        `Success! You have switched your organization to the ${result.planName || "new"} tier.`
      );
    }
  };

  // Detect if any quota is currently exceeded
  const quotaExceededResource = (() => {
    if (!currentSubData?.usage || !currentSubData?.effectiveLimits) return null;
    const { members, projects, servers } = currentSubData.usage;
    const { maxMembers, maxProjects, maxServers } = currentSubData.effectiveLimits;

    if (maxMembers > 0 && members >= maxMembers) {
      return { resource: "members", current: members, limit: maxMembers };
    }
    if (maxProjects > 0 && projects >= maxProjects) {
      return { resource: "projects", current: projects, limit: maxProjects };
    }
    if (maxServers > 0 && servers >= maxServers) {
      return { resource: "servers", current: servers, limit: maxServers };
    }
    return null;
  })();

  const isInitialLoading = isSubLoading || isPlansLoading;

  return (
    <PageShell>
      <PageHeader
        icon={CreditCard}
        title="Plan & Billing"
        subtitle="Manage your nORBIT subscription, monitor resource quotas, and upgrade your plan."
        crumbs={[
          { label: "Settings", href: "/" },
          { label: "Plan & Billing" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchCurrentSub();
                refetchPlans();
              }}
              title="Refresh Quotas & Plans"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Refresh</span>
            </button>
            <Link
              href="/billing"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors shadow-2xs"
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              <span>Invoices &amp; Payments</span>
            </Link>
          </div>
        }
      />

      {/* Success Notification */}
      {successBannerMsg && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-sm font-medium">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successBannerMsg}</span>
          </div>
          <button
            onClick={() => setSuccessBannerMsg(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quota Exceeded Banner (if any quota is full) */}
      {quotaExceededResource && (
        <LimitExceededBanner
          resource={quotaExceededResource.resource}
          current={quotaExceededResource.current}
          limit={quotaExceededResource.limit}
          onDismiss={() => {}}
        />
      )}

      {/* Loading Skeleton */}
      {isInitialLoading && (
        <div className="space-y-6 animate-pulse">
          <div className="h-64 bg-slate-200/70 rounded-3xl" />
          <div className="h-96 bg-slate-200/70 rounded-3xl" />
        </div>
      )}

      {/* Error State */}
      {isSubError && !isInitialLoading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-base font-bold text-rose-900">
            Failed to Load Subscription Information
          </h3>
          <p className="text-xs sm:text-sm text-rose-700 max-w-md mx-auto">
            {(() => {
              const e = subError as { response?: { data?: { message?: string } }; message?: string } | null;
              return e?.response?.data?.message || e?.message || "Could not retrieve active organization subscription details.";
            })()}
          </p>
          <button
            onClick={() => refetchCurrentSub()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Current Subscription Card */}
      {!isInitialLoading && currentSubData && (
        <div className="space-y-8">
          <SubscriptionOverviewCard
            data={currentSubData}
            onExplorePlans={handleScrollToPlans}
          />

          {/* Public Plans Comparison Section */}
          <div ref={plansSectionRef} className="space-y-4 pt-4">
            <PlanComparisonGrid
              plans={publicPlans}
              currentPlanId={currentSubData?.subscription?.planId}
              billingInterval={billingInterval}
              onIntervalChange={setBillingInterval}
              currency={currency}
              onCurrencyChange={setCurrency}
              onSelectUpgradePlan={(plan) => setSelectedPlanForUpgrade(plan)}
            />
          </div>

          {/* Payment & Security Assurance Footnote */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-slate-500 text-xs">
            <div className="flex items-start gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 font-bold mb-0.5">
                  Sovereign Multi-Tenant Isolation
                </strong>
                Data is strictly segmented per organization. Plan upgrades take effect immediately upon payment confirmation.
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl">
              <CreditCard className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 font-bold mb-0.5">
                  Flexible Dual Checkout
                </strong>
                Complete upgrades via Instant Online Checkout (UPI, Cards, NetBanking via Cashfree) or submit a Manual Bank Wire proof.
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl">
              <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900 font-bold mb-0.5">
                  Custom Enterprise Limits
                </strong>
                Need custom server volume or customized SLA agreements? Reach out to your sovereign administrator for tailored quota overrides.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Confirmation Modal */}
      <UpgradeConfirmModal
        isOpen={!!selectedPlanForUpgrade}
        onClose={() => setSelectedPlanForUpgrade(null)}
        plan={selectedPlanForUpgrade}
        billingInterval={billingInterval}
        currency={currency}
        onSuccess={handleUpgradeSuccess}
      />
    </PageShell>
  );
}
