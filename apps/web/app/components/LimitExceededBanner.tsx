"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, Sparkles, ArrowRight, X } from "lucide-react";

export interface LimitExceededPayload {
  code?: string;
  resource?: "members" | "projects" | "servers" | string;
  limit?: number;
  current?: number;
  message?: string;
  upgradeUrl?: string;
}

export interface RawErrorPayload {
  code?: string;
  error?: string;
  resource?: "members" | "projects" | "servers" | string;
  limitKey?: string;
  limit?: number;
  current?: number;
  currentUsage?: number;
  message?: string;
  upgradeUrl?: string;
  response?: {
    data?: RawErrorPayload;
  };
}

export interface LimitExceededBannerProps {
  /** Can be an Axios error, an error response object, or a parsed payload */
  error?: unknown;
  /** Explicit override for the resource type */
  resource?: "members" | "projects" | "servers" | string;
  /** Explicit current usage */
  current?: number;
  /** Explicit limit */
  limit?: number;
  /** Explicit custom message */
  message?: string;
  /** Custom destination for the upgrade CTA, defaults to /settings/billing */
  upgradeUrl?: string;
  /** Optional callback to close / dismiss the banner */
  onDismiss?: () => void;
  /** Optional container class name */
  className?: string;
  /** If true, renders a compact single-line banner */
  compact?: boolean;
}

/**
 * Utility helper to determine if an error object represents a LIMIT_EXCEEDED error.
 */
export function isLimitExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as RawErrorPayload;
  if (e.code === "LIMIT_EXCEEDED") return true;
  if (e.response?.data?.code === "LIMIT_EXCEEDED") return true;
  if (e.response?.data?.error === "LIMIT_EXCEEDED") return true;
  return false;
}

export function extractLimitPayload(err: unknown): LimitExceededPayload | null {
  if (!err || typeof err !== "object") return null;
  const e = err as RawErrorPayload;
  const data = e.response?.data || e;
  if (data.code === "LIMIT_EXCEEDED" || data.error === "LIMIT_EXCEEDED") {
    return {
      code: "LIMIT_EXCEEDED",
      resource: data.resource || (data.limitKey ? data.limitKey.replace(/^max/, "").toLowerCase() : undefined),
      limit: data.limit !== undefined ? Number(data.limit) : undefined,
      current: data.current !== undefined ? Number(data.current) : (data.currentUsage !== undefined ? Number(data.currentUsage) : undefined),
      message: data.message,
      upgradeUrl: data.upgradeUrl || "/settings/billing",
    };
  }
  return null;
}

export function LimitExceededBanner({
  error,
  resource: propResource,
  current: propCurrent,
  limit: propLimit,
  message: propMessage,
  upgradeUrl: propUpgradeUrl,
  onDismiss,
  className = "",
  compact = false,
}: LimitExceededBannerProps) {
  const parsed = extractLimitPayload(error);

  // If error was passed but is not a LIMIT_EXCEEDED error and no explicit propMessage was provided, do not render
  if (error && !parsed && !propMessage && !propResource) {
    return null;
  }

  const resource = propResource || parsed?.resource || "resource";
  const current = propCurrent !== undefined ? propCurrent : parsed?.current;
  const limit = propLimit !== undefined ? propLimit : parsed?.limit;
  const upgradeUrl = propUpgradeUrl || parsed?.upgradeUrl || "/settings/billing";

  const getResourceLabel = (res: string) => {
    switch (res.toLowerCase()) {
      case "members":
        return "Team Members";
      case "servers":
        return "Guardian BYOVPS Servers";
      case "projects":
        return "Active Projects";
      default:
        return res.charAt(0).toUpperCase() + res.slice(1);
    }
  };

  const defaultMessage = (() => {
    if (parsed?.message) return parsed.message;
    if (propMessage) return propMessage;
    const label = getResourceLabel(resource);
    if (current !== undefined && limit !== undefined) {
      return `You have reached your limit of ${limit} ${label.toLowerCase()} (${current}/${limit} used). Upgrade your plan to increase this quota.`;
    }
    return `You have reached the maximum quota for ${label.toLowerCase()} on your current plan. Please upgrade to continue.`;
  })();

  if (compact) {
    return (
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-sm ${className}`}
        role="alert"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-semibold text-xs uppercase tracking-wide px-1.5 py-0.5 bg-amber-200/70 rounded text-amber-800 shrink-0">
            Limit Reached
          </span>
          <span className="truncate text-xs font-medium text-amber-900">{defaultMessage}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={upgradeUrl}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>Upgrade</span>
          </Link>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-100 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 p-4 sm:p-5 shadow-sm text-slate-800 ${className}`}
      role="alert"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Quota Limit Exceeded
              </h4>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
                {getResourceLabel(resource)}
                {current !== undefined && limit !== undefined && ` (${current}/${limit})`}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {defaultMessage}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500 font-medium">
          Unlock higher resource capacity and enterprise features instantly.
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={upgradeUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm shadow-indigo-200 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Upgrade Plan &amp; Quotas</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
