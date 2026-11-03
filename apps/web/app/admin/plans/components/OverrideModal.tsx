"use client";

import { useState } from "react";
import axios from "axios";
import { Modal, FormField, inputCls, selectCls } from "@/app/components/Modal";
import { AdminOrganizationRow, OverrideFormData, Plan } from "../types";
import { api } from "@/src/lib/api";
import { Loader2, ShieldAlert, Sparkles, Calendar, Layers } from "lucide-react";

interface OverrideModalProps {
  organization: AdminOrganizationRow | null;
  availablePlans: Plan[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_FORM: OverrideFormData = {
  planId: "",
  status: "ACTIVE",
  billingInterval: "MONTHLY",
  currency: "INR",
  customMaxMembers: "",
  customMaxProjects: "",
  customMaxServers: "",
  expiresAt: "",
  trialExpiresAt: "",
};

function getInitialOverrideForm(
  organization: AdminOrganizationRow | null,
  availablePlans: Plan[]
): OverrideFormData {
  if (organization) {
    const sub = organization.subscription;
    return {
      planId: sub?.planId || availablePlans[0]?.id || "",
      status: sub?.status || "ACTIVE",
      billingInterval: sub?.billingInterval || "MONTHLY",
      currency: sub?.currency || "INR",
      customMaxMembers:
        sub?.customMaxMembers !== null && sub?.customMaxMembers !== undefined
          ? String(sub.customMaxMembers)
          : "",
      customMaxProjects:
        sub?.customMaxProjects !== null && sub?.customMaxProjects !== undefined
          ? String(sub.customMaxProjects)
          : "",
      customMaxServers:
        sub?.customMaxServers !== null && sub?.customMaxServers !== undefined
          ? String(sub.customMaxServers)
          : "",
      expiresAt: sub?.expiresAt ? sub.expiresAt.substring(0, 10) : "",
      trialExpiresAt: sub?.trialExpiresAt ? sub.trialExpiresAt.substring(0, 10) : "",
    };
  }
  return DEFAULT_FORM;
}

export function OverrideModal({
  organization,
  availablePlans,
  isOpen,
  onClose,
  onSuccess,
}: OverrideModalProps) {
  const [form, setForm] = useState<OverrideFormData>(() =>
    getInitialOverrideForm(organization, availablePlans)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!organization) return null;

  const selectedPlan = availablePlans.find((p) => p.id === form.planId);

  const applyQuickDate = (field: "expiresAt" | "trialExpiresAt", daysToAdd: number | null) => {
    if (daysToAdd === null) {
      setForm((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    const dateStr = d.toISOString().substring(0, 10);
    setForm((prev) => ({ ...prev, [field]: dateStr }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload: {
        planId?: string;
        status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED';
        billingInterval: 'MONTHLY' | 'YEARLY';
        currency: 'INR' | 'USD';
        customMaxMembers: number | null;
        customMaxProjects: number | null;
        customMaxServers: number | null;
        expiresAt: string | null;
        trialExpiresAt: string | null;
      } = {
        planId: form.planId || undefined,
        status: form.status,
        billingInterval: form.billingInterval,
        currency: form.currency,
        customMaxMembers:
          form.customMaxMembers.trim() === "" ? null : Number(form.customMaxMembers),
        customMaxProjects:
          form.customMaxProjects.trim() === "" ? null : Number(form.customMaxProjects),
        customMaxServers:
          form.customMaxServers.trim() === "" ? null : Number(form.customMaxServers),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        trialExpiresAt: form.trialExpiresAt ? new Date(form.trialExpiresAt).toISOString() : null,
      };

      await api.patch(`/admin/organizations/${organization.id}/subscription`, payload);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      let msg = "Failed to update subscription";
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        const serverMsg = err.response.data.message;
        msg = Array.isArray(serverMsg) ? serverMsg.join(", ") : String(serverMsg);
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Subscription & Overrides: ${organization.name}`}
      subtitle={`Configure plan tier, custom resource limits, and expiry dates for ${organization.domain || organization.name}.`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Usage Summary */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-800">Current Usage:</span>{" "}
            {organization.usage.members} members (effective limit:{" "}
            {organization.usage.effectiveMaxMembers <= 0
              ? "Unlimited"
              : organization.usage.effectiveMaxMembers}
            ), {organization.usage.servers} servers (effective limit:{" "}
            {organization.usage.effectiveMaxServers <= 0
              ? "Unlimited"
              : organization.usage.effectiveMaxServers}
            ), {organization.usage.projects} projects (effective limit:{" "}
            {organization.usage.effectiveMaxProjects <= 0
              ? "Unlimited"
              : organization.usage.effectiveMaxProjects}
            )
          </div>
        </div>

        {/* Section 1: Plan Tier & Subscription Status */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Plan Tier & Billing Cycle</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Assigned Plan Tier" required>
              <select
                className={selectCls}
                value={form.planId}
                onChange={(e) => setForm((prev) => ({ ...prev, planId: e.target.value }))}
                required
              >
                {availablePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug}) — ₹{p.priceMonthlyINR.toLocaleString()}/mo / ${p.priceMonthlyUSD}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Subscription Status" required>
              <select
                className={selectCls}
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED',
                  }))
                }
                required
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="TRIAL">TRIAL</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Billing Interval">
              <select
                className={selectCls}
                value={form.billingInterval}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    billingInterval: e.target.value as 'MONTHLY' | 'YEARLY',
                  }))
                }
              >
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </FormField>

            <FormField label="Billing Currency">
              <select
                className={selectCls}
                value={form.currency}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    currency: e.target.value as 'INR' | 'USD',
                  }))
                }
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </FormField>
          </div>
        </div>

        {/* Section 2: Custom Resource Quota Overrides */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Custom Resource Limit Overrides</span>
            </h3>
            <span className="text-[11px] text-slate-500">
              Leave blank to inherit base plan limit
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label={`Max Members (Base: ${
                selectedPlan
                  ? selectedPlan.maxMembers <= 0
                    ? "Unlimited"
                    : selectedPlan.maxMembers
                  : "5"
              })`}
            >
              <input
                type="number"
                className={inputCls}
                placeholder={`Default (${selectedPlan?.maxMembers ?? 5})`}
                value={form.customMaxMembers}
                onChange={(e) => setForm((prev) => ({ ...prev, customMaxMembers: e.target.value }))}
              />
              <p className="text-[11px] text-slate-500 mt-1">Leave empty or -1 for unlimited</p>
            </FormField>

            <FormField
              label={`Max Projects (Base: ${
                selectedPlan
                  ? selectedPlan.maxProjects <= 0
                    ? "Unlimited"
                    : selectedPlan.maxProjects
                  : "10"
              })`}
            >
              <input
                type="number"
                className={inputCls}
                placeholder={`Default (${selectedPlan?.maxProjects ?? 10})`}
                value={form.customMaxProjects}
                onChange={(e) => setForm((prev) => ({ ...prev, customMaxProjects: e.target.value }))}
              />
              <p className="text-[11px] text-slate-500 mt-1">Leave empty or -1 for unlimited</p>
            </FormField>

            <FormField
              label={`Max Servers (Base: ${
                selectedPlan
                  ? selectedPlan.maxServers <= 0
                    ? "Unlimited"
                    : selectedPlan.maxServers
                  : "1"
              })`}
            >
              <input
                type="number"
                className={inputCls}
                placeholder={`Default (${selectedPlan?.maxServers ?? 1})`}
                value={form.customMaxServers}
                onChange={(e) => setForm((prev) => ({ ...prev, customMaxServers: e.target.value }))}
              />
              <p className="text-[11px] text-slate-500 mt-1">Leave empty or -1 for unlimited</p>
            </FormField>
          </div>
        </div>

        {/* Section 3: Subscription & Trial Expiry Extension */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Expiry & Trial Extension</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FormField label="Subscription Expiry Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.expiresAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => applyQuickDate("expiresAt", 30)}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                >
                  +30 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDate("expiresAt", 365)}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                >
                  +1 Year
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDate("expiresAt", null)}
                  className="text-[11px] px-2 py-0.5 text-rose-600 hover:bg-rose-50 rounded transition"
                >
                  Clear Expiry
                </button>
              </div>
            </div>

            <div>
              <FormField label="Trial Expiry Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.trialExpiresAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, trialExpiresAt: e.target.value }))}
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => applyQuickDate("trialExpiresAt", 14)}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                >
                  +14 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDate("trialExpiresAt", 30)}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                >
                  +30 Days
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDate("trialExpiresAt", null)}
                  className="text-[11px] px-2 py-0.5 text-rose-600 hover:bg-rose-50 rounded transition"
                >
                  Clear Trial
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Save Subscription & Overrides
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
