"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Check, X, Pencil, Save, XCircle, List, GitBranch, Zap, ShieldCheck } from "lucide-react";
import { AIGenerationJob, getJobBreadcrumb, JobOutputView, JOB_TYPE_LABELS } from "../_shared/job-output-view";
import { JobTreeExplorer } from "../_shared/job-tree-explorer";
import { LevelPicker } from "../_shared/level-picker";

// A career/role/technology/level cascading picker, built entirely from endpoints that already
// exist for the admin Careers pages (no new backend route) — reused here just to resolve a
// levelId for the Tree view's GET /launchpad/admin/ai/levels/:id/jobs. Every list endpoint in
// this API returns either {items: [...]} (paginated) or a bare array depending on the resource,
// so this always unwraps defensively rather than assuming one shape.
const unwrapList = (data: any): any[] => data?.items || (Array.isArray(data) ? data : []);

function usePickerList(key: string, path: string, enabled: boolean) {
  return useQuery({
    queryKey: [key, path],
    queryFn: async () => {
      const { data } = await api.get(path);
      return unwrapList(data.data);
    },
    enabled,
  });
}

// Phase 5A (Review Flow, Step 2): this page previously called /api/admin/generation-jobs,
// which reads the legacy aIGenerationJob table — a table nothing in this app actually writes
// to (the node editor's "Generate via AI" buttons create launchpadAiGenerationJob rows via
// /launchpad/admin/ai/*). That meant every job an admin actually triggered was invisible here.
// Repointed at the correct, already-safe backend (AiOrchestrationController /
// launchpadAiGenerationJob), which routes approvals through a draft — never a direct write onto
// published, student-visible content.

