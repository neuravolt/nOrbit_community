"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  X,
} from "lucide-react";

interface StageResult {
  stage: string;
  passed: boolean;
  score: number | null;
  blocking: boolean;
  details?: any;
}

interface EvalReport {
  id: string;
  studentId: string;
  studentName: string;
  nodeId: string;
  node: { title: string; challengeType?: string; trustLevel?: string } | null;
  finalScore: number | null;
  passed: boolean;
  decision: string | null;
  overrideDecision: string | null;
  developmentEvidenceScore: number | null;
  mentorReviewReq: boolean;
  autoApproved: boolean;
  stageResults: StageResult[];
  createdAt: string;
  completedAt: string | null;
  mentorFeedback: string | null;
  submissionId: string | null;
  repositoryName: string | null;
  aiFeedback: any;
  challengeBlueprint: { description?: string; requirements?: string[]; evaluationCriteria?: string[] } | null;
}

// The mentor needs to actually verify a decision, not just trust a number — details vary wildly
// per stage, so this renders whatever's useful from each shape instead of a raw JSON dump.
function StageDetails({ result }: { result: StageResult }) {
  const d = result.details;
  if (!d || (typeof d === "object" && Object.keys(d).length === 0)) {
    return <p className="text-slate-400 italic">No additional detail recorded for this stage.</p>;
  }

  if (result.stage === "ai-review") {
    const text = d.architectureReview || d.feedback;
    if (typeof text === "string" && text.trim()) {
      return <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">{text}</div>;
    }
  }

  if (result.stage === "requirement" && Array.isArray(d.checks)) {
    return (
      <div className="space-y-1">
        {d.checks.map((c: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5">
            {c.matched ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <XCircle className="w-3 h-3 text-rose-500 shrink-0" />}
            <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">{c.requirement}</code>
          </div>
        ))}
      </div>
    );
  }

  if (result.stage === "understanding" && Array.isArray(d.evaluated)) {
    return (
      <div className="space-y-3">
        {d.dimensions && (
          <div className="grid grid-cols-3 gap-1.5">
            {Object.entries(d.dimensions).map(([dim, score]) => (
              <div key={dim} className="bg-white border border-slate-200 rounded px-1.5 py-1">
                <div className="text-[8px] text-slate-400 uppercase font-bold truncate">{dim}</div>
                <div className="text-xs font-bold text-slate-800">{String(score)}</div>
              </div>
            ))}
          </div>
        )}
        {d.evaluated.map((q: any, i: number) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-2 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-slate-700 font-semibold flex-1">{q.question}</span>
              <Badge className={`text-[9px] shrink-0 ${q.passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                {q.score}
              </Badge>
            </div>
            {Array.isArray(q.rubricAssessment) && (
              <div className="space-y-0.5 pl-2 border-l-2 border-slate-100">
                {q.rubricAssessment.map((r: any, j: number) => (
                  <div key={j} className="flex items-start gap-1">
                    {r.satisfied ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-2.5 h-2.5 text-rose-400 shrink-0 mt-0.5" />}
                    <span className="text-[10px] text-slate-500">{r.criterion} — {r.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (result.stage === "build" && (d.stderr || d.stdout)) {
    return (
      <pre className="text-[10px] bg-slate-900 text-slate-200 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">
        {d.stderr || d.stdout}
      </pre>
    );
  }

  if (typeof d.reason === "string") {
    return <p className="text-slate-700">{d.reason}</p>;
  }

  // Generic fallback: readable key/value list rather than a raw JSON dump.
  return (
    <div className="space-y-1">
      {Object.entries(d).map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="font-semibold text-slate-500 shrink-0">{key}:</span>
          <span className="text-slate-700 break-all">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
        </div>
      ))}
    </div>
  );
}

// Same routing this data was already computed by — final-score.validator.ts's decision matrix
// (§9). This just labels it for the badge; the decision itself is real, computed server-side.
const DECISION_STYLES: Record<string, string> = {
  PASS: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CONDITIONAL_PASS: "bg-amber-100 text-amber-800 border-amber-300",
  FAIL: "bg-rose-100 text-rose-700 border-rose-300",
  MENTOR_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-300",
};

function DecisionBadge({ decision, overrideDecision }: { decision: string | null; overrideDecision: string | null }) {
  const shown = overrideDecision || decision;
  if (!shown) {
    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300">
        <Clock className="w-3 h-3 mr-1" /> pending
      </Badge>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={DECISION_STYLES[shown] || "bg-slate-100 text-slate-700"}>
        {shown}
      </Badge>
      {overrideDecision && overrideDecision !== decision && (
        <span className="text-[9px] text-slate-400" title={`Originally computed as ${decision}`}>
          (overridden)
        </span>
      )}
    </div>
  );
}

function StageIcon({ result }: { result: StageResult }) {
  // Skipped ("nothing was configured to check") is a distinct state from "checked and passed" —
  // a green checkmark here would say the same thing as a real pass.
  if (result.details?.skipped) return <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  if (result.passed) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (result.blocking) return <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
  return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
}

export default function VerificationDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  // Deliberately empty, not a prefilled guess — this challenge happens to be a Node.js CLI
  // calculator, but a different submission (a different technology, different CLI shape, or a
  // server instead of a script) would make any hardcoded default wrong. Reported live: it looked
  // like the system knew the right command for this submission, when it was actually just an
  // example I'd hardcoded while building the feature.
  const [runCommand, setRunCommand] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-verification-analytics"],
    queryFn: async () => {
      const { data } = await api.get("/admin/analytics/evaluations");
      return data as {
        totalSubmissions: number;
        submissionsToday: number;
        passRate: number;
        avgScores: { overall: number };
        mentorReviewStats: { total: number };
        reports: EvalReport[];
      };
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => {
      return api.post(`/launchpad/mentor-reviews/${id}/approve`, {
        decision,
        overrideReason: overrideReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      setOverrideReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-verification-analytics"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to submit override.");
    },
  });

  const runMutation = useMutation({
    mutationFn: async ({ reportId, command }: { reportId: string; command: string }) => {
      const { data } = await api.post(`/admin/evaluations/${reportId}/run`, { command });
      return data as { stdout: string; stderr: string; code: number };
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to run command.");
    },
  });

  const reports = data?.reports || [];
  const selected = reports.find((r) => r.id === selectedReportId) || null;

  return (
    <div className="p-8 space-y-6 text-slate-800">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          Challenge Verification Dashboard
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Technical Score / Verification Confidence / Development Evidence for every coding-challenge submission,
          straight from the real Verification Engine — not a separate scoring system.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading evaluations...</div>
      ) : isError ? (
        <div className="text-center py-16 text-rose-500 text-sm">Failed to load evaluation analytics.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Submissions</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{data?.totalSubmissions ?? 0}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pass Rate</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{data?.passRate ?? 0}%</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Score</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{data?.avgScores?.overall ?? 0}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mentor Review</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">{data?.mentorReviewStats?.total ?? 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 text-xs font-bold text-slate-900 uppercase tracking-wider">
                Submissions ({reports.length})
              </div>
              {reports.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">No submissions yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => { setSelectedReportId(r.id); setExpandedStage(null); runMutation.reset(); }}
                      className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${
                        selectedReportId === r.id ? "bg-indigo-50/60" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900 truncate">{r.studentName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{r.node?.title || r.nodeId}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold text-slate-700">{r.finalScore ?? "—"}</span>
                        <DecisionBadge decision={r.decision} overrideDecision={r.overrideDecision} />
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              {!selected ? (
                <div className="bg-slate-50/60 border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-400 text-xs">
                  Select a submission to see its evidence breakdown.
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 sticky top-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{selected.studentName}</h3>
                      <p className="text-[11px] text-slate-500">{selected.node?.title}</p>
                    </div>
                    <button onClick={() => setSelectedReportId(null)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {(selected.submissionId || selected.repositoryName) && (
                    <a
                      href={selected.submissionId || `https://github.com/${selected.repositoryName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold break-all"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {selected.repositoryName || selected.submissionId}
                    </a>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-[9px] text-slate-400 font-bold uppercase">Technical</div>
                      <div className="text-lg font-bold text-slate-900">{selected.finalScore ?? "—"}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-[9px] text-slate-400 font-bold uppercase">Dev Evidence</div>
                      <div className="text-lg font-bold text-slate-900">{selected.developmentEvidenceScore ?? "—"}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-[9px] text-slate-400 font-bold uppercase">Decision</div>
                      <div className="text-[11px] font-bold text-slate-900 mt-1.5">
                        <DecisionBadge decision={selected.decision} overrideDecision={selected.overrideDecision} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Validator stages <span className="normal-case font-normal text-slate-400">— click a stage to see the evidence behind it</span>
                    </div>
                    {(selected.stageResults || []).map((s, i) => (
                      <div key={i} className="border-b border-slate-50 last:border-0">
                        <button
                          type="button"
                          onClick={() => setExpandedStage(expandedStage === s.stage ? null : s.stage)}
                          className="w-full flex items-center justify-between text-xs py-1.5 hover:bg-slate-50 rounded transition-colors"
                        >
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <StageIcon result={s} /> {s.stage}
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-400">
                            {/* A bare "100" reads identically whether a real check ran and
                                passed, or nothing was configured to check at all (unit-tests with
                                zero hidden test suites, ast-verification with no route/component
                                requirements) — both set details.skipped. Reported live: a mentor
                                reasonably read "unit-tests: 100" as "hidden tests ran and passed,"
                                when actually none existed for this challenge at all. */}
                            {s.details?.skipped ? (
                              <span className="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Skipped — N/A</span>
                            ) : (
                              s.score ?? (s.passed ? "✓" : "✗")
                            )}
                            {expandedStage === s.stage ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </span>
                        </button>
                        {expandedStage === s.stage && (
                          <div className="text-[11px] bg-slate-50/80 border border-slate-100 rounded-lg p-2.5 mb-2">
                            <StageDetails result={s} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {selected.mentorFeedback && (
                    <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-600">
                      <div className="font-bold text-slate-500 uppercase text-[9px] mb-1">Mentor feedback</div>
                      {selected.mentorFeedback}
                    </div>
                  )}

                  {(selected.submissionId || selected.repositoryName) && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Run it yourself <span className="normal-case font-normal text-slate-400">— fresh sandbox each time, cleaned up right after</span>
                      </div>

                      {/* There's no single "correct output" to match against — challenge
                          requirements are qualitative ("a clear error, not a crash or Infinity"),
                          not an exact-string test. Shown here so a mentor isn't relying on memory
                          to judge whether what they just ran actually satisfies the challenge. */}
                      {selected.challengeBlueprint && (selected.challengeBlueprint.requirements?.length || selected.challengeBlueprint.evaluationCriteria?.length) ? (
                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5 text-[11px] space-y-1.5">
                          {!!selected.challengeBlueprint.requirements?.length && (
                            <div>
                              <span className="font-bold text-indigo-700 uppercase text-[9px] tracking-wider">What's required</span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {selected.challengeBlueprint.requirements.map((r, i) => (
                                  <code key={i} className="text-[10px] bg-white border border-indigo-200 px-1.5 py-0.5 rounded">{r}</code>
                                ))}
                              </div>
                            </div>
                          )}
                          {!!selected.challengeBlueprint.evaluationCriteria?.length && (
                            <div>
                              <span className="font-bold text-indigo-700 uppercase text-[9px] tracking-wider">How it's judged</span>
                              <ul className="list-disc pl-4 mt-0.5 text-slate-600 space-y-0.5">
                                {selected.challengeBlueprint.evaluationCriteria.map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : null}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={runCommand}
                          onChange={(e) => setRunCommand(e.target.value)}
                          placeholder="Enter a command to run against this submission..."
                          className="flex-1 text-xs font-mono border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                        <Button
                          size="sm"
                          disabled={runMutation.isPending || !runCommand.trim()}
                          onClick={() => runMutation.mutate({ reportId: selected.id, command: runCommand })}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs shrink-0"
                        >
                          {runMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Run"}
                        </Button>
                      </div>
                      {runMutation.isPending && (
                        <p className="text-[10px] text-slate-400">Cloning the repo and running this in a throwaway sandbox — usually takes a few seconds...</p>
                      )}
                      {runMutation.data && (
                        <div className="space-y-1">
                          {runMutation.data.stdout && (
                            <pre className="text-[10px] bg-slate-900 text-emerald-300 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">{runMutation.data.stdout}</pre>
                          )}
                          {runMutation.data.stderr && (
                            <pre className="text-[10px] bg-slate-900 text-rose-300 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">{runMutation.data.stderr}</pre>
                          )}
                          {!runMutation.data.stdout && !runMutation.data.stderr && (
                            <p className="text-[10px] text-slate-400 italic">Command ran with exit code {runMutation.data.code} — no output.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Override reason (required to override)"
                      rows={2}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        disabled={overrideMutation.isPending}
                        onClick={() => overrideMutation.mutate({ id: selected.id, decision: "approved" })}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      >
                        {overrideMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Override → PASS"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={overrideMutation.isPending}
                        onClick={() => overrideMutation.mutate({ id: selected.id, decision: "rejected" })}
                        className="text-rose-700 border-rose-300 text-xs"
                      >
                        Override → FAIL
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Overriding never rewrites the computed decision — it's recorded alongside it (see the "overridden"
                      label above once submitted).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
