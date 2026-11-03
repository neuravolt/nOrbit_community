"use client";

// A live-updating tree diagram for a just-fired batch of AI jobs (a bulk "Generate All ..."
// fan-out) — root node at top, one child card per job below it, each polling its own status
// every 3s while the modal is open. A child spins while queued/processing, turns amber with
// inline Approve/Reject once it's completed and waiting on a human (Manual mode), or turns
// green on its own within ~15s once the global Auto-approve poll (see
// AiOrchestrationService.autoApproveCompletedJobs) picks it up (Auto mode) — same live signal
// either way, no separate trip to the Generation Jobs page needed to watch a fan-out finish.
//
// Note this diagram never shows a "locked" child: a fan-out (Chapter Detail across chapters,
// Topics across chapters) queues every job in parallel with no ordering between them — the
// strict previous-must-be-approved lock only exists one stage deeper, inside a single Topic's
// Content -> Quiz -> Challenge -> ... chain and between Topics within one Chapter.
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, X, Clock } from "lucide-react";

export interface GenerationProgressJob {
  id: string;
  label: string;
}

interface LiveJob {
  id: string;
  status: string;
  reviewStatus?: string;
  errorMessage?: string;
}

function NodeVisual({ live }: { live?: LiveJob }) {
  if (!live || live.status === "queued" || live.status === "processing") {
    return {
      icon: <Loader2 className="w-4 h-4 animate-spin text-violet-500" />,
      ring: "border-violet-200 bg-violet-50",
      label: live?.status === "processing" ? "Generating…" : "Queued",
    };
  }
  if (live.status === "failed") {
    return { icon: <X className="w-4 h-4 text-rose-600" />, ring: "border-rose-200 bg-rose-50", label: "Failed" };
  }
  if (live.reviewStatus === "approved") {
    return { icon: <Check className="w-4 h-4 text-emerald-600" />, ring: "border-emerald-300 bg-emerald-50", label: "Approved" };
  }
  if (live.reviewStatus === "rejected") {
    return { icon: <X className="w-4 h-4 text-rose-600" />, ring: "border-rose-200 bg-rose-50", label: "Rejected" };
  }
  return { icon: <Clock className="w-4 h-4 text-amber-600" />, ring: "border-amber-200 bg-amber-50", label: "Ready to review" };
}

export function GenerationProgressModal({
  open,
  onClose,
  title,
  rootLabel,
  jobs,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  rootLabel: string;
  jobs: GenerationProgressJob[];
}) {
  const queryClient = useQueryClient();

  const { data: autoApprove } = useQuery<{ enabled: boolean }>({
    queryKey: ["launchpad-ai-auto-approve"],
    queryFn: async () => {
      const { data } = await api.get("/launchpad/admin/ai/settings/auto-approve");
      return data;
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  const jobIdsKey = jobs.map((j) => j.id).join(",");
  const { data: liveJobs, refetch } = useQuery<LiveJob[]>({
    queryKey: ["generation-progress-jobs", jobIdsKey],
    queryFn: async () => {
      const results = await Promise.all(
        jobs.map(async (j) => {
          const { data } = await api.get(`/launchpad/admin/ai/jobs/${j.id}`);
          return data as LiveJob;
        }),
      );
      return results;
    },
    enabled: open && jobs.length > 0,
    refetchInterval: open ? 3000 : false,
  });

  const invalidateEverything = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["admin-level-chapters"] });
    queryClient.invalidateQueries({ queryKey: ["admin-chapter-topics"] });
    queryClient.invalidateQueries({ queryKey: ["launchpad-ai-generation-jobs"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/launchpad/admin/ai/jobs/${id}/approve`, { confirmReplace: false }),
    onSuccess: invalidateEverything,
    onError: (err: any, id: string) => {
      // A prior run already created chapters/topics here with no real content yet — approving
      // would replace them, not append on top, but only once a human confirms.
      if (err.response?.data?.needsConfirmation) {
        if (confirm(err.response.data.message + "\n\nReplace them now?")) {
          api
            .post(`/launchpad/admin/ai/jobs/${id}/approve`, { confirmReplace: true })
            .then(invalidateEverything)
            .catch((e: any) => alert(e.response?.data?.message || "Failed to approve."));
        }
        return;
      }
      alert(err.response?.data?.message || "Failed to approve.");
    },
  });
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/launchpad/admin/ai/jobs/${id}/reject`),
    onSuccess: invalidateEverything,
  });

  if (!open) return null;

  const byId = new Map((liveJobs || []).map((j) => [j.id, j]));
  const settledCount = jobs.filter((j) => {
    const live = byId.get(j.id);
    return live?.reviewStatus === "approved" || live?.reviewStatus === "rejected" || live?.status === "failed";
  }).length;
  const allSettled = jobs.length > 0 && settledCount === jobs.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-xs text-slate-500">
            {autoApprove?.enabled
              ? "Auto mode is on — each card below turns green on its own within about 15 seconds once it finishes generating."
              : "Manual mode — approve or reject each card below as it finishes generating, right here."}
          </p>
        </DialogHeader>

        <div className="pt-2">
          <div className="flex justify-center mb-1">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">{rootLabel}</div>
          </div>
          <div className="flex justify-center">
            <div className="w-px h-4 bg-slate-300" />
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {jobs.map((j) => {
              const live = byId.get(j.id);
              const node = NodeVisual({ live });
              const canReview = live?.status === "completed" && (!live.reviewStatus || live.reviewStatus === "pending");
              return (
                <div key={j.id} className={`flex flex-col items-center gap-1 w-32 border rounded-xl p-2.5 ${node.ring}`}>
                  {node.icon}
                  <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight line-clamp-2" title={j.label}>
                    {j.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{node.label}</span>
                  {live?.errorMessage && (
                    <span className="text-[9px] text-rose-500 text-center line-clamp-2" title={live.errorMessage}>
                      {live.errorMessage}
                    </span>
                  )}
                  {canReview && !autoApprove?.enabled && (
                    <div className="flex gap-1 pt-1">
                      <button
                        onClick={() => approveMutation.mutate(j.id)}
                        disabled={approveMutation.isPending}
                        className="p-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        title="Approve"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(j.id)}
                        disabled={rejectMutation.isPending}
                        className="p-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        title="Reject"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
          <span className="text-xs text-slate-400">
            {allSettled ? "All done." : `${settledCount}/${jobs.length} settled — this updates automatically.`}
          </span>
          <button onClick={onClose} className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
