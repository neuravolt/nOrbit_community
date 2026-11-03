import React from "react";
import { Badge } from "@/components/ui/badge";
import { Lock, Play, Loader2, CheckCircle, Code, Bot, UserCheck, Trophy } from "lucide-react";

export function getStatusColor(status: string): string {
  switch (status) {
    case "locked":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "available":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "in_progress":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "quiz_completed":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "challenge_completed":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "ai_verified":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "mentor_approved":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "completed":
      return "bg-green-50 text-green-700 border-green-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "locked":
      return "Locked";
    case "available":
      return "Available";
    case "in_progress":
      return "In Progress";
    case "quiz_completed":
      return "Quiz Done";
    case "challenge_completed":
      return "Challenge Done";
    case "ai_verified":
      return "AI Verified";
    case "mentor_approved":
      return "Mentor Approved";
    case "completed":
      return "Completed";
    default:
      return "Locked";
  }
}

export function StatusIcon({ status, className = "w-4 h-4" }: { status: string; className?: string }) {
  switch (status) {
    case "locked":
      return <Lock className={className} />;
    case "available":
      return <Play className={className} />;
    case "in_progress":
      return <Loader2 className={`${className} animate-spin`} />;
    case "quiz_completed":
      return <CheckCircle className={className} />;
    case "challenge_completed":
      return <Code className={className} />;
    case "ai_verified":
      return <Bot className={className} />;
    case "mentor_approved":
      return <UserCheck className={className} />;
    case "completed":
      return <Trophy className={className} />;
    default:
      return <Lock className={className} />;
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${getStatusColor(status)} font-bold flex items-center gap-1.5`}>
      <StatusIcon status={status} className="w-3.5 h-3.5" />
      {getStatusLabel(status)}
    </Badge>
  );
}

export function StatusProgress({ currentStatus }: { currentStatus: string }) {
  const steps = [
    "locked",
    "available",
    "in_progress",
    "quiz_completed",
    "challenge_completed",
    "ai_verified",
    "mentor_approved",
    "completed",
  ];
  const currentIdx = steps.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => {
        const isCurrent = idx === currentIdx;
        const isCompleted = idx < currentIdx;

        return (
          <div key={step} className="flex items-center">
            <span
              className={`w-3 h-3 rounded-full border ${
                isCurrent
                  ? "bg-slate-900 border-slate-900 animate-pulse"
                  : isCompleted
                  ? "bg-slate-900 border-slate-900"
                  : "bg-transparent border-slate-300"
              }`}
            />
            {idx < steps.length - 1 && <span className="w-4 h-0.5 bg-slate-200 block" />}
          </div>
        );
      })}
    </div>
  );
}
