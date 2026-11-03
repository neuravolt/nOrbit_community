"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/lib/api";

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  // Query real backend flags. Flags with no row yet default to enabled (opt-out model) —
  // only an explicit `enabled: false` row disables a feature.
  const { data: flags } = useQuery<Record<string, boolean>>({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const { data } = await api.get("/launchpad/feature-flags");
      return data;
    },
    staleTime: 60_000,
  });

  const isEnabled = flags && feature in flags ? !!flags[feature] : true;

  if (!isEnabled) {
    return (
      fallback || (
        <div className="border border-slate-200 bg-white p-6 rounded-xl text-center space-y-2">
          <h3 className="font-bold text-slate-900">Feature Coming Soon</h3>
          <p className="text-sm text-slate-500">This module is currently disabled for maintenance. Check back later.</p>
        </div>
      )
    );
  }

  return <>{children}</>;
}
