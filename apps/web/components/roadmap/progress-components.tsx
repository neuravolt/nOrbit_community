import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface CircularProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export function CircularProgressRing({ percentage, size = 60, strokeWidth = 5 }: CircularProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct < 30) return "stroke-rose-500";
    if (pct < 70) return "stroke-amber-500";
    return "stroke-emerald-500";
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-slate-100 fill-none"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`fill-none transition-all duration-500 ease-out ${getColor(percentage)}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-bold text-slate-800">{percentage}%</span>
    </div>
  );
}

interface LinearProgressBarProps {
  percentage: number;
  height?: number;
  showLabel?: boolean;
}

export function LinearProgressBar({ percentage, height = 6, showLabel = true }: LinearProgressBarProps) {
  const getColor = (pct: number) => {
    if (pct < 30) return "bg-rose-500";
    if (pct < 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-1.5 w-full">
      {showLabel && (
        <div className="flex justify-between text-xs font-bold text-slate-500">
          <span>Overall Progress</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${getColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isUp: boolean;
  };
}

export function StatsCard({ title, value, subtitle, icon, trend }: StatsCardProps) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{title}</span>
          <span className="text-2xl font-extrabold text-slate-900 block">{value}</span>
          {subtitle && <span className="text-xs text-slate-500 block">{subtitle}</span>}
          {trend && (
            <div className="flex items-center gap-1 mt-1.5">
              {trend.isUp ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span className={`text-xs font-bold ${trend.isUp ? "text-emerald-600" : "text-rose-600"}`}>
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        {icon && <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">{icon}</div>}
      </CardContent>
    </Card>
  );
}

export function LevelBadge({ level, maxLevel = 5 }: { level: number; maxLevel?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-bold text-slate-700">Level {level} of {maxLevel}</span>
      <div className="flex gap-1">
        {Array.from({ length: maxLevel }).map((_, idx) => {
          const isActive = idx < level;
          return (
            <span
              key={idx}
              className={`w-1.5 h-1.5 rounded-full block ${isActive ? "bg-slate-950" : "bg-slate-200"}`}
            />
          );
        })}
      </div>
    </div>
  );
}
