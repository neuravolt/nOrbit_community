"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitBranch, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AIGenerationJob } from "../../../_shared/job-output-view";
import { JobTreeExplorer } from "../../../_shared/job-tree-explorer";

export default function ExecutionTreePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: level } = useQuery({
    queryKey: ["admin-level-detail", levelId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/levels/${levelId}`);
      return data.data;
    },
  });

  const { data: jobs, isLoading, refetch } = useQuery<AIGenerationJob[]>({
    queryKey: ["admin-level-execution-tree-jobs", levelId],
    queryFn: async () => {
      const { data } = await api.get(`/launchpad/admin/ai/levels/${levelId}/jobs`);
      return data.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-level-execution-tree-jobs", levelId] });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/launchpad/admin/ai/jobs/${id}/retry`),
    onSuccess: invalidate,
  });
  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/launchpad/admin/ai/jobs/${id}/approve`),
    onSuccess: invalidate,
    onError: (err: any) => alert(err.response?.data?.message || "Failed to approve job."),
  });
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/launchpad/admin/ai/jobs/${id}/reject`),
    onSuccess: invalidate,
  });

  const levelLabel = level?.name ? `L${level.levelNumber}: ${level.name}` : "This Level";

  return (
    <div className="p-8 space-y-6 text-slate-800">
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-4">
        <span>Admin</span>
        <span>&gt;</span>
        <span className="hover:underline cursor-pointer" onClick={() => router.back()}>Levels</span>
        <span>&gt;</span>
        <span className="text-slate-900 font-bold">{levelLabel} — Execution Tree</span>
      </nav>

      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-indigo-500" />
              Execution Tree
            </h2>
            <p className="text-sm text-slate-500 max-w-2xl">
              The actual fan-out this Level's pipeline ran: one Syllabus request → one Chapter-Detail
              + Topics request per chapter → one Content/Quiz/Challenge/Hidden-Tests/Interview/
              Mini-Project request per topic. Pick anything on the left to see what's been generated.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/levels/${levelId}/syllabus`}>
            <Button variant="outline">Curriculum Tree</Button>
          </Link>
          <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading jobs...</div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-300 rounded-xl text-slate-400 text-sm">
          No AI generation jobs recorded for this Level yet.
        </div>
      ) : (
        <JobTreeExplorer
          jobs={jobs}
          levelLabel={levelLabel}
          onApprove={(job) => approveMutation.mutate(job.id)}
          onReject={(job) => rejectMutation.mutate(job.id)}
          onRetry={(job) => retryMutation.mutate(job.id)}
          approvingId={approveMutation.isPending ? approveMutation.variables : undefined}
          rejectingId={rejectMutation.isPending ? rejectMutation.variables : undefined}
          retryingId={retryMutation.isPending ? retryMutation.variables : undefined}
        />
      )}
    </div>
  );
}
