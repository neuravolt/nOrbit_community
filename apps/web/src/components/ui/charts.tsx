"use client";

import { useId } from "react";

/**
 * Guardian's chart and card kit (light, minimal). Every component draws only the numbers it is
 * given: an empty series draws nothing rather than a made-up line.
 */

export const TONES = {
  critical: { fg: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", icon: "bg-rose-500", stroke: "#ef4444" },
  warning: { fg: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", icon: "bg-amber-400", stroke: "#f59e0b" },
  info: { fg: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", icon: "bg-blue-500", stroke: "#3b82f6" },
  ok: { fg: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", icon: "bg-emerald-500", stroke: "#10b981" },
  violet: { fg: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100", icon: "bg-violet-500", stroke: "#8b5cf6" },
  neutral: { fg: "text-slate-600", bg: "bg-white", border: "border-slate-200", icon: "bg-slate-500", stroke: "#64748b" },
} as const;
export type ToneName = keyof typeof TONES;

/** 1234 -> "1.2k", 138475 -> "1.4L" (Indian style), for axis labels. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/** A small area line of recent values (e.g. alerts per hour). */
export function Sparkline({ values, color = "#6366f1", width = 96, height = 34 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const id = useId();
  if (!values.length || values.every((v) => v === 0)) return <div style={{ width, height }} />;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => [i * step, height - 2 - (v / max) * (height - 4)] as const);
  // Smooth through the midpoints so hourly counts read as a trend, not a comb.
  let line = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    line += ` Q${px.toFixed(1)},${py.toFixed(1)} ${((px + x) / 2).toFixed(1)},${((py + y) / 2).toFixed(1)}`;
  }
  line += ` T${pts[pts.length - 1][0].toFixed(1)},${pts[pts.length - 1][1].toFixed(1)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** A headline number with its trend: "7 Active alerts ↑ 3 new". */
export function KpiCard({
  tone = "neutral", icon: Icon, value, label, delta, series, onClick, active,
}: {
  tone?: ToneName;
  icon?: any;
  value: React.ReactNode;
  label: string;
  delta?: { text: string; up?: boolean } | null;
  series?: number[];
  onClick?: () => void;
  active?: boolean;
}) {
  const t = TONES[tone];
  const Wrap: any = onClick ? "button" : "div";
  return (
    <Wrap
      onClick={onClick}
      className={`w-full text-left rounded-2xl border ${t.border} ${t.bg} px-4 py-3.5 flex items-center gap-3 min-w-0 transition ${onClick ? "hover:shadow-sm" : ""} ${active ? "ring-2 ring-indigo-200" : ""}`}
    >
      {Icon && (
        <div className={`w-11 h-11 shrink-0 rounded-xl ${t.icon} bg-opacity-15 flex items-center justify-center`} style={{ backgroundColor: `${t.stroke}22` }}>
          <Icon className={`w-5 h-5 ${t.fg}`} />
        </div>
      )}
      <div className="min-w-[6.5rem] flex-1">
        <p className="text-2xl font-bold text-slate-900 leading-tight tabular-nums">{value}</p>
        <p className="text-xs font-medium text-slate-600 whitespace-nowrap">{label}</p>
        {delta && <p className={`text-[11px] font-semibold whitespace-nowrap ${delta.up === undefined ? "text-slate-500" : delta.up ? t.fg : "text-emerald-600"}`}>{delta.text}</p>}
      </div>
      {series && <div className="shrink-0 hidden sm:block"><Sparkline values={series} color={t.stroke} /></div>}
    </Wrap>
  );
}

/** A white card with a title row. */
export function ChartCard({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export interface Series { key: string; label: string; color: string }

/** Stacked bars over time (e.g. alerts per hour by severity), with a light y-axis. */
export function StackedBars({ buckets, series, height = 150, labelEvery = 4, format = compact }: { buckets: { label: string; values: Record<string, number> }[]; series: Series[]; height?: number; labelEvery?: number; format?: (n: number) => string }) {
  const totals = buckets.map((b) => series.reduce((n, s) => n + (b.values[s.key] || 0), 0));
  const max = Math.max(...totals, 0);
  if (!buckets.length) return null;
  const top = max <= 4 ? 4 : Math.ceil(max / 5) * 5;
  const ticks = [top, Math.round(top / 2), 0];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-[10px] text-slate-400 tabular-nums text-right min-w-5" style={{ height }}>
          {ticks.map((t) => <span key={t}>{format(t)}</span>)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative flex items-end gap-[3px] border-b border-slate-200" style={{ height }}>
            {[0.5, 1].map((f) => <div key={f} className="absolute left-0 right-0 border-t border-dashed border-slate-100" style={{ bottom: height * f }} />)}
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 min-w-0 flex flex-col-reverse relative group" style={{ height: `${(totals[i] / top) * 100}%` }} title={`${b.label}: ${series.map((s) => `${s.label} ${b.values[s.key] || 0}`).join(", ")}`}>
                {series.map((s) => (b.values[s.key] ? <div key={s.key} style={{ height: `${((b.values[s.key] || 0) / Math.max(totals[i], 1)) * 100}%`, backgroundColor: s.color }} className="w-full first:rounded-b-none last:rounded-t-sm" /> : null))}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px] mt-1">
            {buckets.map((b, i) => (
              <span key={i} className={`flex-1 min-w-0 text-center text-[10px] text-slate-400 whitespace-nowrap ${i % labelEvery === 0 ? "" : "invisible"}`}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>
      {max === 0 && <p className="text-xs text-slate-400">Nothing in this period.</p>}
    </div>
  );
}

/** A donut with a total in the middle and a legend with counts and shares. */
export function Donut({ segments, centerLabel, size = 120 }: { segments: { label: string; value: number; color: string }[]; centerLabel: string; size?: number }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = 15.9155;
  let offset = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#f1f5f9" strokeWidth="4.2" />
          {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
            const pct = (s.value / total) * 100;
            const el = <circle key={s.label} cx="18" cy="18" r={r} fill="none" stroke={s.color} strokeWidth="4.2" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-offset} />;
            offset += pct;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 tabular-nums">{total}</span>
          <span className="text-[10px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5 text-xs">
        {segments.map((s) => (
          <div key={s.label} className="grid grid-cols-[1fr_auto_auto] gap-2.5 items-center">
            <span className="flex items-center gap-2 text-slate-700 whitespace-nowrap"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}</span>
            <span className="font-semibold text-slate-900 tabular-nums">{s.value}</span>
            <span className="text-slate-400 tabular-nums w-10 text-right">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars ("Top alert sources"). */
export function BarList({ items, empty = "Nothing in this period.", format = (n: number) => String(n) }: { items: { label: string; value: number; color?: string }[]; empty?: string; format?: (n: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return <p className="text-xs text-slate-400">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] gap-3 items-center text-xs">
          <span className="text-slate-700 truncate" title={i.label}>{i.label}</span>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, backgroundColor: i.color || "#6366f1" }} />
          </div>
          <span className="font-semibold text-slate-700 tabular-nums min-w-8 text-right whitespace-nowrap">{format(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Buckets timestamps into the last `n` hours (oldest first). */
export function hourBuckets<T>(items: T[], at: (x: T) => number, now: number, n = 24) {
  const start = now - n * 3600_000;
  const out = Array.from({ length: n }, (_, i) => ({ start: start + i * 3600_000, items: [] as T[] }));
  for (const x of items) {
    const t = at(x);
    if (!(t >= start && t <= now)) continue;
    out[Math.min(n - 1, Math.floor((t - start) / 3600_000))].items.push(x);
  }
  return out;
}

/** Several lines over time with a light y-axis (e.g. attack activity per hour). */
export function LineChart({ points, series, height = 150, labelEvery = 4 }: { points: { label: string; values: Record<string, number> }[]; series: Series[]; height?: number; labelEvery?: number }) {
  const width = 600;
  const max = Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] || 0)));
  const top = max <= 4 ? 4 : Math.ceil(max / 5) * 5;
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * width : 0);
  const y = (v: number) => height - (v / top) * (height - 6) - 1;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-[10px] text-slate-400 tabular-nums text-right w-7" style={{ height }}>
          {[top, Math.round(top / 2), 0].map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="flex-1 min-w-0">
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full border-b border-slate-200" style={{ height }}>
            {[0.5, 1].map((f) => <line key={f} x1="0" x2={width} y1={height - f * (height - 6)} y2={height - f * (height - 6)} stroke="#f1f5f9" strokeDasharray="4 4" />)}
            {series.map((s, si) => {
              const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.values[s.key] || 0).toFixed(1)}`).join(" ");
              return (
                <g key={s.key}>
                  {si === 0 && <path d={`${d} L${width},${height} L0,${height} Z`} fill={s.color} fillOpacity="0.08" />}
                  <path d={d} fill="none" stroke={s.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </g>
              );
            })}
          </svg>
          <div className="flex mt-1">
            {points.map((p, i) => (
              <span key={i} className={`flex-1 min-w-0 text-[10px] text-slate-400 whitespace-nowrap ${i % labelEvery === 0 ? "" : "invisible"}`}>{p.label}</span>
            ))}
          </div>
        </div>
      </div>
      {max === 0 && <p className="text-xs text-slate-400">Nothing recorded in this period.</p>}
    </div>
  );
}