export default function GenerationJobsPage() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<AIGenerationJob | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedOutput, setEditedOutput] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [viewMode, setViewMode] = useState<"flat" | "tree">("flat");
  const [careerId, setCareerId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [techId, setTechId] = useState("");
  const [levelId, setLevelId] = useState("");

  // Global Auto/Manual mode — when Auto is on, AiOrchestrationService.autoApproveCompletedJobs
  // (a 15s server-side poll) approves every completed-but-unreviewed job across every stage
  // (Levels/Syllabus/Chapter-Detail/Topics/Content/Quiz/Challenge/...) without anyone opening
  // this page. Manual (the default) is the existing review-every-job flow below, unchanged.
  const { data: autoApprove, refetch: refetchAutoApprove } = useQuery<{ enabled: boolean }>({
    queryKey: ["launchpad-ai-auto-approve"],
    queryFn: async () => {
      const { data } = await api.get("/launchpad/admin/ai/settings/auto-approve");
      return data;
    },
  });

  const setAutoApproveMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data } = await api.post("/launchpad/admin/ai/settings/auto-approve", { enabled });
      return data;
    },
    onSuccess: () => refetchAutoApprove(),
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to update auto-approve setting.");
    },
  });

  const { data: jobs, isLoading, refetch } = useQuery<AIGenerationJob[]>({
    queryKey: ["launchpad-ai-generation-jobs"],
    queryFn: async () => {
      const { data } = await api.get("/launchpad/admin/ai/jobs");
      return data || [];
    },
    enabled: viewMode === "flat",
  });

  const { data: careers } = usePickerList("admin-careers", "/admin/careers", viewMode === "tree");
  const { data: roles } = usePickerList("admin-roles", `/admin/careers/${careerId}/roles`, viewMode === "tree" && !!careerId);
  const { data: techs } = usePickerList("admin-techs", `/admin/roles/${roleId}/technologies`, viewMode === "tree" && !!roleId);
  const { data: levels } = usePickerList("admin-levels", `/admin/technologies/${techId}/levels`, viewMode === "tree" && !!techId);

  const { data: treeJobs, isLoading: treeLoading, refetch: refetchTree } = useQuery<AIGenerationJob[]>({
    queryKey: ["admin-level-execution-tree-jobs", levelId],
    queryFn: async () => {
      const { data } = await api.get(`/launchpad/admin/ai/levels/${levelId}/jobs`);
      return data.data;
    },
    enabled: viewMode === "tree" && !!levelId,
  });

  const selectedLevel = (levels || []).find((l: any) => l.id === levelId);
  const selectedLevelLabel = selectedLevel ? `L${selectedLevel.levelNumber}: ${selectedLevel.name}` : "This Level";

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
    }, 10000);
    return () => clearInterval(timer);
  }, [refetch]);

  const openDetails = (job: AIGenerationJob) => {
    setSelectedJob(job);
    setIsEditing(false);
    setEditError(null);
    setEditedOutput(job.outputData ? JSON.stringify(job.outputData, null, 2) : "");
  };

  const closeDetails = () => {
    setSelectedJob(null);
    setIsEditing(false);
    setEditError(null);
    setShowRawOutput(false);
  };

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/launchpad/admin/ai/jobs/${id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["launchpad-ai-generation-jobs"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/launchpad/admin/ai/jobs/${id}/approve`, { confirmReplace: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["launchpad-ai-generation-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-level-execution-tree-jobs", levelId] });
      closeDetails();
    },
    onError: (err: any, id: string) => {
      // A prior run already created chapters/topics for this same target with no real content
      // yet — approving would replace them, not append on top, but only once a human confirms.
      if (err.response?.data?.needsConfirmation) {
        if (confirm(err.response.data.message + "\n\nReplace them now?")) {
          api.post(`/launchpad/admin/ai/jobs/${id}/approve`, { confirmReplace: true }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["launchpad-ai-generation-jobs"] });
            queryClient.invalidateQueries({ queryKey: ["admin-level-execution-tree-jobs", levelId] });
            closeDetails();
          }).catch((e: any) => alert(e.response?.data?.message || "Failed to approve job."));
        }
        return;
      }
      alert(err.response?.data?.message || "Failed to approve job.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/launchpad/admin/ai/jobs/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["launchpad-ai-generation-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-level-execution-tree-jobs", levelId] });
      closeDetails();
    },
  });

  // Phase 5A (Review Flow, Step 2): the reviewer previously had no way to correct generated
  // content before approving it. Saves back through PATCH /launchpad/admin/ai/jobs/:id, which
  // is only allowed while the job is completed and not yet approved.
  const editMutation = useMutation({
    mutationFn: async ({ id, outputData }: { id: string; outputData: any }) => {
      const { data } = await api.patch(`/launchpad/admin/ai/jobs/${id}`, { outputData });
      return data;
    },
    onSuccess: (updatedJob: AIGenerationJob) => {
      queryClient.invalidateQueries({ queryKey: ["launchpad-ai-generation-jobs"] });
      setSelectedJob(updatedJob);
      setIsEditing(false);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.message || "Failed to save edit.");
    },
  });

  // Slice 6-9 (Full review UI): verification evidence + score breakdown for Stage 6a/6b
  // (5B-15/5B-14) — the contract this job drafted, plus Stage 6b's deterministic Broken
  // Solutions validation outcome, if it's already run.
  const isVerificationContractJob = selectedJob?.jobType === "ai.generate.verification-contract";
  const { data: verificationContract, refetch: refetchContract } = useQuery({
    queryKey: ["admin-node-verification-contract", selectedJob?.targetId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/nodes/${selectedJob!.targetId}/verification-contract`);
      return data.data;
    },
    enabled: isVerificationContractJob && !!selectedJob?.targetId,
  });
  const approveContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { data } = await api.post(`/admin/verification-contracts/${contractId}/approve`);
      return data.data;
    },
    onSuccess: () => {
      refetchContract();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to approve verification contract.");
    },
  });

  const handleSaveEdit = () => {
    if (!selectedJob) return;
    let parsed: any;
    try {
      parsed = JSON.parse(editedOutput);
    } catch (e) {
      setEditError("Invalid JSON — fix the syntax before saving.");
      return;
    }
    setEditError(null);
    editMutation.mutate({ id: selectedJob.id, outputData: parsed });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "queued":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "processing":
        return "bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse";
      case "completed":
        return "bg-green-50 text-green-700 border-green-200";
      case "failed":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const canReview = (job: AIGenerationJob) =>
    job.status === "completed" && (!job.reviewStatus || job.reviewStatus === "pending");

  if (viewMode === "flat" && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 text-slate-800">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Generation Jobs</h2>
          <p className="text-sm text-slate-500">Review, edit, and approve AI-generated Launchpad content before it becomes a draft on its node.</p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            title={
              autoApprove?.enabled
                ? "Auto: every completed job across every stage approves itself within about 15 seconds, unreviewed."
                : "Manual: every job waits here for you to Approve or Reject."
            }
          >
            <span className={`flex items-center gap-1 text-xs font-bold ${!autoApprove?.enabled ? "text-emerald-700" : "text-slate-400"}`}>
              <ShieldCheck className="w-3.5 h-3.5" /> Manual
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!!autoApprove?.enabled}
              onClick={() => setAutoApproveMutation.mutate(!autoApprove?.enabled)}
              disabled={setAutoApproveMutation.isPending}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                autoApprove?.enabled ? "bg-amber-500" : "bg-slate-300"
              } ${setAutoApproveMutation.isPending ? "opacity-60" : ""}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  autoApprove?.enabled ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className={`flex items-center gap-1 text-xs font-bold ${autoApprove?.enabled ? "text-amber-700" : "text-slate-400"}`}>
              <Zap className="w-3.5 h-3.5" /> Auto
            </span>
          </div>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("flat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${viewMode === "flat" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
            >
              <List className="w-3.5 h-3.5" /> Flat
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${viewMode === "tree" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
            >
              <GitBranch className="w-3.5 h-3.5" /> Tree
            </button>
          </div>
          <Button onClick={() => (viewMode === "flat" ? refetch() : refetchTree())} variant="outline" className="flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {viewMode === "tree" && (
        <LevelPicker
          careers={(careers || []).map((c: any) => ({ id: c.id, label: c.name }))}
          careerId={careerId}
          onCareerChange={(id) => { setCareerId(id); setRoleId(""); setTechId(""); setLevelId(""); }}
          roles={(roles || []).map((r: any) => ({ id: r.id, label: r.name }))}
          roleId={roleId}
          onRoleChange={(id) => { setRoleId(id); setTechId(""); setLevelId(""); }}
          techs={(techs || []).map((t: any) => ({ id: t.id, label: t.name }))}
          techId={techId}
          onTechChange={(id) => { setTechId(id); setLevelId(""); }}
          levels={(levels || []).map((l: any) => ({ id: l.id, label: `L${l.levelNumber}: ${l.name}` }))}
          levelId={levelId}
          onLevelChange={setLevelId}
        />
      )}

      {viewMode === "tree" ? (
        !levelId ? (
          <div className="text-center py-16 border border-dashed border-slate-300 rounded-xl text-slate-400 text-sm">
            Pick a Career → Role → Technology → Level above to see that Level's job tree.
          </div>
        ) : treeLoading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading jobs...</div>
        ) : (
          <JobTreeExplorer
            jobs={treeJobs || []}
            levelLabel={selectedLevelLabel}
            onApprove={(job) => approveMutation.mutate(job.id)}
            onReject={(job) => rejectMutation.mutate(job.id)}
            onRetry={(job) => retryMutation.mutate(job.id)}
            approvingId={approveMutation.isPending ? approveMutation.variables : undefined}
            rejectingId={rejectMutation.isPending ? rejectMutation.variables : undefined}
            retryingId={retryMutation.isPending ? retryMutation.variables : undefined}
          />
        )
      ) : (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Stage</TableHead>
              <TableHead className="min-w-[260px]">Where in the curriculum</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[70px]">Retries</TableHead>
              <TableHead className="w-[90px]">Created At</TableHead>
              <TableHead className="text-right w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(jobs || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-slate-500 py-8">
                  No AI generation jobs yet. Trigger one from a node's editor page.
                </TableCell>
              </TableRow>
            )}
            {(jobs || []).map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-semibold text-slate-800 text-sm whitespace-nowrap align-top">
                  {JOB_TYPE_LABELS[job.jobType] || job.jobType}
                  <div className="font-mono text-[10px] text-slate-400 font-normal">{job.id.slice(0, 8)}…</div>
                </TableCell>
                <TableCell className="text-slate-700 text-xs whitespace-normal break-words align-top">{getJobBreadcrumb(job)}</TableCell>
                <TableCell className="space-y-1 align-top">
                  <div>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md border ${getStatusBadgeColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  {job.reviewStatus && (
                    <div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border capitalize ${
                        job.reviewStatus === 'approved' ? 'bg-green-100 text-green-800 border-green-300' :
                        job.reviewStatus === 'rejected' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        'bg-slate-100 text-slate-800 border-slate-300'
                      }`}>
                        {job.reviewStatus}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm align-top">{job.retryCount}</TableCell>
                <TableCell className="text-slate-500 text-xs align-top whitespace-nowrap">{new Date(job.createdAt).toLocaleTimeString()}</TableCell>
                <TableCell className="whitespace-normal align-top">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openDetails(job)}>
                      Review
                    </Button>
                    {job.status === "failed" && (
                      <Button variant="outline" size="sm" onClick={() => retryMutation.mutate(job.id)} disabled={retryMutation.isPending}>
                        Retry
                      </Button>
                    )}
                    {canReview(job) && (
                      <>
                        <Button variant="outline" size="icon" className="hover:bg-green-50" title="Approve Output" onClick={() => approveMutation.mutate(job.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                          {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-600" />}
                        </Button>
                        <Button variant="outline" size="icon" className="hover:bg-red-50" title="Reject Output" onClick={() => rejectMutation.mutate(job.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                          {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 text-rose-600" />}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Review / Edit Dialog */}
      {selectedJob && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) closeDetails(); }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{JOB_TYPE_LABELS[selectedJob.jobType] || selectedJob.jobType}</DialogTitle>
              <p className="text-xs text-slate-500 font-sans">{getJobBreadcrumb(selectedJob)}</p>
            </DialogHeader>
            <div className="space-y-4 pt-4 text-xs">
              <details className="group">
                <summary className="text-xs font-bold uppercase font-sans text-slate-500 cursor-pointer select-none">
                  Input context sent to the AI <span className="text-slate-400 font-normal normal-case group-open:hidden">(click to expand)</span>
                </summary>
                <pre className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto font-mono text-[11px]">
                  {JSON.stringify(selectedJob.inputData, null, 2)}
                </pre>
              </details>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase font-sans text-slate-500">Generated Output — what you're approving</label>
                  <div className="flex items-center gap-1">
                    {!isEditing && selectedJob.outputData && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-sans" onClick={() => setShowRawOutput((v) => !v)}>
                        {showRawOutput ? "Formatted view" : "Raw JSON"}
                      </Button>
                    )}
                    {selectedJob.status === "completed" && selectedJob.reviewStatus !== "approved" && !isEditing && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-sans" onClick={() => setIsEditing(true)}>
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedOutput}
                      onChange={(e) => setEditedOutput(e.target.value)}
                      className="w-full min-h-[240px] p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                    />
                    {editError && <p className="text-rose-600 font-sans">{editError}</p>}
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setIsEditing(false); setEditError(null); setEditedOutput(selectedJob.outputData ? JSON.stringify(selectedJob.outputData, null, 2) : ""); }}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={editMutation.isPending}>
                        {editMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                        Save Edit
                      </Button>
                    </div>
                  </div>
                ) : (
                  selectedJob.outputData && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-[420px] overflow-y-auto">
                      {showRawOutput ? (
                        <pre className="overflow-x-auto font-mono text-[11px]">{JSON.stringify(selectedJob.outputData, null, 2)}</pre>
                      ) : (
                        <JobOutputView job={selectedJob} />
                      )}
                    </div>
                  )
                )}
              </div>

              {selectedJob.errorMessage && (
                <div>
                  <label className="text-xs font-bold uppercase block mb-1 font-sans text-rose-500">Execution Error Trace</label>
                  <pre className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 overflow-x-auto font-mono text-[11px] whitespace-pre-wrap">
                    {selectedJob.errorMessage}
                  </pre>
                </div>
              )}

              {/* Slice 6-9: verification evidence + score breakdown for Stage 6a/6b (5B-15/5B-14). */}
              {isVerificationContractJob && verificationContract && (
                <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 space-y-2 font-sans">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-indigo-700">Verification Contract</label>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border capitalize ${
                      verificationContract.approvalStatus === "approved" ? "bg-green-100 text-green-800 border-green-300" :
                      verificationContract.approvalStatus === "rejected" ? "bg-rose-100 text-rose-800 border-rose-300" :
                      "bg-slate-100 text-slate-800 border-slate-300"
                    }`}>
                      {verificationContract.approvalStatus}
                    </span>
                  </div>

                  {(verificationContract.customWeights || verificationContract.customGates) && (
                    <div className="text-xs">
                      {verificationContract.customWeights && (
                        <p><span className="font-bold">Custom weights:</span> {JSON.stringify(verificationContract.customWeights)}</p>
                      )}
                      {verificationContract.customGates?.length > 0 && (
                        <p><span className="font-bold">Custom gates:</span> {verificationContract.customGates.join(", ")}</p>
                      )}
                    </div>
                  )}

                  {verificationContract.testValidationResult ? (
                    <div className="text-xs space-y-1">
                      <p className="font-bold">
                        Broken Solutions validation: {verificationContract.testValidationResult.validated ? (
                          <span className="text-emerald-700">✓ Tests validated</span>
                        ) : (
                          <span className="text-rose-700">✗ Tests unvalidated</span>
                        )}
                      </p>
                      {typeof verificationContract.testValidationResult.expectedPassRate === "number" && (
                        <p>Reference solution pass rate: {Math.round(verificationContract.testValidationResult.expectedPassRate * 100)}% (needs ≥95%)</p>
                      )}
                      {typeof verificationContract.testValidationResult.brokenPassRate === "number" && (
                        <p>Broken-solution pass rate: {Math.round(verificationContract.testValidationResult.brokenPassRate * 100)}% (must be ≤20%)</p>
                      )}
                      {verificationContract.testValidationResult.reason && (
                        <p className="text-slate-600 italic">{verificationContract.testValidationResult.reason}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Broken Solutions validation has not run yet — it runs automatically once this contract is approved.</p>
                  )}

                  {verificationContract.approvalStatus === "draft" && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => approveContractMutation.mutate(verificationContract.id)}
                      disabled={approveContractMutation.isPending}
                    >
                      {approveContractMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                      Approve Contract
                    </Button>
                  )}
                </div>
              )}

              <p className="font-sans text-[11px] text-slate-400">
                Approving writes this output as a pending draft on the node — students never see it until you open the node editor and click Publish.
              </p>

              <div className="flex justify-between items-center pt-4">
                <div className="space-x-2">
                  {canReview(selectedJob) && !isEditing && (
                    <>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={() => approveMutation.mutate(selectedJob.id)}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={() => rejectMutation.mutate(selectedJob.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                </div>
                <Button type="button" variant="outline" onClick={closeDetails}>Dismiss</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
