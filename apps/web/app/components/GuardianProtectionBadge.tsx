"use client";

import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2 } from "lucide-react";
import { useGuardianAssetProtectionStatus } from "../../src/hooks/queries";

// Guardian WordPress-security plan §5: confirmed this session that NO UI anywhere renders any
// Guardian scan result — this is the first, not an addition to an existing pattern. Reuses the
// same 3(+1)-tier color convention already proven for the SSL-expiry badge elsewhere in this
// dashboard (emerald/amber/rose), plus a 4th "never scanned" state that must render visibly
// differently from "protected" — an unscanned site must never look identical to a verified-clean
// one.
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function GuardianProtectionBadge({ assetId, compact = false }: { assetId: string; compact?: boolean }) {
  const { data, isLoading } = useGuardianAssetProtectionStatus(assetId);

  const base = compact
    ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
    : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border";

  if (isLoading) {
    return (
      <span className={`${base} bg-slate-50 text-slate-500 border-slate-200`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...
      </span>
    );
  }

  if (!data || data.status === "never_scanned") {
    return (
      <span className={`${base} bg-slate-50 text-slate-500 border-slate-200`} title="No Guardian security scan has run for this asset yet.">
        <ShieldQuestion className="w-3.5 h-3.5" /> Not yet scanned
      </span>
    );
  }

  if (data.status === "issues_found") {
    const summary = data.findings[0]?.summary || "Issue found";
    return (
      <span className={`${base} bg-rose-50 text-rose-700 border-rose-200`} title={data.findings.map((f) => f.summary).join(" | ")}>
        <ShieldAlert className="w-3.5 h-3.5" /> {compact ? "Issue found" : summary}
      </span>
    );
  }

  if (data.status === "stale") {
    return (
      <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`} title="No clean check within the last 48 hours — this isn't a confirmed 'protected' state.">
        <ShieldQuestion className="w-3.5 h-3.5" /> {compact ? "Needs rescan" : `Needs rescan${data.lastCheckedAt ? ` · last checked ${relativeTime(data.lastCheckedAt)}` : ""}`}
      </span>
    );
  }

  return (
    <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>
      <ShieldCheck className="w-3.5 h-3.5" />
      {compact ? "Protected" : `Protected${data.lastCheckedAt ? ` · checked ${relativeTime(data.lastCheckedAt)}` : ""}`}
    </span>
  );
}
