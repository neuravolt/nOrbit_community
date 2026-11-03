"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

/**
 * nORBIT's page kit (light, minimal): header with an icon tile, underline tabs, badges, buttons,
 * a search/filter toolbar and a table card. Pages keep their own data and logic.
 */

export function PageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-5 ${className}`}>{children}</div>;
}

export function PageHeader({
  icon: Icon, title, subtitle, crumbs, badges, actions, tone = "indigo",
}: {
  icon?: any;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  crumbs?: { label: string; href?: string }[];
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "indigo" | "violet" | "emerald" | "amber" | "rose" | "sky";
}) {
  const tile: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100", violet: "bg-violet-50 text-violet-600 border-violet-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100", amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100", sky: "bg-sky-50 text-sky-600 border-sky-100",
  };
  return (
    <div className="space-y-3 border-b border-slate-200 pb-5">
      {crumbs && crumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5" />}
              {c.href ? <Link href={c.href} className="hover:text-indigo-600">{c.label}</Link> : <span className="text-slate-700 font-semibold">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && <div className={`w-12 h-12 shrink-0 rounded-2xl border flex items-center justify-center ${tile[tone]}`}><Icon className="w-6 h-6" /></div>}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
              {badges}
            </div>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Underline tabs with an optional count badge (like the Guardian server page). */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; icon?: any; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
      {tabs.map(({ key, label, icon: Icon, count }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 -mb-px text-sm font-semibold whitespace-nowrap transition ${value === key ? "border-indigo-500 text-indigo-600 bg-indigo-50/50" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
          {Icon && <Icon className="w-4 h-4" />}
          {label}
          {count !== undefined && count > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export type BadgeTone = "green" | "red" | "amber" | "blue" | "violet" | "slate" | "sky";
const BADGE: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200", red: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200", blue: "bg-blue-50 text-blue-700 border-blue-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200", slate: "bg-slate-100 text-slate-600 border-slate-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
};
export function Badge({ tone = "slate", children, dot }: { tone?: BadgeTone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${BADGE[tone]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** A status word to a badge colour (paid/active/done green, overdue/failed red, pending amber...). */
export function statusTone(status?: string | null): BadgeTone {
  const s = String(status || "").toLowerCase();
  if (/(paid|active|done|completed|resolved|closed|won|approved|online|success|accepted|healthy)/.test(s)) return "green";
  if (/(overdue|failed|lost|rejected|cancel|critical|offline|breach|expired|blocked)/.test(s)) return "red";
  if (/(pending|due|draft|review|waiting|partial|hold|warning|expiring|sent)/.test(s)) return "amber";
  if (/(progress|open|new|in_progress|scheduled|running)/.test(s)) return "blue";
  return "slate";
}

export function Button({ variant = "secondary", children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const v = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-600",
    secondary: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200",
    danger: "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200",
    ghost: "text-slate-600 hover:bg-slate-100 border border-transparent",
  }[variant];
  return <button {...rest} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 ${v} ${className}`}>{children}</button>;
}

export function SearchInput({ value, onChange, placeholder = "Search…", className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none" />
    </div>
  );
}

export const selectClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none";

/** A white card around a table, with a title row and optional toolbar. */
export function TableCard({ title, icon: Icon, count, toolbar, children }: { title?: React.ReactNode; icon?: any; count?: number; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {(title || toolbar) && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 border-b border-slate-100">
          {title && <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 shrink-0">{Icon && <Icon className="w-4 h-4 text-indigo-600" />}{title}{count !== undefined && <span className="text-slate-400 font-normal">({count})</span>}</h3>}
          {toolbar && <div className="flex flex-wrap items-center gap-2 md:ml-auto w-full md:w-auto">{toolbar}</div>}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/** Table header/cell classes matching the Guardian tables. */
export const th = "px-4 py-2.5 text-left text-xs font-medium text-slate-500 bg-slate-50 whitespace-nowrap";
export const td = "px-4 py-3 text-sm text-slate-700 align-middle";

export function EmptyBlock({ icon: Icon, title, hint, action }: { icon?: any; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="p-10 text-center space-y-2">
      {Icon && <Icon className="w-9 h-9 text-slate-300 mx-auto" />}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="text-xs text-slate-500 max-w-md mx-auto">{hint}</p>}
      {action}
    </div>
  );
}

/** Per-day buckets of timestamps over the last `days` days (oldest first), for trend charts. */
export function dayBuckets<T>(items: T[], at: (x: T) => number | null, days = 14, now = Date.now()) {
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * 86_400_000);
    d.setHours(0, 0, 0, 0);
    return { start: d.getTime(), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), items: [] as T[] };
  });
  for (const x of items) {
    const t = at(x);
    if (t === null || !Number.isFinite(t)) continue;
    const b = out.find((b) => t >= b.start && t < b.start + 86_400_000);
    if (b) b.items.push(x);
  }
  return out;
}
