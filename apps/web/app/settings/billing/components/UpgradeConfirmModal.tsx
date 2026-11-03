"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  ArrowRight,
  Loader2,
  AlertCircle,
  Users,
  FolderKanban,
  Server,
} from "lucide-react";
import { Modal } from "@/app/components/Modal";
import { api } from "@/src/lib/api";

export interface PlanItem {
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
}

export interface UpgradeResult {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  checkoutUrl: string;
  planName: string;
  billingInterval: string;
}

interface UpgradeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanItem | null;
  billingInterval: "MONTHLY" | "YEARLY";
  currency: "INR" | "USD";
  onSuccess?: (result: UpgradeResult) => void;
}

export function UpgradeConfirmModal({
  isOpen,
  onClose,
  plan,
  billingInterval,
  currency,
  onSuccess,
}: UpgradeConfirmModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!plan) return null;

  const isINR = currency === "INR";
  const isYearly = billingInterval === "YEARLY";

  const price = isINR
    ? isYearly
      ? plan.priceYearlyINR
      : plan.priceMonthlyINR
    : isYearly
    ? plan.priceYearlyUSD
    : plan.priceMonthlyUSD;

  const currencySymbol = isINR ? "₹" : "$";

  const handleConfirmUpgrade = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await api.post("/plans/upgrade", {
        planId: plan.id,
        billingInterval,
        currency,
      });

      const data = res.data;

      if (onSuccess) {
        onSuccess(data);
      }

      onClose();

      // If amount > 0, redirect to hosted payment checkout page
      if (data.checkoutUrl && data.amount > 0) {
        router.push(data.checkoutUrl);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to initiate upgrade. Please try again or contact support.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderLimitItem = (icon: React.ReactNode, label: string, val: number) => {
    return (
      <div className="flex items-center justify-between text-xs sm:text-sm py-1.5 border-b border-slate-100 last:border-0">
        <div className="flex items-center gap-2 text-slate-600">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-bold text-slate-900">
          {val <= 0 || val === -1 ? "Unlimited" : `${val} seats/units`}
        </span>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title="Confirm Subscription Upgrade"
      subtitle={`Upgrade to ${plan.name} Plan (${billingInterval.toLowerCase()} billing)`}
      maxWidth="max-w-md"
    >
      <div className="p-6 space-y-5">
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Plan summary badge */}
        <div className="bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-slate-50 border border-indigo-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Target Plan
              </span>
              <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-indigo-700">
                {price > 0 ? `${currencySymbol}${price.toLocaleString("en-IN")}` : "Free"}
              </span>
              <span className="text-xs text-slate-500 block font-medium">
                {isYearly ? "/ year" : "/ month"}
              </span>
            </div>
          </div>

          {plan.description && (
            <p className="text-xs text-slate-600 mt-2 font-medium">
              {plan.description}
            </p>
          )}
        </div>

        {/* Quota Highlights */}
        <div className="space-y-1 bg-slate-50/80 border border-slate-200/70 rounded-xl p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            New Included Capacity
          </span>
          {renderLimitItem(
            <Users className="w-3.5 h-3.5 text-indigo-600" />,
            "Team Members",
            plan.maxMembers
          )}
          {renderLimitItem(
            <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />,
            "Projects",
            plan.maxProjects
          )}
          {renderLimitItem(
            <Server className="w-3.5 h-3.5 text-indigo-600" />,
            "BYOVPS Servers",
            plan.maxServers
          )}
        </div>

        {/* Billing note */}
        <div className="text-xs text-slate-500 space-y-1 leading-relaxed bg-blue-50/50 p-3 rounded-xl border border-blue-100">
          <div className="flex items-center gap-1.5 font-bold text-blue-900">
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            <span>Seamless Checkout</span>
          </div>
          <p>
            An official invoice will be generated. You can pay securely via{" "}
            <strong>Cashfree (Cards, NetBanking, UPI)</strong> or upload a{" "}
            <strong>Manual Bank Transfer / UPI proof</strong>.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleConfirmUpgrade}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Invoice...</span>
              </>
            ) : (
              <>
                <span>Confirm &amp; Proceed</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
