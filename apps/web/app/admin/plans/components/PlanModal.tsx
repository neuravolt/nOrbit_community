"use client";

import { useState } from "react";
import axios from "axios";
import { Modal, FormField, inputCls, textareaCls } from "@/app/components/Modal";
import { Plan, PlanFormData } from "../types";
import { api } from "@/src/lib/api";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: Plan | null;
  onSuccess: () => void;
}

const DEFAULT_FORM: PlanFormData = {
  name: "",
  slug: "",
  description: "",
  priceMonthlyINR: 0,
  priceYearlyINR: 0,
  priceMonthlyUSD: 0,
  priceYearlyUSD: 0,
  maxMembers: 5,
  maxProjects: 10,
  maxServers: 1,
  featureProjectsTasks: true,
  featureCrm: true,
  featureBilling: true,
  featureGuardianByovps: true,
  featureClientPortal: false,
  featureApiAccess: false,
  isPublic: true,
  isActive: true,
  sortOrder: 1,
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getInitialForm(plan?: Plan | null): PlanFormData {
  if (plan) {
    return {
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      priceMonthlyINR: plan.priceMonthlyINR,
      priceYearlyINR: plan.priceYearlyINR,
      priceMonthlyUSD: plan.priceMonthlyUSD,
      priceYearlyUSD: plan.priceYearlyUSD,
      maxMembers: plan.maxMembers,
      maxProjects: plan.maxProjects,
      maxServers: plan.maxServers,
      featureProjectsTasks: plan.featureProjectsTasks,
      featureCrm: plan.featureCrm,
      featureBilling: plan.featureBilling,
      featureGuardianByovps: plan.featureGuardianByovps,
      featureClientPortal: plan.featureClientPortal,
      featureApiAccess: plan.featureApiAccess,
      isPublic: plan.isPublic,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    };
  }
  return DEFAULT_FORM;
}

export function PlanModal({ isOpen, onClose, plan, onSuccess }: PlanModalProps) {
  const isEdit = !!plan;
  const [form, setForm] = useState<PlanFormData>(() => getInitialForm(plan));
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!plan);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (name: string) => {
    if (!slugManuallyEdited && !isEdit) {
      setForm((prev) => ({ ...prev, name, slug: slugify(name) }));
    } else {
      setForm((prev) => ({ ...prev, name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Plan name is required");
      return;
    }
    if (!form.slug.trim()) {
      setError("Plan slug is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        description: form.description.trim() || undefined,
        priceMonthlyINR: Number(form.priceMonthlyINR) || 0,
        priceYearlyINR: Number(form.priceYearlyINR) || 0,
        priceMonthlyUSD: Number(form.priceMonthlyUSD) || 0,
        priceYearlyUSD: Number(form.priceYearlyUSD) || 0,
        maxMembers: Number(form.maxMembers),
        maxProjects: Number(form.maxProjects),
        maxServers: Number(form.maxServers),
        featureProjectsTasks: !!form.featureProjectsTasks,
        featureCrm: !!form.featureCrm,
        featureBilling: !!form.featureBilling,
        featureGuardianByovps: !!form.featureGuardianByovps,
        featureClientPortal: !!form.featureClientPortal,
        featureApiAccess: !!form.featureApiAccess,
        isPublic: !!form.isPublic,
        isActive: !!form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      };

      if (isEdit && plan) {
        await api.patch(`/admin/plans/${plan.id}`, payload);
      } else {
        await api.post("/admin/plans", payload);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      let msg = "Failed to save plan";
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
      title={isEdit ? `Edit Plan: ${plan.name}` : "Create New Subscription Plan"}
      subtitle="Configure pricing, resource quotas, feature access, and self-serve visibility."
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1">
            General Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Plan Name" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Starter, Pro, Enterprise"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Plan Slug" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. starter, pro-tier"
                value={form.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setForm((prev) => ({ ...prev, slug: e.target.value }));
                }}
                required
              />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea
              className={textareaCls}
              rows={2}
              placeholder="Brief description of who this plan is tailored for..."
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </FormField>
          <div className="w-full sm:w-1/3">
            <FormField label="Display Sort Order">
              <input
                type="number"
                className={inputCls}
                value={form.sortOrder}
                onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value, 10) || 0 }))}
              />
            </FormField>
          </div>
        </div>

        {/* Section 2: Dual Currency Pricing */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1 flex items-center justify-between">
            <span>Pricing (INR & USD)</span>
            <span className="text-xs font-normal text-slate-500">Monthly & Annual Intervals</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Monthly (INR ₹)">
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.priceMonthlyINR}
                onChange={(e) => setForm((prev) => ({ ...prev, priceMonthlyINR: parseFloat(e.target.value) || 0 }))}
              />
            </FormField>
            <FormField label="Yearly (INR ₹)">
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.priceYearlyINR}
                onChange={(e) => setForm((prev) => ({ ...prev, priceYearlyINR: parseFloat(e.target.value) || 0 }))}
              />
            </FormField>
            <FormField label="Monthly (USD $)">
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.priceMonthlyUSD}
                onChange={(e) => setForm((prev) => ({ ...prev, priceMonthlyUSD: parseFloat(e.target.value) || 0 }))}
              />
            </FormField>
            <FormField label="Yearly (USD $)">
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.priceYearlyUSD}
                onChange={(e) => setForm((prev) => ({ ...prev, priceYearlyUSD: parseFloat(e.target.value) || 0 }))}
              />
            </FormField>
          </div>
        </div>

        {/* Section 3: Quotas & Resource Limits */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Resource Quota Limits</h3>
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">
              -1 or 0 = Unlimited
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Max Members / Users">
              <input
                type="number"
                className={inputCls}
                value={form.maxMembers}
                onChange={(e) => setForm((prev) => ({ ...prev, maxMembers: parseInt(e.target.value, 10) || 0 }))}
              />
              <p className="text-[11px] text-slate-500 mt-1">Total allowed seats & invitations</p>
            </FormField>
            <FormField label="Max Projects">
              <input
                type="number"
                className={inputCls}
                value={form.maxProjects}
                onChange={(e) => setForm((prev) => ({ ...prev, maxProjects: parseInt(e.target.value, 10) || 0 }))}
              />
              <p className="text-[11px] text-slate-500 mt-1">Simultaneous active projects</p>
            </FormField>
            <FormField label="Max Servers (Guardian)">
              <input
                type="number"
                className={inputCls}
                value={form.maxServers}
                onChange={(e) => setForm((prev) => ({ ...prev, maxServers: parseInt(e.target.value, 10) || 0 }))}
              />
              <p className="text-[11px] text-slate-500 mt-1">BYOVPS monitored nodes</p>
            </FormField>
          </div>
        </div>

        {/* Section 4: Feature Toggles */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1">
            Feature Permissions & Modules
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                checked={form.featureProjectsTasks}
                onChange={(e) => setForm((prev) => ({ ...prev, featureProjectsTasks: e.target.checked }))}
              />
              <div>
                <span className="font-medium text-slate-800">Projects & Tasks</span>
                <p className="text-xs text-slate-500">Kanban boards, backlog, sprints</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                checked={form.featureCrm}
                onChange={(e) => setForm((prev) => ({ ...prev, featureCrm: e.target.checked }))}
              />
              <div>
                <span className="font-medium text-slate-800">CRM & Leads Pipeline</span>
                <p className="text-xs text-slate-500">Lead capture, deals, conversion tracking</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                checked={form.featureBilling}
                onChange={(e) => setForm((prev) => ({ ...prev, featureBilling: e.target.checked }))}
              />
              <div>
                <span className="font-medium text-slate-800">Billing & Invoicing</span>
                <p className="text-xs text-slate-500">GST tax invoices, payment receipts</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                checked={form.featureGuardianByovps}
                onChange={(e) => setForm((prev) => ({ ...prev, featureGuardianByovps: e.target.checked }))}
              />
              <div>
                <span className="font-medium text-slate-800">Guardian BYOVPS Fleet</span>
                <p className="text-xs text-slate-500">Server monitoring & SRE alerting</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                checked={form.featureClientPortal}
                onChange={(e) => setForm((prev) => ({ ...prev, featureClientPortal: e.target.checked }))}
              />
              <div>
                <span className="font-medium text-slate-800">Client Portal</span>
                <p className="text-xs text-slate-500">External client access & ticket portal</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                checked={form.featureApiAccess}
                onChange={(e) => setForm((prev) => ({ ...prev, featureApiAccess: e.target.checked }))}
              />
              <div>
                <span className="font-medium text-slate-800">REST API & Webhooks</span>
                <p className="text-xs text-slate-500">Programmatic API keys for integrations</p>
              </div>
            </label>
          </div>
        </div>

        {/* Section 5: Visibility & Active Status */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1">
            Status & Self-Serve Visibility
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                checked={form.isPublic}
                onChange={(e) => setForm((prev) => ({ ...prev, isPublic: e.target.checked }))}
              />
              <div>
                <span className="font-medium text-slate-800 block">Public Self-Serve Listing</span>
                <p className="text-xs text-slate-500">
                  Visible on customer billing page for direct self-serve upgrades. If unchecked, plan remains private for custom quotes.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <div>
                <span className="font-medium text-slate-800 block">Active Status</span>
                <p className="text-xs text-slate-500">
                  Plan is currently operational. Deactivating a plan prevents new organizations from subscribing.
                </p>
              </div>
            </label>
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
                Saving...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {isEdit ? "Update Plan" : "Create Plan"}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
