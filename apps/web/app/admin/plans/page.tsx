"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/src/store/auth";
import { api } from "@/src/lib/api";
import { PageShell, PageHeader, Tabs, Button } from "@/src/components/ui/page";
import {
  Sparkles,
  Layers,
  Building2,
  Plus,
  ShieldX,
  Globe,
  Lock,
  RefreshCw,
} from "lucide-react";
import { Plan, AdminOrganizationRow } from "./types";
import { PlanListTable } from "./components/PlanListTable";
import { PlanModal } from "./components/PlanModal";
import { OrgAssignmentTable } from "./components/OrgAssignmentTable";
import { OverrideModal } from "./components/OverrideModal";
import Link from "next/link";

export default function AdminPlansPage() {
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"plans" | "organizations">("plans");
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<Plan | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  const [selectedOrgForOverride, setSelectedOrgForOverride] = useState<AdminOrganizationRow | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  const [orgSearch, setOrgSearch] = useState("");
  const [orgPlanFilter, setOrgPlanFilter] = useState("");

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Query: All plans (active, inactive, public, private)
  const {
    data: plans = [],
    isLoading: isLoadingPlans,
    isRefetching: isRefetchingPlans,
    refetch: refetchPlans,
  } = useQuery<Plan[]>({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const res = await api.get("/admin/plans");
      return res.data;
    },
    enabled: !!isAuthenticated && isSuperAdmin,
  });

  // Query: Organizations with active subscriptions and usage
  const {
    data: organizations = [],
    isLoading: isLoadingOrgs,
    isRefetching: isRefetchingOrgs,
    refetch: refetchOrgs,
  } = useQuery<AdminOrganizationRow[]>({
    queryKey: ["admin-organizations", orgSearch, orgPlanFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (orgSearch.trim()) params.search = orgSearch.trim();
      if (orgPlanFilter) params.planId = orgPlanFilter;
      const res = await api.get("/admin/organizations", { params });
      return res.data;
    },
    enabled: !!isAuthenticated && isSuperAdmin,
  });

  // Strict Super Admin Access Control Gate
  if (!isAuthenticated || !isSuperAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="text-center max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Super Admin Access Required</h2>
          <p className="text-slate-500 text-sm mb-6">
            Only Super Administrators on the internal sovereign workspace{" "}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">
              teams.neuravolt.in
            </code>{" "}
            are authorized to manage SaaS subscription tiers and customer quotas.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Metrics summary calculations
  const totalPlansCount = plans.length;
  const activePublicCount = plans.filter((p) => p.isActive && p.isPublic).length;
  const privatePlansCount = plans.filter((p) => !p.isPublic).length;
  const totalOrgsCount = organizations.length;

  const handleOpenCreatePlan = () => {
    setSelectedPlanForEdit(null);
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: Plan) => {
    setSelectedPlanForEdit(plan);
    setIsPlanModalOpen(true);
  };

  const handleOpenManageOrg = (org: AdminOrganizationRow) => {
    setSelectedOrgForOverride(org);
    setIsOverrideModalOpen(true);
  };

  const handleRefreshAll = () => {
    refetchPlans();
    refetchOrgs();
  };

  return (
    <PageShell>
      {/* Page Header */}
      <PageHeader
        icon={Sparkles}
        tone="indigo"
        title="SaaS Plans & Subscription Management"
        subtitle="Manage dynamic pricing tiers, resource quotas, and manual customer organization overrides."
        crumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Settings", href: "/settings" },
          { label: "SaaS Plans" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleRefreshAll}
              disabled={isRefetchingPlans || isRefetchingOrgs}
              className="text-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefetchingPlans || isRefetchingOrgs ? "animate-spin text-indigo-600" : ""
                }`}
              />
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={handleOpenCreatePlan}
              className="text-xs"
            >
              <Plus className="w-4 h-4" />
              Create Plan
            </Button>
          </div>
        }
      />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Plans</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalPlansCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Configured subscription tiers</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Public Tiers</span>
            <Globe className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{activePublicCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Visible on norbit self-serve billing</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Private Tiers</span>
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{privatePlansCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Enterprise & custom offline deals</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Organizations</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{totalOrgsCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Registered customer tenants</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        tabs={[
          {
            key: "plans",
            label: "Subscription Plans",
            icon: Layers,
            count: totalPlansCount,
          },
          {
            key: "organizations",
            label: "Organization Subscriptions & Overrides",
            icon: Building2,
            count: totalOrgsCount,
          },
        ]}
        value={activeTab}
        onChange={(tab) => setActiveTab(tab as "plans" | "organizations")}
      />

      {/* Tab 1: Subscription Plans CRUD */}
      {activeTab === "plans" && (
        <PlanListTable
          plans={plans}
          isLoading={isLoadingPlans}
          onEditPlan={handleOpenEditPlan}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-plans"] })}
        />
      )}

      {/* Tab 2: Organization Subscriptions & Overrides */}
      {activeTab === "organizations" && (
        <OrgAssignmentTable
          organizations={organizations}
          plans={plans}
          isLoading={isLoadingOrgs}
          search={orgSearch}
          onSearchChange={setOrgSearch}
          selectedPlanFilter={orgPlanFilter}
          onPlanFilterChange={setOrgPlanFilter}
          onManageOrg={handleOpenManageOrg}
        />
      )}

      {/* Create / Edit Plan Modal */}
      {isPlanModalOpen && (
        <PlanModal
          key={selectedPlanForEdit?.id || "new-plan"}
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          plan={selectedPlanForEdit}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["admin-plans"] });
            qc.invalidateQueries({ queryKey: ["admin-organizations"] });
          }}
        />
      )}

      {/* Assign Plan & Custom Overrides Modal */}
      {isOverrideModalOpen && selectedOrgForOverride && (
        <OverrideModal
          key={selectedOrgForOverride.id}
          isOpen={isOverrideModalOpen}
          onClose={() => setIsOverrideModalOpen(false)}
          organization={selectedOrgForOverride}
          availablePlans={plans}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["admin-organizations"] });
          }}
        />
      )}
    </PageShell>
  );
}
