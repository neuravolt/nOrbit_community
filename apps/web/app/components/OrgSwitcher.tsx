"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { useAuthStore } from "@/src/store/auth";
import { Building2, Check, ChevronDown, Plus, Shield } from "lucide-react";
import Link from "next/link";

interface OrgItem {
  id: string;
  name: string;
  domain?: string | null;
  role: string;
  isCurrent: boolean;
  memberCount: number;
}

export function OrgSwitcher() {
  const { user, setUser, setTokens } = useAuthStore();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: organizations, isLoading } = useQuery<OrgItem[]>({
    queryKey: ["my-organizations"],
    queryFn: async () => {
      const { data } = await api.get("/organizations/my");
      return data;
    },
    enabled: (user as any)?.userType === "CUSTOMER",
  });

  const switchMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { data } = await api.post("/auth/switch-org", {
        organizationId: orgId,
      });
      return data;
    },
    onSuccess: (data) => {
      const accessToken = data.accessToken || data.tokens?.accessToken;
      const refreshToken = data.refreshToken || data.tokens?.refreshToken;
      if (accessToken && refreshToken) {
        setTokens(accessToken, refreshToken);
      }
      if (data.user) {
        setUser(data.user);
      }
      queryClient.invalidateQueries();
      setIsOpen(false);
      window.location.reload();
    },
  });

  if ((user as any)?.userType !== "CUSTOMER" || !organizations || organizations.length === 0) {
    return null;
  }

  const currentOrg = organizations.find((o) => o.isCurrent) || organizations[0];

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm text-xs font-semibold text-slate-800"
      >
        <div className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
          {currentOrg?.name?.charAt(0).toUpperCase()}
        </div>
        <span className="max-w-[130px] truncate">{currentOrg?.name}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-1 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 p-2 animate-in fade-in zoom-in-95">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Organizations
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => switchMutation.mutate(org.id)}
                  disabled={switchMutation.isPending || org.isCurrent}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition ${
                    org.isCurrent
                      ? "bg-indigo-50 font-semibold text-indigo-700"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                        org.isCurrent
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="truncate font-medium">{org.name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">
                        {org.role.toLowerCase()} · {org.memberCount} member
                        {org.memberCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  {org.isCurrent && (
                    <Check size={14} className="text-indigo-600 ml-2" />
                  )}
                </button>
              ))}
            </div>

            <div className="pt-2 mt-2 border-t border-slate-100">
              <Link
                href="/onboarding"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition"
              >
                <Plus size={14} />
                Create New Organization
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
